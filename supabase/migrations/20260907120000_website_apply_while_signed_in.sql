-- Website applications can land even when the visitor already has a portal
-- session (owner testing /apply while signed in). Keep the guest path too.

grant insert on table public.recruiting_candidates to anon, authenticated;

drop policy if exists "website_job_apply" on public.recruiting_candidates;
create policy "website_job_apply" on public.recruiting_candidates
for insert
to anon, authenticated
with check (
  stage = 'applied'
  and source = 'Website'
  and full_name is not null
  and char_length(btrim(full_name)) between 2 and 120
  and email is not null
  and phone is not null
  and position in ('detailer', 'd2d_agent', 'manager')
);
