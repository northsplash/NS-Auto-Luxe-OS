import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type':'application/json'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')||'';
    let key='';
    const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
    if(raw){try{const parsed=JSON.parse(raw);key=parsed?.default||parsed?.service_role||parsed?.serviceRole||''}catch{}}
    if(!key) key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!url||!key) throw new Error('Supabase server credentials are missing.');
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    if(!token) return json({success:false,error:'Unauthorized'},401);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user?.email) return json({success:false,error:'Unauthorized'},401);
    const email=user.email.trim().toLowerCase();
    const {data:rows,error}=await admin.from('appointments')
      .update({user_id:user.id})
      .is('user_id',null)
      .ilike('customer_email',email)
      .select('id');
    if(error) throw error;
    return json({success:true,linked:(rows||[]).length});
  }catch(e){return json({success:false,error:e instanceof Error?e.message:String(e)},400)}
});
