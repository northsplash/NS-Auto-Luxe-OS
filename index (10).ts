import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type':'application/json',
};
const CUSTOMER_FROM='North Splash Auto Luxe <noreply@northsplash.com>';
const EMPLOYEE_FROM='North Splash Admin <Admin@northsplash.com>';
const EMPLOYEE_EVENTS=new Set(['application_received','first_interview','second_interview','background_check','job_offer','offer_accepted','offer_declined','onboarding','start_date','training_assigned','employee_invite','schedule_changed']);
const CUSTOMER_EVENTS=new Set(['booking_received','booking_confirmed','booking_declined','appointment_reminder','appointment_rescheduled','appointment_cancelled','detailer_assigned','detailer_en_route','detailer_arrived','job_started','job_completed','receipt_ready','review_request','estimate_sent','membership_update']);

function serverKey(){
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(legacy)return legacy;
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(!raw)return '';
  try{const parsed=JSON.parse(raw);return parsed?.default||parsed?.service_role||parsed?.serviceRole||''}catch(e){console.error('[send-communication] failed parsing SUPABASE_SECRET_KEYS',e);return ''}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
    const serviceKey=serverKey();
    const resendKey=Deno.env.get('RESEND_API_KEY')||'';
    console.log('[send-communication] Environment check',{hasSupabaseUrl:Boolean(supabaseUrl),hasServerKey:Boolean(serviceKey),hasResendKey:Boolean(resendKey)});
    if(!supabaseUrl||!serviceKey)throw new Error('Supabase server credentials are missing.');
    if(!resendKey)throw new Error('RESEND_API_KEY is missing from Edge Function secrets.');

    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const authHeader=req.headers.get('Authorization')||'';
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):'';
    if(!token)throw new Error('Authorization token is missing.');
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)throw new Error(`Unauthorized${userError?`: ${userError.message}`:''}`);
    const {data:actor,error:actorError}=await admin.from('profiles').select('id,role,portal_role,permissions,is_active').eq('id',user.id).maybeSingle();
    if(actorError)throw new Error(`Unable to load user permissions: ${actorError.message}`);
    if(!actor)throw new Error('User profile could not be found.');
    if(actor.is_active===false&&actor.role!=='admin')throw new Error('Account is inactive.');

    const body=await req.json();
    const eventKey=String(body.event_key||'').trim();
    if(!CUSTOMER_EVENTS.has(eventKey)&&!EMPLOYEE_EVENTS.has(eventKey))throw new Error(`Unsupported communication event: ${eventKey}`);
    const {data:template,error:templateError}=await admin.from('communication_templates').select('*').eq('event_key',eventKey).eq('is_enabled',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(templateError)throw new Error(`Unable to load communication template: ${templateError.message}`);
    if(!template)return json({success:true,skipped:true,reason:'Template disabled or missing.'});

    const audience=EMPLOYEE_EVENTS.has(eventKey)?'employee':'customer';
    let recipientEmail=String(body.recipient_email||'').trim();
    let relatedCustomerId=body.customer_id||null,relatedEmployeeId=body.employee_id||null,relatedCandidateId=body.candidate_id||null,relatedAppointmentId=body.appointment_id||null;
    const directRecipient=Boolean(recipientEmail)&&!relatedAppointmentId&&!relatedCandidateId&&!relatedEmployeeId&&!relatedCustomerId;
    if(directRecipient){const allowed=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['communications.manage'];if(!allowed)throw new Error('Communication testing access required.');}

    if(relatedAppointmentId){
      const {data:appt,error}=await admin.from('appointments').select('id,user_id,assigned_employee_id,assigned_manager_id,customer_email').eq('id',relatedAppointmentId).maybeSingle();
      if(error||!appt)throw new Error(error?.message||'Appointment not found.');
      const currentEmployee=await employeeId(admin,user.id);
      const elevated=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['appointments.manage'];
      if(!elevated&&![appt.assigned_employee_id,appt.assigned_manager_id].includes(currentEmployee))throw new Error('Not allowed to send updates for this appointment.');
      relatedCustomerId=relatedCustomerId||appt.user_id;
      recipientEmail=recipientEmail||appt.customer_email||'';
      if(!recipientEmail&&appt.user_id){const {data:p}=await admin.from('profiles').select('email').eq('id',appt.user_id).maybeSingle();recipientEmail=p?.email||'';}
    }
    if(relatedCandidateId){requireHR(actor);const {data:c}=await admin.from('recruiting_candidates').select('email').eq('id',relatedCandidateId).maybeSingle();recipientEmail=c?.email||recipientEmail;}
    if(relatedEmployeeId&&audience==='employee'){
      const elevated=actor.role==='admin'||actor.portal_role==='owner'||actor.permissions?.['employees.manage']||actor.permissions?.['recruiting.manage'];
      if(!elevated)throw new Error('Employee communication access required.');
      const {data:e}=await admin.from('employees').select('email').eq('id',relatedEmployeeId).maybeSingle();recipientEmail=e?.email||recipientEmail;
    }
    if(!recipientEmail)throw new Error('Recipient email is missing.');

    const vars:Record<string,unknown>={...(body.variables||{}),...body};
    const subject=render(String(template.subject||'North Splash Update'),vars),text=render(String(template.body||''),vars);
    const from=audience==='employee'?EMPLOYEE_FROM:CUSTOMER_FROM;
    const replyTo=audience==='employee'?'Admin@northsplash.com':undefined;
    const {data:log,error:logError}=await admin.from('communication_logs').insert({event_key:eventKey,audience,recipient_email:recipientEmail,from_email:from,subject,status:'sending',related_customer_id:relatedCustomerId,related_employee_id:relatedEmployeeId,related_candidate_id:relatedCandidateId,related_appointment_id:relatedAppointmentId}).select().single();
    if(logError)throw new Error(`Unable to create communication log: ${logError.message}`);

    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[recipientEmail],subject,html:emailHtml(subject,text),text,...(replyTo?{reply_to:replyTo}:{})})});
    const raw=await response.text();let provider:any={};try{provider=raw?JSON.parse(raw):{}}catch{provider={message:raw}}
    if(!response.ok){await admin.from('communication_logs').update({status:'failed',error_message:provider?.message||provider?.error||raw||`HTTP ${response.status}`}).eq('id',log.id);throw new Error(provider?.message||provider?.error||`Email provider rejected the message with HTTP ${response.status}.`);}
    await admin.from('communication_logs').update({status:'sent',provider_id:provider?.id||null,sent_at:new Date().toISOString()}).eq('id',log.id);
    return json({success:true,id:provider?.id,log_id:log.id});
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error('[send-communication] REQUEST FAILED:',message);return json({success:false,error:message},400)}
});

async function employeeId(admin:any,userId:string){const {data}=await admin.from('employees').select('id').eq('user_id',userId).maybeSingle();return data?.id||null}
function requireHR(actor:any){if(!(actor?.role==='admin'||actor?.portal_role==='owner'||actor?.permissions?.['recruiting.manage']))throw new Error('Recruiting access required.')}
function render(template:string,variables:Record<string,unknown>){return template.replace(/{{\s*([\w.]+)\s*}}/g,(_m,key)=>{const value=key.split('.').reduce((obj:any,part:string)=>obj?.[part],variables as any);return value==null?'':String(value)})}
function emailHtml(subject:string,message:string){const body=escapeHtml(message).replace(/\n/g,'<br/>');return `<!doctype html><html><body style="margin:0;background:#f6f1eb;font-family:Arial,sans-serif;color:#211811"><div style="max-width:620px;margin:0 auto;padding:34px 18px"><div style="background:#17110d;color:#fff;padding:22px 26px;border-radius:16px 16px 0 0"><div style="font-size:12px;letter-spacing:3px;font-weight:700">NORTH SPLASH</div><div style="font-size:10px;letter-spacing:4px;color:#c9a96e">AUTO LUXE</div></div><div style="background:#fff;padding:28px 26px;border:1px solid #eadfd3;border-top:0;border-radius:0 0 16px 16px"><h1 style="font-size:24px;margin:0 0 18px">${escapeHtml(subject)}</h1><div style="font-size:15px;line-height:1.65">${body}</div><p style="margin-top:28px;color:#87776a;font-size:12px">North Splash Auto Luxe</p></div></div></body></html>`}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c))}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors})}
