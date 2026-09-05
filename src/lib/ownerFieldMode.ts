
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/supabase';

export async function ensureOwnerFieldEmployee(userId:string, name?:string|null, email?:string|null):Promise<Employee|null>{
  const rpc=await supabase.rpc('ensure_owner_field_employee');
  if(!rpc.error&&rpc.data)return rpc.data as Employee;
  const existing=await supabase.from('employees').select('*').eq('user_id',userId).maybeSingle();
  if(existing.data)return existing.data as Employee;
  if(email){
    const byEmail=await supabase.from('employees').select('*').ilike('email',email).maybeSingle();
    if(byEmail.data){
      const linked=await supabase.from('employees').update({user_id:userId}).eq('id',byEmail.data.id).select().single();
      if(linked.data)return linked.data as Employee;
    }
  }
  const created=await supabase.from('employees').insert({
    user_id:userId,name:name||'North Splash Owner',email:email||null,role:'detailer',title:'Owner / Field Operator',
    department:'Ownership',status:'active',employment_level:5,pay_type:'custom',hourly_rate:0,weekly_base:0,commission_rate:0,
    jobs_completed:0,total_earnings:0,notes:'Owner field profile. Used for D2D and detailing assignments.',work_modes:['owner','d2d','detailer','manager']
  }).select().single();
  return created.data as Employee|null;
}
