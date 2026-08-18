import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type':'application/json',
};

const allowed=new Set([
  'appointments','automation_events','automation_rules','availability','business_notifications','business_tasks',
  'communication_logs','communication_templates','crew_alerts','crew_coaching_notes','crew_groups','crm_notes',
  'customer_vehicles','d2d_daily_goals','employee_documents','employee_message_channels','employee_messages','employee_shifts',
  'employees','equipment_assets','expenses','incident_reports','inventory_items','lead_activities','lead_contact_attempts',
  'lead_territories','leads','marketing_campaigns','pay_settings','payments','payroll_runs','profiles','purchase_requests',
  'recruiting_candidates','recruiting_events','rep_locations','sales_records','site_visits','subscriptions','territory_doors',
  'territory_routes','time_entries','time_entry_breaks','time_off_requests','training_assignments','training_attempts','training_courses',
  'vehicle_inspections','audit_logs'
]);
const protectedTables=new Set(['payments','payroll_runs','sales_records','expenses','time_entries','time_entry_breaks','communication_logs','audit_logs','subscriptions']);
const archiveTables=new Set(['leads','lead_territories','automation_rules','communication_templates']);

function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')||'';
    let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
    if(!key&&raw){try{const parsed=JSON.parse(raw);key=parsed?.default||parsed?.service_role||parsed?.serviceRole||''}catch{}}
    if(!url||!key)throw new Error('Supabase server credentials are missing.');
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)throw new Error('Unauthorized');
    const {data:actor}=await admin.from('profiles').select('id,role,portal_role,is_active').eq('id',user.id).maybeSingle();
    if(!actor||(actor.is_active===false)||!(actor.role==='admin'||actor.portal_role==='owner'))throw new Error('Admin data access required.');

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||'');
    const table=String(body.table||'');
    if(!allowed.has(table))throw new Error('This table is not available in Data Management.');

    if(action==='list'){
      const limit=Math.min(Math.max(Number(body.limit)||100,1),250);
      let q=admin.from(table).select('*').limit(limit);
      if(table==='profiles')q=q.eq('role','customer');
      const {data,error}=await q;
      if(error)throw error;
      const rows=[...(data||[])].sort((a:any,b:any)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));
      return response({success:true,rows,protected:protectedTables.has(table),archive:archiveTables.has(table)});
    }

    const ids=Array.isArray(body.ids)?body.ids.map(String).filter(Boolean).slice(0,100):[];
    if(!ids.length)throw new Error('No records selected.');

    if(action==='archive'){
      if(!archiveTables.has(table))throw new Error('This record type does not support archive.');
      let patch:any={};
      if(table==='lead_territories')patch={status:'inactive'};
      if(table==='leads'){const cooldown=new Date();cooldown.setMonth(cooldown.getMonth()+6);patch={archived_at:new Date().toISOString(),archive_reason:'admin_archive',cooldown_until:cooldown.toISOString(),reactivation_status:'cooldown'};}
      if(table==='automation_rules'||table==='communication_templates')patch={is_enabled:false};
      const {error}=await admin.from(table).update(patch).in('id',ids);
      if(error)throw error;
      await admin.from('audit_logs').insert({action:'data.archived',entity_type:table,entity_id:ids.length===1?ids[0]:null,details:{count:ids.length,ids}}).catch(()=>{});
      return response({success:true,count:ids.length});
    }

    if(action==='delete'){
      if(protectedTables.has(table))throw new Error('This record type is protected because it affects financial, payroll, communication, or audit history.');
      if(table==='profiles'&&ids.includes(user.id))throw new Error('You cannot delete your own administrator account.');
      if(table==='profiles'){
        for(const id of ids){
          const {data:p}=await admin.from('profiles').select('role').eq('id',id).maybeSingle();
          if(p?.role&&p.role!=='customer')throw new Error('Only customer profiles can be removed from this screen.');
          await admin.from('profiles').delete().eq('id',id);
          await admin.auth.admin.deleteUser(id).catch(()=>{});
        }
      }else{
        const {error}=await admin.from(table).delete().in('id',ids);
        if(error)throw error;
      }
      await admin.from('audit_logs').insert({action:'data.deleted',entity_type:table,entity_id:ids.length===1?ids[0]:null,details:{count:ids.length,ids}}).catch(()=>{});
      return response({success:true,count:ids.length});
    }
    throw new Error('Unsupported action.');
  }catch(e){return response({error:e instanceof Error?e.message:String(e)},400)}
});
