-- North Splash Auto Luxe — D2D sales presentation analytics
-- Tracks presentation usage and selected offers without storing card/payment data.

create table if not exists public.d2d_presentation_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  lead_id uuid null references public.leads(id) on delete set null,
  territory_id uuid null references public.lead_territories(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists d2d_presentation_events_employee_created_idx
  on public.d2d_presentation_events(employee_id, created_at desc);
create index if not exists d2d_presentation_events_lead_idx
  on public.d2d_presentation_events(lead_id)
  where lead_id is not null;

alter table public.d2d_presentation_events enable row level security;
grant select, insert on table public.d2d_presentation_events to authenticated;

drop policy if exists "d2d_insert_own_presentation_events" on public.d2d_presentation_events;
create policy "d2d_insert_own_presentation_events"
on public.d2d_presentation_events
for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid()
  )
);

drop policy if exists "d2d_read_own_presentation_events" on public.d2d_presentation_events;
create policy "d2d_read_own_presentation_events"
on public.d2d_presentation_events
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid()
  )
);
