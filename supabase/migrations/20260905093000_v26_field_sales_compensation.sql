-- North Splash OS V26
-- Field-sales / flexible-compensation reliability helpers.
-- Safe to run more than once.

alter table if exists public.employees
  add column if not exists custom_compensation jsonb not null default '{}'::jsonb;

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
  if found then return e; end if;

  if p.email is not null then
    select * into e from public.employees where lower(email)=lower(p.email) limit 1;
    if found then
      update public.employees set user_id=auth.uid() where id=e.id returning * into e;
      return e;
    end if;
  end if;

  insert into public.employees(
    user_id,name,email,role,title,department,status,employment_level,pay_type,
    hourly_rate,weekly_base,commission_rate,jobs_completed,total_earnings,notes,custom_compensation
  ) values(
    auth.uid(),coalesce(nullif(p.full_name,''),split_part(coalesce(p.email,'North Splash Owner'),'@',1)),
    p.email,'detailer','Owner / Field Operator','Ownership','active',5,'custom',
    0,0,0,0,0,'Owner field profile. Used for D2D and detailing assignments.','{"rules":[]}'::jsonb
  ) returning * into e;
  return e;
end $$;

revoke all on function public.ensure_owner_field_employee() from public;
grant execute on function public.ensure_owner_field_employee() to authenticated;

comment on function public.ensure_owner_field_employee() is
'Creates or returns the authenticated owner''s shared field employee record so the owner can take D2D leads and detailing assignments without changing owner permissions.';
