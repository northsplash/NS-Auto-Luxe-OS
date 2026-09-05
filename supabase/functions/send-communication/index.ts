import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type':'application/json',
};

const CUSTOMER_EVENTS=new Set([
  'booking_received','booking_confirmed','booking_declined','appointment_reminder','appointment_reminder_24h','appointment_reminder_2h',
  'appointment_rescheduled','appointment_cancelled','detailer_assigned','detailer_en_route','detailer_approaching','detailer_arrived','job_started',
  'job_completed','invoice_sent','payment_reminder','payment_received','refund_issued','receipt_ready','thank_you','review_request','rebooking_30d','rebooking_90d',
  'estimate_sent','membership_update'
]);
const EMPLOYEE_EVENTS=new Set(['application_received','first_interview','second_interview','background_check','job_offer','offer_accepted','offer_declined','onboarding','start_date','training_assigned','employee_invite','schedule_changed']);

function serverKey(){
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(legacy)return legacy;
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(!raw)return '';
  try{const parsed=JSON.parse(raw);return parsed?.default||parsed?.service_role||parsed?.serviceRole||''}catch{return ''}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
    const serviceKey=serverKey();
    const sendgridKey=Deno.env.get('SENDGRID_API_KEY')||'';
    const defaultFromEmail=Deno.env.get('SENDGRID_FROM_EMAIL')||'appointments@northsplash.com';
    const defaultFromName=Deno.env.get('SENDGRID_FROM_NAME')||'North Splash Auto Luxe';
    const replyToEmail=Deno.env.get('SENDGRID_REPLY_TO_EMAIL')||defaultFromEmail;
    if(!supabaseUrl||!serviceKey)throw new Error('Supabase server credentials are missing.');
    if(!sendgridKey)throw new Error('SENDGRID_API_KEY is missing from Edge Function secrets.');

    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const authHeader=req.headers.get('Authorization')||'';
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):'';
    if(!token)throw new Error('Authorization token is missing.');
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)throw new Error('Unauthorized.');
    const {data:actor}=await admin.from('profiles').select('id,role,portal_role,permissions,is_active').eq('id',user.id).maybeSingle();
    if(!actor)throw new Error('User profile could not be found.');
    if(actor.is_active===false&&actor.role!=='admin')throw new Error('Account is inactive.');

    const body=await req.json();
    const eventKey=String(body.event_key||'').trim();
    if(!CUSTOMER_EVENTS.has(eventKey)&&!EMPLOYEE_EVENTS.has(eventKey))throw new Error(`Unsupported communication event: ${eventKey}`);
    const requestedChannel=String(body.channel||'email');
    if(requestedChannel==='sms')return json({success:false,skipped:true,error:'SMS provider is not connected yet. Email automation is active.'},400);

    const {data:template,error:templateError}=await admin.from('communication_templates').select('*').eq('event_key',eventKey).eq('is_enabled',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(templateError)throw new Error(`Unable to load communication template: ${templateError.message}`);
    if(!template||template.email_enabled===false)return json({success:true,skipped:true,reason:'Email template disabled or missing.'});

    const audience=EMPLOYEE_EVENTS.has(eventKey)?'employee':'customer';
    let recipientEmail=String(body.recipient_email||'').trim();
    let relatedCustomerId=body.customer_id||null,relatedEmployeeId=body.employee_id||null,relatedCandidateId=body.candidate_id||null,relatedAppointmentId=body.appointment_id||null;
    let appointment:any=null,detailer:any=null,customer:any=null;
    const directRecipient=Boolean(recipientEmail)&&!relatedAppointmentId&&!relatedCandidateId&&!relatedEmployeeId&&!relatedCustomerId;
    if(directRecipient){const allowed=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['communications.manage'];if(!allowed)throw new Error('Communication testing access required.');}

    if(relatedAppointmentId){
      const {data:appt,error}=await admin.from('appointments').select('*').eq('id',relatedAppointmentId).maybeSingle();
      if(error||!appt)throw new Error(error?.message||'Appointment not found.');
      appointment=appt;
      const currentEmployee=await employeeId(admin,user.id);
      const elevated=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['appointments.manage'];
      if(!elevated&&![appt.assigned_employee_id,appt.assigned_manager_id].includes(currentEmployee))throw new Error('Not allowed to send updates for this appointment.');
      relatedCustomerId=relatedCustomerId||appt.user_id;
      recipientEmail=recipientEmail||appt.customer_email||'';
      if(appt.assigned_employee_id){const {data:e}=await admin.from('employees').select('id,name,avatar_url,phone,title').eq('id',appt.assigned_employee_id).maybeSingle();detailer=e||null;}
      if(appt.user_id){const {data:p}=await admin.from('profiles').select('id,full_name,email,phone,avatar_url').eq('id',appt.user_id).maybeSingle();customer=p||null;recipientEmail=recipientEmail||p?.email||'';}
    }
    if(relatedCandidateId){requireHR(actor);const {data:c}=await admin.from('recruiting_candidates').select('email,full_name').eq('id',relatedCandidateId).maybeSingle();recipientEmail=c?.email||recipientEmail;}
    if(relatedEmployeeId&&audience==='employee'){
      const elevated=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['employees.manage']||actor.permissions?.['recruiting.manage'];
      if(!elevated)throw new Error('Employee communication access required.');
      const {data:e}=await admin.from('employees').select('email,name,avatar_url').eq('id',relatedEmployeeId).maybeSingle();recipientEmail=e?.email||recipientEmail;
    }
    if(!recipientEmail)throw new Error('Recipient email is missing.');

    const portalBase=Deno.env.get('OWNER_PORTAL_URL')||'https://ns-auto-luxe-os.vercel.app';
    const vars:Record<string,unknown>={
      company_name:'North Splash Auto Luxe',
      customer_first_name:firstName(customer?.full_name||appointment?.customer_name||String(body.variables?.customer_name||'Customer')),
      customer_name:customer?.full_name||appointment?.customer_name||String(body.variables?.customer_name||'Customer'),
      detailer_name:detailer?.name||String(body.variables?.detailer_name||body.variables?.employee_name||'Your North Splash detailer'),
      detailer_photo:detailer?.avatar_url||String(body.variables?.detailer_photo||''),
      employee_name:detailer?.name||String(body.variables?.employee_name||''),
      service:appointment?.service_name||String(body.variables?.service||body.variables?.service_name||'North Splash service'),
      service_name:appointment?.service_name||String(body.variables?.service_name||'North Splash service'),
      vehicle:appointment?.vehicle_info||String(body.variables?.vehicle||body.variables?.vehicle_info||'Your vehicle'),
      vehicle_info:appointment?.vehicle_info||String(body.variables?.vehicle_info||'Your vehicle'),
      appointment_time:formatDate(appointment?.scheduled_at)||String(body.variables?.appointment_time||''),
      address:appointment?.service_address||String(body.variables?.address||''),
      price:money(appointment?.price??body.variables?.price??body.variables?.amount),
      amount:money(appointment?.price??body.variables?.amount??body.variables?.price),
      eta:String(body.variables?.eta||''),
      portal_link:String(body.variables?.portal_link||`${portalBase}/portal`),
      ...(body.variables||{}),
      ...body,
    };
    const subject=render(String(template.subject||'North Splash Update'),vars);
    const text=render(String(template.body||''),vars);
    const fromEmail=String(template.from_email||defaultFromEmail).replace(/^.*<([^>]+)>.*$/,'$1').trim();
    const fromName=audience==='employee'?'North Splash Admin':defaultFromName;

    const {data:log,error:logError}=await admin.from('communication_logs').insert({event_key:eventKey,audience,recipient_email:recipientEmail,from_email:`${fromName} <${fromEmail}>`,subject,status:'sending',related_customer_id:relatedCustomerId,related_employee_id:relatedEmployeeId,related_candidate_id:relatedCandidateId,related_appointment_id:relatedAppointmentId}).select().single();
    if(logError)throw new Error(`Unable to create communication log: ${logError.message}`);

    const html=emailHtml({subject,message:text,eventKey,vars,detailer,appointment});
    const response=await fetch('https://api.sendgrid.com/v3/mail/send',{
      method:'POST',headers:{Authorization:`Bearer ${sendgridKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({personalizations:[{to:[{email:recipientEmail}],subject}],from:{email:fromEmail,name:fromName},reply_to:{email:replyToEmail,name:'North Splash Auto Luxe'},content:[{type:'text/plain',value:text},{type:'text/html',value:html}]})
    });
    const raw=await response.text();
    if(!response.ok){await admin.from('communication_logs').update({status:'failed',error_message:raw||`SendGrid HTTP ${response.status}`}).eq('id',log.id);throw new Error(raw||`SendGrid rejected the message with HTTP ${response.status}.`);}
    const providerId=response.headers.get('x-message-id');
    await admin.from('communication_logs').update({status:'sent',provider_id:providerId||null,sent_at:new Date().toISOString()}).eq('id',log.id);
    return json({success:true,id:providerId,log_id:log.id});
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error('[send-communication]',message);return json({success:false,error:message},400)}
});

async function employeeId(admin:any,userId:string){const {data}=await admin.from('employees').select('id').eq('user_id',userId).maybeSingle();return data?.id||null}
function requireHR(actor:any){if(!(actor?.role==='admin'||actor?.portal_role==='owner'||actor?.permissions?.['recruiting.manage']))throw new Error('Recruiting access required.')}
function render(template:string,variables:Record<string,unknown>){return template.replace(/{{?\s*([\w.]+)\s*}?}/g,(_m,key)=>{const value=key.split('.').reduce((obj:any,part:string)=>obj?.[part],variables as any);return value==null?'':String(value)})}
function firstName(v:string){return String(v||'Customer').trim().split(/\s+/)[0]||'Customer'}
function formatDate(v?:string|null){if(!v)return'';try{return new Date(v).toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return''}}
function money(v:any){const n=Number(String(v??0).replace(/[$,]/g,''));return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):String(v||'')}
function statusIndex(eventKey:string){const flow=['booking_received','booking_confirmed','detailer_en_route','job_started','job_completed'];const aliases:Record<string,string>={appointment_reminder:'booking_confirmed',appointment_reminder_24h:'booking_confirmed',appointment_reminder_2h:'booking_confirmed',detailer_assigned:'booking_confirmed',detailer_approaching:'detailer_en_route',detailer_arrived:'detailer_en_route',invoice_sent:'job_completed',payment_reminder:'job_completed',payment_received:'job_completed',refund_issued:'job_completed',receipt_ready:'job_completed',review_request:'job_completed',thank_you:'job_completed',rebooking_30d:'job_completed',rebooking_90d:'job_completed'};return Math.max(0,flow.indexOf(aliases[eventKey]||eventKey))}
function emailHtml({subject,message,eventKey,vars,detailer,appointment}:{subject:string;message:string;eventKey:string;vars:any;detailer:any;appointment:any}){
  const body=escapeHtml(message).replace(/\n/g,'<br/>');const idx=statusIndex(eventKey);const steps=['Appointment','Confirmed','En Route','In Progress','Complete'];
  const detailerBlock=detailer?`<div style="display:flex;align-items:center;gap:12px;margin:18px 0;padding:14px;background:#0f0f0f;border:1px solid #2d2617;border-radius:12px">${detailer.avatar_url?`<img src="${escapeHtml(detailer.avatar_url)}" width="46" height="46" style="border-radius:50%;object-fit:cover;border:1px solid #d9ad4a"/>`:`<div style="width:46px;height:46px;border-radius:50%;background:#241d0f;color:#e7c967;display:grid;place-items:center;font-weight:800">${escapeHtml(firstName(detailer.name).slice(0,1))}</div>`}<div><div style="font-size:11px;color:#a8a8a3">ASSIGNED DETAILER</div><strong style="font-size:15px">${escapeHtml(detailer.name)}</strong></div></div>`:'';
  const details=appointment?`<div style="margin:20px 0;padding:18px;background:#111;border:1px solid #272727;border-radius:14px"><div style="font-size:18px;font-weight:800;color:#f3f3ef">${escapeHtml(String(vars.service||''))}</div><div style="margin-top:5px;color:#aaa">${escapeHtml(String(vars.vehicle||''))}</div><div style="margin-top:12px;color:#d8b85a;font-weight:700">${escapeHtml(String(vars.appointment_time||''))}</div>${vars.address?`<div style="margin-top:5px;color:#aaa">${escapeHtml(String(vars.address))}</div>`:''}<div style="margin-top:14px;font-size:20px;font-weight:900;color:#fff">${escapeHtml(String(vars.price||''))}</div></div>`:'';
  const status=steps.map((s,i)=>`<td style="text-align:center;width:20%;font-size:10px;color:${i<=Math.min(4,idx)?'#e1bd55':'#666'}"><div style="height:4px;border-radius:8px;background:${i<=Math.min(4,idx)?'#d9ad4a':'#292929'};margin-bottom:7px"></div>${s}</td>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#070707;font-family:Arial,Helvetica,sans-serif;color:#f6f6f3"><div style="max-width:640px;margin:0 auto;padding:28px 14px"><div style="background:linear-gradient(135deg,#17130c,#090909);padding:25px 28px;border:1px solid #2e2716;border-radius:18px 18px 0 0"><div style="font-size:13px;letter-spacing:3px;font-weight:900;color:#fff">NORTH SPLASH</div><div style="font-size:10px;letter-spacing:4px;color:#d9ad4a;margin-top:3px">AUTO LUXE</div></div><div style="background:#0b0b0b;padding:30px 28px;border:1px solid #252525;border-top:0;border-radius:0 0 18px 18px"><div style="font-size:10px;letter-spacing:2px;color:#b28a31;font-weight:800">APPOINTMENT UPDATE</div><h1 style="font-size:26px;line-height:1.2;margin:8px 0 18px;color:#fff">${escapeHtml(subject)}</h1>${details}${detailerBlock}<div style="font-size:15px;line-height:1.7;color:#d6d6d1">${body}</div><a href="${escapeHtml(String(vars.portal_link||'#'))}" style="display:inline-block;margin:24px 0 22px;padding:13px 20px;border-radius:9px;background:#d9ad4a;color:#0a0a0a;text-decoration:none;font-weight:900;font-size:13px">VIEW APPOINTMENT</a><table style="width:100%;border-collapse:collapse;margin:10px 0 24px"><tr>${status}</tr></table><div style="border-top:1px solid #222;padding-top:18px;color:#777;font-size:11px;line-height:1.6">North Splash Auto Luxe<br/>Premium mobile vehicle care<br/>Support: support@northsplash.com</div></div></div></body></html>`
}
function escapeHtml(value:string){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c))}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors})}
