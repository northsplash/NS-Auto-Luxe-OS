-- North Splash Auto Luxe OS V16
-- Dispatch command center, shared realtime scheduling and lead intelligence hardening.

alter table public.appointments
  add column if not exists dispatch_priority integer not null default 0,
  add column if not exists customer_notified_at timestamptz,
  add column if not exists review_requested_at timestamptz,
  add column if not exists quality_score numeric,
  add column if not exists route_sequence_locked boolean not null default false;

create index if not exists idx_appointments_dispatch_v16
  on public.appointments(scheduled_at, dispatch_status, assigned_employee_id, dispatch_priority desc);
create index if not exists idx_appointments_live_status_v16
  on public.appointments(assigned_employee_id, field_status, scheduled_at);
create index if not exists idx_leads_next_action_v16
  on public.leads(assigned_employee_id, next_action_at, lead_score desc, priority desc);
create index if not exists idx_incidents_open_v16
  on public.incident_reports(status, severity, created_at desc);

-- Keep lead scoring consistent even when leads are edited from different portals.
create or replace function public.ns_v16_score_lead() returns trigger
language plpgsql set search_path=public as $$
declare
  s integer := 20;
begin
  if new.phone is not null and length(trim(new.phone)) > 0 then s := s + 15; end if;
  if new.email is not null and length(trim(new.email)) > 0 then s := s + 10; end if;
  if new.service_interest is not null and length(trim(new.service_interest)) > 0 then s := s + 10; end if;
  if coalesce(new.estimated_value,0) >= 300 then s := s + 15; end if;
  if new.status in ('interested','estimate','appointment_set') then s := s + 25; end if;
  if new.follow_up_at is not null and new.follow_up_at <= now() and new.status not in ('sold','do_not_knock','lost') then s := s + 10; end if;
  new.lead_score := least(100,s);
  new.lead_temperature := case when s >= 75 then 'hot' when s >= 45 then 'warm' else 'cold' end;
  new.priority := greatest(coalesce(new.priority,0), case when s >= 75 then 3 when s >= 45 then 2 else 1 end);
  if new.next_action_at is null and new.follow_up_at is not null then new.next_action_at := new.follow_up_at; end if;
  if new.next_action is null and new.follow_up_at is not null then new.next_action := 'follow_up'; end if;
  return new;
end $$;

drop trigger if exists ns_v16_score_lead on public.leads;
create trigger ns_v16_score_lead
before insert or update of phone,email,service_interest,estimated_value,status,follow_up_at,next_action_at,priority
on public.leads for each row execute function public.ns_v16_score_lead();

-- Backfill current leads through the scoring trigger.
update public.leads set priority=priority where archived_at is null;

-- Realtime keeps D2D, Admin and Detailer portals on one appointment record.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
exception when insufficient_privilege then
  raise notice 'Realtime publication could not be altered by this migration role. Enable appointments/leads in Supabase Realtime settings.';
end $$;

-- A lightweight operations queue for owner/admin reporting and future automations.
create or replace view public.operations_action_queue_v16 as
select
  'appointment'::text as entity_type,
  a.id as entity_id,
  case
    when a.assigned_employee_id is null then 'unassigned_job'
    when a.scheduled_at < now() - interval '15 minutes' and coalesce(a.field_status,a.status) in ('scheduled','pending','confirmed','assigned') then 'late_job'
    when a.payment_status in ('unpaid','failed') and a.status='completed' then 'payment_due'
    else 'appointment_attention'
  end as action_type,
  a.customer_name as title,
  a.scheduled_at as due_at,
  a.price as value,
  a.assigned_employee_id,
  a.dispatch_priority as priority
from public.appointments a
where a.status not in ('cancelled','no_show')
  and (
    a.assigned_employee_id is null
    or (a.scheduled_at < now() - interval '15 minutes' and coalesce(a.field_status,a.status) in ('scheduled','pending','confirmed','assigned'))
    or (a.payment_status in ('unpaid','failed') and a.status='completed')
  )
union all
select
  'lead'::text,
  l.id,
  'lead_follow_up_due'::text,
  coalesce(l.customer_name,l.address,'Lead'),
  coalesce(l.next_action_at,l.follow_up_at),
  l.estimated_value,
  l.assigned_employee_id,
  l.priority
from public.leads l
where l.archived_at is null
  and coalesce(l.next_action_at,l.follow_up_at) <= now()
  and l.status not in ('sold','do_not_knock','lost');

grant select on public.operations_action_queue_v16 to authenticated;
