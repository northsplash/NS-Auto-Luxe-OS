-- North Splash Auto Luxe — Owner full-access policy
-- Owners are separate from Admin in the UI, but receive full authenticated access
-- to the operating data needed to run the company.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid()
      and portal_role='owner'
      and coalesce(is_active,true)=true
  );
$$;

grant execute on function public.is_owner() to authenticated;

-- Preserve existing Admin behavior while allowing Owners through policies that use is_admin().
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid()
      and (role='admin' or portal_role='owner')
      and coalesce(is_active,true)=true
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Add a consistent Owner policy to every public table. This is intentionally broad:
-- the Owner Portal is the top-level business workspace and the user requested full access.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('drop policy if exists owner_full_access on public.%I',r.tablename);
    execute format('create policy owner_full_access on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())',r.tablename);
  end loop;
end $$;
