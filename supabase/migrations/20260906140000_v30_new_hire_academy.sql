-- V30: Door-to-door and detailing academies for new hires.
-- Safe to run more than once. Lesson/quiz bodies are also upserted by the Owner Training tab.

insert into public.training_courses (
  id, title, description, category, required_role, passing_score, duration_minutes, manager_signoff_required, status
) values
  (
    '7c0d2d00-a1b2-4c3d-8e9f-000000000001',
    'Door-to-door academy',
    'SalesRabbit playbook for North Splash: map, pins, knock colors, the door script, and the next house. Finish this before you canvass live.',
    'd2d_academy',
    'd2d_agent',
    80,
    45,
    true,
    'active'
  ),
  (
    '7c0d3700-a1b2-4c3d-8e9f-000000000002',
    'Detailing academy',
    'Housecall Pro job packet plus Uber-style live status. Inspection, photos, checklist, sign-off, and QC before you go live.',
    'detail_academy',
    'detailer',
    80,
    50,
    true,
    'active'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  required_role = excluded.required_role,
  passing_score = excluded.passing_score,
  duration_minutes = excluded.duration_minutes,
  manager_signoff_required = excluded.manager_signoff_required,
  status = 'active',
  updated_at = now();

-- New hires must be able to start and finish their own academy assignment.
alter table public.training_assignments enable row level security;
drop policy if exists ns_training_assignments_self_write on public.training_assignments;
create policy ns_training_assignments_self_write on public.training_assignments
  for insert to authenticated
  with check (employee_id = public.current_employee_id());
drop policy if exists ns_training_assignments_self_update on public.training_assignments;
create policy ns_training_assignments_self_update on public.training_assignments
  for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

insert into public.training_assignments (course_id, employee_id, status, assigned_at)
select '7c0d2d00-a1b2-4c3d-8e9f-000000000001', e.id, 'assigned', now()
from public.employees e
where coalesce(e.status, 'active') not in ('inactive', 'terminated')
  and (e.role = 'd2d_agent' or e.department = 'Ownership' or 'd2d' = any(coalesce(e.work_modes, '{}'::text[])))
on conflict (course_id, employee_id) do nothing;

insert into public.training_assignments (course_id, employee_id, status, assigned_at)
select '7c0d3700-a1b2-4c3d-8e9f-000000000002', e.id, 'assigned', now()
from public.employees e
where coalesce(e.status, 'active') not in ('inactive', 'terminated')
  and (e.role = 'detailer' or e.department = 'Ownership' or 'detailer' = any(coalesce(e.work_modes, '{}'::text[])))
on conflict (course_id, employee_id) do nothing;
