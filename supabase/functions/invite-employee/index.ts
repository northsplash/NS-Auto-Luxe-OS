import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type':'application/json'
};
const ADMIN_FROM='North Splash Admin <Admin@northsplash.com>';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,resendKey=Deno.env.get('RESEND_API_KEY');
    if(!url||!key)throw new Error('Supabase server credentials are missing.');
    const admin=createClient(url,key,{auth:{persistSession:false}});
    const token=(req.headers.get('Authorization')||'').replace('Bearer ','');
    const {data:{user}}=await admin.auth.getUser(token);
    if(!user)throw new Error('Unauthorized');
    const {data:actor}=await admin.from('profiles').select('role,portal_role,permissions').eq('id',user.id).single();
    if(!(actor?.role==='admin'||actor?.portal_role==='owner'||actor?.permissions?.['employees.manage']))throw new Error('Owner/employee-management access required.');

    const {employee_id,portal_role='employee',redirect_to,action='invite'}=await req.json();
    const {data:emp,error:ee}=await admin.from('employees').select('*').eq('id',employee_id).single();
    if(ee||!emp?.email)throw new Error('Employee must have an email address.');

    const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});
    let authUser=listed.data.users.find(u=>u.email?.toLowerCase()===emp.email.toLowerCase());

    if(action==='disable'){
      if(authUser){
        await admin.auth.admin.updateUserById(authUser.id,{ban_duration:'876000h'});
        await admin.from('profiles').update({is_active:false}).eq('id',authUser.id);
      }
      await admin.from('employees').update({status:'inactive'}).eq('id',emp.id);
      await audit(admin,user.id,'employee_access_disabled','employee',emp.id,{email:emp.email});
      return json({success:true,disabled:true});
    }

    if(action==='restore'){
      if(!authUser)throw new Error('No login exists yet. Send an invite first.');
      await admin.auth.admin.updateUserById(authUser.id,{ban_duration:'none'});
      await admin.from('profiles').update({is_active:true}).eq('id',authUser.id);
      await admin.from('employees').update({status:'active'}).eq('id',emp.id);
      await audit(admin,user.id,'employee_access_restored','employee',emp.id,{});
      return json({success:true,restored:true});
    }

    const resolvedRole=portal_role==='owner'?'admin':portal_role==='d2d'?'d2d_agent':portal_role==='customer'?'customer':'employee';
    const redirect=redirect_to||'https://northsplash.com/reset-password';
    let actionLink='';
    let created=false;

    if(!authUser){
      // Create the user without relying on Supabase's default invite email. We send
      // the generated action link ourselves from Admin@northsplash.com.
      const createdUser=await admin.auth.admin.createUser({email:emp.email,email_confirm:true,user_metadata:{full_name:emp.name}});
      if(createdUser.error)throw createdUser.error;
      authUser=createdUser.data.user;
      created=true;
    }
    if(!authUser)throw new Error('Could not create or find login.');

    await admin.auth.admin.updateUserById(authUser.id,{ban_duration:'none'}).catch(()=>{});
    await admin.from('profiles').upsert({id:authUser.id,email:emp.email,full_name:emp.name,phone:emp.phone,role:resolvedRole,portal_role,is_active:true},{onConflict:'id'});
    await admin.from('employees').update({user_id:authUser.id,status:emp.status==='inactive'?'active':emp.status,portal_role,last_invited_at:new Date().toISOString()}).eq('id',emp.id);

    const linkType=action==='reset'?'recovery':'magiclink';
    const generated=await admin.auth.admin.generateLink({type:linkType as any,email:emp.email,options:{redirectTo:redirect}});
    if(generated.error)throw generated.error;
    actionLink=generated.data.properties?.action_link||'';

    if(resendKey&&actionLink){
      const subject=action==='reset'?'Reset your North Splash employee access':'Your North Splash employee account is ready';
      const intro=action==='reset'?'Use the secure link below to reset your account access.':'Your North Splash employee portal has been created. Use the secure link below to sign in and finish setup.';
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:ADMIN_FROM,to:[emp.email],reply_to:'Admin@northsplash.com',subject,html:mail(emp.name,intro,actionLink),text:`${intro}\n\n${actionLink}`})});
      if(!response.ok){const data=await response.json();throw new Error(data?.message||'Unable to send employee account email.');}
    }

    await seedOnboarding(admin,emp.id,portal_role);
    await audit(admin,user.id,action==='reset'?'employee_access_reset':'employee_invited','employee',emp.id,{email:emp.email,portal_role,created});
    return json({success:true,created,user_id:authUser.id,email:emp.email,portal_role,emailed:Boolean(resendKey),action_link:resendKey?undefined:actionLink});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},400)}
});

async function seedOnboarding(admin:any,employeeId:string,portalRole:string){
  const base=[
    ['Complete employee profile','Confirm your contact and emergency information.','profile'],
    ['Review company policies','Read the North Splash operating and conduct policies.','policy'],
    ['Complete required training','Open Training Center and finish required courses.','training'],
    ['Confirm first schedule','Review your first assigned shift and work location.','schedule'],
  ];
  if(portalRole==='d2d')base.push(['Review territory workflow','Learn house statuses, Do Not Knock rules, routing and lead follow-up.','d2d']);
  if(portalRole==='employee')base.push(['Review job workflow','Learn inspection, photos, checklist, QC and completion standards.','detailer']);
  for(const [title,description,category] of base){
    const existing=await admin.from('onboarding_tasks').select('id').eq('employee_id',employeeId).eq('title',title).maybeSingle();
    if(!existing.data)await admin.from('onboarding_tasks').insert({employee_id:employeeId,title,description,category,required:true,status:'pending'});
  }
}
async function audit(admin:any,actor:string,action:string,entityType:string,entityId:string,details:any){await admin.from('audit_logs').insert({actor_user_id:actor,action,entity_type:entityType,entity_id:entityId,details}).catch(()=>{})}
function mail(name:string,intro:string,link:string){return `<!doctype html><html><body style="margin:0;background:#f6f1eb;font-family:Arial,sans-serif;color:#211811"><div style="max-width:620px;margin:auto;padding:34px 18px"><div style="background:#17110d;color:#fff;padding:22px 26px;border-radius:16px 16px 0 0"><b style="letter-spacing:3px">NORTH SPLASH</b><div style="font-size:10px;letter-spacing:4px;color:#c9a96e">AUTO LUXE</div></div><div style="background:#fff;padding:28px 26px;border:1px solid #eadfd3;border-top:0;border-radius:0 0 16px 16px"><h2>Welcome, ${esc(name)}</h2><p style="line-height:1.6">${esc(intro)}</p><p><a href="${esc(link)}" style="display:inline-block;background:#9d7651;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:700">Open North Splash</a></p><p style="color:#87776a;font-size:12px;margin-top:26px">Questions? Reply to Admin@northsplash.com.</p></div></div></body></html>`}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c))}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors})}
