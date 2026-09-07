-- Website job applications land on the recruiting board without a staff login.

alter table public.recruiting_candidates
  add column if not exists city text,
  add column if not exists years_experience numeric,
  add column if not exists authorized_to_work boolean;

grant insert on table public.recruiting_candidates to anon;

drop policy if exists "website_job_apply" on public.recruiting_candidates;
create policy "website_job_apply" on public.recruiting_candidates
for insert
to anon
with check (
  stage = 'applied'
  and source = 'Website'
  and full_name is not null
  and char_length(btrim(full_name)) between 2 and 120
  and email is not null
  and phone is not null
  and position in ('detailer', 'd2d_agent', 'manager')
);
