-- North Splash OS V27
-- Hybrid work capabilities, message performance, and automation reliability.
-- Safe to run more than once.

alter table if exists public.employees
  add column if not exists work_modes text[] not null default '{}'::text[];

-- Backfill the capabilities used by assignment pickers without changing the employee's
-- primary system role. This lets one person work in more than one operational mode.
update public.employees
set work_modes = case
  when department='Ownership' then array['owner','d2d','detailer','manager']::text[]
  when role='d2d_agent' then array['d2d']::text[]
  when role='detailer' then array['detailer']::text[]
  when role='manager' then array['manager']::text[]
  when role='admin' then array['admin','manager']::text[]
  else coalesce(work_modes,'{}'::text[])
end
where coalesce(array_length(work_modes,1),0)=0;

create index if not exists idx_employees_work_modes_gin on public.employees using gin(work_modes);
create index if not exists idx_employee_message_reads_user on public.employee_message_reads(user_id,last_read_at desc);
create index if not exists idx_employee_messages_sender_time on public.employee_messages(sender_user_id,created_at desc);
create index if not exists idx_automation_events_pending_process on public.automation_events(status,process_after) where status='pending';

create or replace function public.ensure_owner_field_employee()
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  e public.employees;
begin
  select * into p from public.profiles where id=auth.uid();
  if auth.uid() is null or coalesce(p.portal_role,'') <> 'owner' then
    raise exception 'Owner access required';
  end if;

  select * into e from public.employees where user_id=auth.uid() limit 1;
  if found then
    update public.employees
      set work_modes=(select array_agg(distinct x) from unnest(coalesce(work_modes,'{}'::text[]) || array['owner','d2d','detailer','manager']) x),
          department=coalesce(nullif(department,''),'Ownership')
      where id=e.id returning * into e;
    return e;
  end if;

  if p.email is not null then
    select * into e from public.employees where lower(email)=lower(p.email) limit 1;
    if found then
      update public.employees
        set user_id=auth.uid(),
            work_modes=(select array_agg(distinct x) from unnest(coalesce(work_modes,'{}'::text[]) || array['owner','d2d','detailer','manager']) x),
            department=coalesce(nullif(department,''),'Ownership')
        where id=e.id returning * into e;
      return e;
    end if;
  end if;

  insert into public.employees(
    user_id,name,email,role,title,department,status,employment_level,pay_type,
    hourly_rate,weekly_base,commission_rate,jobs_completed,total_earnings,notes,custom_compensation,work_modes
  ) values(
    auth.uid(),coalesce(nullif(p.full_name,''),split_part(coalesce(p.email,'North Splash Owner'),'@',1)),
    p.email,'detailer','Owner / Field Operator','Ownership','active',5,'custom',
    0,0,0,0,0,'Owner field profile. Used for D2D, detailing, and management assignments.','{"rules":[]}'::jsonb,
    array['owner','d2d','detailer','manager']::text[]
  ) returning * into e;
  return e;
end $$;

revoke all on function public.ensure_owner_field_employee() from public;
grant execute on function public.ensure_owner_field_employee() to authenticated;

comment on column public.employees.work_modes is
'Operational capabilities independent of the employee primary system role. Used for hybrid/owner D2D, detailing, and management assignment.';
