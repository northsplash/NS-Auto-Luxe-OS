-- North Splash Auto Luxe OS V15
-- Shared D2D/Admin/Detailer scheduling, dispatch and customer-service operations.

alter table public.appointments
  add column if not exists appointment_type text not null default 'service',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists deposit_amount numeric not null default 0,
  add column if not exists weather_sensitive boolean not null default true,
  add column if not exists reminder_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists no_show_at timestamptz,
  add column if not exists preferred_contact text,
  add column if not exists gate_instructions text,
  add column if not exists parking_instructions text,
  add column if not exists water_available boolean,
  add column if not exists power_available boolean,
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_parent_id uuid references public.appointments(id) on delete set null;

alter table public.employees
  add column if not exists skill_tags text[] not null default '{}',
  add column if not exists max_daily_hours numeric not null default 9,
  add column if not exists scheduling_notes text;

alter table public.leads
  add column if not exists lead_temperature text not null default 'cold',
  add column if not exists lead_score integer not null default 0,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists priority integer not null default 0;

create table if not exists public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  availability_date date not null,
  start_time time,
  end_time time,
  availability_type text not null default 'available', -- available, unavailable, day_off
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, availability_date, start_time, end_time, availability_type)
);

create table if not exists public.appointment_assignments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assignment_role text not null default 'detailer',
  is_primary boolean not null default false,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique(appointment_id, employee_id)
);

create table if not exists public.appointment_activity (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_service_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  preferred_contact text,
  gate_code text,
  parking_instructions text,
  pet_notes text,
  water_available boolean,
  power_available boolean,
  service_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or lead_id is not null)
);

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  reminder_type text not null default 'appointment',
  remind_at timestamptz not null,
  channel text not null default 'internal',
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_schedule_v15 on public.appointments(scheduled_at, assigned_employee_id, status);
create index if not exists idx_appointments_sales_rep_schedule_v15 on public.appointments(sales_rep_employee_id, scheduled_at);
create index if not exists idx_employee_availability_v15 on public.employee_availability(employee_id, availability_date);
create index if not exists idx_appointment_assignments_employee_v15 on public.appointment_assignments(employee_id, appointment_id);
create index if not exists idx_appointment_activity_v15 on public.appointment_activity(appointment_id, created_at desc);
create index if not exists idx_leads_priority_v15 on public.leads(assigned_employee_id, priority desc, lead_score desc, next_action_at);

alter table public.employee_availability enable row level security;
alter table public.appointment_assignments enable row level security;
alter table public.appointment_activity enable row level security;
alter table public.customer_service_preferences enable row level security;
alter table public.appointment_reminders enable row level security;

-- Admin/owner/manager permissions continue to use the OS permission helpers introduced by Phase 300.
drop policy if exists ns_employee_availability_v15 on public.employee_availability;
create policy ns_employee_availability_v15 on public.employee_availability for all to authenticated
using (employee_id=public.current_employee_id() or public.has_permission('appointments.manage') or public.has_permission('employees.manage'))
with check (employee_id=public.current_employee_id() or public.has_permission('appointments.manage') or public.has_permission('employees.manage'));

drop policy if exists ns_appointment_assignments_v15 on public.appointment_assignments;
create policy ns_appointment_assignments_v15 on public.appointment_assignments for all to authenticated
using (employee_id=public.current_employee_id() or public.has_permission('appointments.view') or public.has_permission('appointments.manage'))
with check (public.has_permission('appointments.manage'));

drop policy if exists ns_appointment_activity_v15 on public.appointment_activity;
create policy ns_appointment_activity_v15 on public.appointment_activity for all to authenticated
using (
  public.has_permission('appointments.view') or public.has_permission('appointments.manage') or
  exists(select 1 from public.appointments a where a.id=appointment_id and (a.user_id=auth.uid() or a.assigned_employee_id=public.current_employee_id() or a.sales_rep_employee_id=public.current_employee_id()))
)
with check (
  public.has_permission('appointments.manage') or
  exists(select 1 from public.appointments a where a.id=appointment_id and (a.assigned_employee_id=public.current_employee_id() or a.sales_rep_employee_id=public.current_employee_id()))
);

drop policy if exists ns_customer_service_preferences_v15 on public.customer_service_preferences;
create policy ns_customer_service_preferences_v15 on public.customer_service_preferences for all to authenticated
using (user_id=auth.uid() or public.has_permission('crm.view') or public.has_permission('appointments.manage'))
with check (user_id=auth.uid() or public.has_permission('appointments.manage'));

drop policy if exists ns_appointment_reminders_v15 on public.appointment_reminders;
create policy ns_appointment_reminders_v15 on public.appointment_reminders for all to authenticated
using (public.has_permission('appointments.view') or public.has_permission('appointments.manage') or exists(select 1 from public.appointments a where a.id=appointment_id and (a.assigned_employee_id=public.current_employee_id() or a.sales_rep_employee_id=public.current_employee_id())))
with check (public.has_permission('appointments.manage') or exists(select 1 from public.appointments a where a.id=appointment_id and a.sales_rep_employee_id=public.current_employee_id()));

-- Let a D2D rep maintain appointments they originated, and let an assigned detailer update job progress.
drop policy if exists ns_v15_sales_rep_appointments on public.appointments;
create policy ns_v15_sales_rep_appointments on public.appointments for all to authenticated
using (sales_rep_employee_id=public.current_employee_id())
with check (sales_rep_employee_id=public.current_employee_id());

drop policy if exists ns_v15_assigned_detailer_update on public.appointments;
create policy ns_v15_assigned_detailer_update on public.appointments for update to authenticated
using (assigned_employee_id=public.current_employee_id())
with check (assigned_employee_id=public.current_employee_id());

-- Keep a full audit trail for schedule/status/detailer changes without requiring app code to log every edit.
create or replace function public.ns_v15_appointment_audit() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if row(new.scheduled_at,new.assigned_employee_id,new.status,new.field_status,new.dispatch_status,new.price)
     is distinct from row(old.scheduled_at,old.assigned_employee_id,old.status,old.field_status,old.dispatch_status,old.price) then
    insert into public.appointment_activity(appointment_id,actor_user_id,actor_employee_id,event_type,details)
    values(new.id,auth.uid(),public.current_employee_id(),'appointment_updated',jsonb_build_object(
      'scheduled_from',old.scheduled_at,'scheduled_to',new.scheduled_at,
      'detailer_from',old.assigned_employee_id,'detailer_to',new.assigned_employee_id,
      'status_from',old.status,'status_to',new.status,
      'field_status_from',old.field_status,'field_status_to',new.field_status,
      'price_from',old.price,'price_to',new.price));
  end if;
  return new;
end $$;

drop trigger if exists ns_v15_appointment_audit on public.appointments;
create trigger ns_v15_appointment_audit after update on public.appointments for each row execute function public.ns_v15_appointment_audit();
