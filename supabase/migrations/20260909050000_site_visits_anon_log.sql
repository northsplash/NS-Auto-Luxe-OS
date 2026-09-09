-- Public homepage logs a row in site_visits. RLS already allowed INSERT, but
-- PostgREST returned 401 because table privileges were never granted to anon:
--   permission denied for table site_visits
--   Grant the required privileges: GRANT INSERT ON public.site_visits TO anon;
-- SECURITY DEFINER RPC is the same pattern as website apply: works even when
-- table GRANTs are locked down. Owner (portal_role) can read visits, not only role=admin.

grant insert on table public.site_visits to anon, authenticated;
grant select on table public.site_visits to authenticated;

drop policy if exists "anon_insert_visits" on public.site_visits;
create policy "anon_insert_visits" on public.site_visits
for insert
to anon, authenticated
with check (true);

drop policy if exists "admin_select_visits" on public.site_visits;
create policy "admin_select_visits" on public.site_visits
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or p.portal_role = 'owner')
  )
);

create or replace function public.log_site_visit(
  p_page text default '/',
  p_referrer text default null,
  p_session_id text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  page_path text := left(coalesce(nullif(btrim(p_page), ''), '/'), 200);
  ref_text text := left(nullif(btrim(p_referrer), ''), 500);
  sid text := left(nullif(btrim(p_session_id), ''), 80);
  ua text := left(nullif(btrim(p_user_agent), ''), 400);
begin
  begin
    insert into public.site_visits (page, referrer, session_id, user_agent, user_id)
    values (page_path, ref_text, sid, ua, auth.uid());
  exception when undefined_column then
    insert into public.site_visits (page, referrer, session_id, user_agent)
    values (page_path, ref_text, sid, ua);
  end;
end;
$$;

revoke all on function public.log_site_visit(text, text, text, text) from public;
grant execute on function public.log_site_visit(text, text, text, text) to anon, authenticated;
