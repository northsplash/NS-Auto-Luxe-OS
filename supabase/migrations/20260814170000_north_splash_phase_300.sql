-- NORTH SPLASH OS — PHASE 300
-- Idempotent expansion for territories, D2D routing, dispatch/job mode,
-- training, communications, onboarding, CRM, commissions, timekeeping,
-- automations and audit-safe operational history.
-- Run AFTER the existing Enterprise / Field Operations / North Splash OS SQL.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Existing table expansions
-- ---------------------------------------------------------------------------
alter table public.lead_territories
  add column if not exists color text default '#9d7651',
  add column if not exists priority integer not null default 0,
  add column if not exists house_goal integer default 0,
  add column if not exists locked boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.territory_doors
  add column if not exists normalized_address text,
  add column if not exists street_name text,
  add column if not exists house_number text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists do_not_knock boolean not null default false,
  add column if not exists first_visited_at timestamptz,
  add column if not exists visit_count integer not null default 0,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists customer_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_route_id uuid;

alter table public.leads
  add column if not exists territory_door_id uuid references public.territory_doors(id) on delete set null,
  add column if not exists normalized_phone text,
  add column if not exists normalized_address text,
  add column if not exists lost_reason text,
  add column if not exists contact_count integer not null default 0,
  add column if not exists converted_customer_id uuid references public.profiles(id) on delete set null,
  add column if not exists estimate_id uuid,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists priority integer not null default 0;

alter table public.appointments alter column user_id drop not null;
alter table public.appointments
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists estimate_id uuid,
  add column if not exists dispatch_status text not null default 'unassigned',
  add column if not exists route_order integer,
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists qc_completed_at timestamptz,
  add column if not exists qc_by_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists customer_signature_at timestamptz,
  add column if not exists before_photos_required boolean not null default true,
  add column if not exists after_photos_required boolean not null default true,
  add column if not exists travel_buffer_minutes integer not null default 30,
  add column if not exists reschedule_reason text,
  add column if not exists source_channel text,
  add column if not exists customer_notified_at timestamptz;

alter table public.time_entries
  add column if not exists scheduled_shift_id uuid references public.employee_shifts(id) on delete set null,
  add column if not exists clock_in_latitude numeric,
  add column if not exists clock_in_longitude numeric,
  add column if not exists clock_out_latitude numeric,
  add column if not exists clock_out_longitude numeric,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists adjustment_reason text,
  add column if not exists is_late boolean not null default false,
  add column if not exists missed_clock_out boolean not null default false;

alter table public.employees
  add column if not exists portal_role text,
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists terminated_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists last_invited_at timestamptz,
  add column if not exists supervisor_notes text,
  add column if not exists default_location_id uuid;

alter table public.customer_estimates
  add column if not exists estimate_number text,
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric not null default 0,
  add column if not exists discount numeric not null default 0,
  add column if not exists tax numeric not null default 0,
  add column if not exists total numeric not null default 0,
  add column if not exists sales_rep_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists converted_appointment_id uuid references public.appointments(id) on delete set null;

alter table public.job_checklist_items
  add column if not exists required boolean not null default true,
  add column if not exists notes text;

alter table public.job_media
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text;

alter table public.training_courses
  add column if not exists description text,
  add column if not exists required_roles jsonb not null default '[]'::jsonb,
  add column if not exists minimum_level integer not null default 1,
  add column if not exists passing_score numeric not null default 80,
  add column if not exists duration_minutes integer not null default 15,
  add column if not exists manager_signoff_required boolean not null default false,
  add column if not exists cover_image_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.communication_templates
  add column if not exists audience text not null default 'customer',
  add column if not exists from_email text,
  add column if not exists reply_to text,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists send_delay_minutes integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Territory / canvassing / routing
-- ---------------------------------------------------------------------------
create table if not exists public.territory_door_history (
  id uuid primary key default gen_random_uuid(),
  door_id uuid not null references public.territory_doors(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  previous_status text,
  new_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_door_history_door on public.territory_door_history(door_id, created_at desc);

create table if not exists public.territory_routes (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.lead_territories(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  total_stops integer not null default 0,
  completed_stops integer not null default 0,
  distance_meters numeric not null default 0,
  start_latitude numeric,
  start_longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_territory_routes_employee on public.territory_routes(employee_id, started_at desc);

create table if not exists public.territory_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.territory_routes(id) on delete cascade,
  door_id uuid not null references public.territory_doors(id) on delete cascade,
  stop_order integer not null,
  status text not null default 'pending',
  arrived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(route_id, door_id),
  unique(route_id, stop_order)
);

create table if not exists public.d2d_daily_goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  goal_date date not null default current_date,
  door_goal integer not null default 50,
  contact_goal integer not null default 15,
  appointment_goal integer not null default 4,
  revenue_goal numeric not null default 1500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, goal_date)
);

create table if not exists public.rep_work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  territory_id uuid references public.lead_territories(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_latitude numeric,
  last_longitude numeric,
  last_location_at timestamptz,
  houses_worked integer not null default 0,
  contacts integer not null default 0,
  appointments_set integer not null default 0,
  revenue_won numeric not null default 0,
  status text not null default 'active'
);

-- ---------------------------------------------------------------------------
-- Customer CRM
-- ---------------------------------------------------------------------------
create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer,
  make text,
  model text,
  color text,
  size_class text,
  plate text,
  vin text,
  coating_info text,
  notes text,
  last_service_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_vehicles_user on public.customer_vehicles(user_id);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  note_type text not null default 'general',
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique(customer_id, tag)
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid references public.profiles(id) on delete set null,
  referred_customer_id uuid references public.profiles(id) on delete set null,
  referral_code text,
  reward_amount numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Job mode / dispatch / inspection / QC
-- ---------------------------------------------------------------------------
create table if not exists public.job_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  label text not null,
  sort_order integer not null default 0,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(service_name, label)
);

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  condition_summary text,
  damage_notes text,
  customer_acknowledged boolean not null default false,
  customer_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  previous_status text,
  new_status text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_status_history_appt on public.job_status_history(appointment_id, created_at desc);

create table if not exists public.job_signatures (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  signature_type text not null default 'completion',
  signer_name text,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Time clock / breaks / payroll / commission
-- ---------------------------------------------------------------------------
create table if not exists public.time_entry_breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  sale_amount numeric not null default 0,
  commission_rate numeric not null default 0,
  commission_amount numeric not null default 0,
  status text not null default 'earned',
  earned_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(employee_id, payment_id)
);

create table if not exists public.pay_rate_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employment_level integer,
  pay_type text,
  hourly_rate numeric not null default 0,
  weekly_base numeric not null default 0,
  commission_rate numeric not null default 0,
  effective_from date not null default current_date,
  effective_to date,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recruiting / onboarding / employment communications
-- ---------------------------------------------------------------------------
create table if not exists public.recruiting_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.recruiting_candidates(id) on delete cascade,
  event_type text not null,
  previous_stage text,
  new_stage text,
  subject text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general',
  required boolean not null default true,
  status text not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Training center
-- ---------------------------------------------------------------------------
create table if not exists public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  title text not null,
  lesson_type text not null default 'text',
  content text,
  media_url text,
  sort_order integer not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.training_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'single_choice',
  sort_order integer not null default 0,
  points numeric not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.training_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.training_questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  score numeric,
  passed boolean,
  manager_signoff_status text not null default 'not_required',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, employee_id)
);

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  score numeric not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create table if not exists public.training_signoffs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  manager_employee_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'approved',
  notes text,
  signed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Communications and automation
-- ---------------------------------------------------------------------------
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  audience text not null,
  recipient_email text not null,
  from_email text not null,
  subject text not null,
  status text not null default 'queued',
  provider_id text,
  related_customer_id uuid references public.profiles(id) on delete set null,
  related_employee_id uuid references public.employees(id) on delete set null,
  related_candidate_id uuid references public.recruiting_candidates(id) on delete set null,
  related_appointment_id uuid references public.appointments(id) on delete set null,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_communication_logs_created on public.communication_logs(created_at desc);

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  process_after timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_automation_events_pending on public.automation_events(status, process_after);

-- ---------------------------------------------------------------------------
-- Geocode cache
-- ---------------------------------------------------------------------------

create table if not exists public.geocode_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  latitude numeric not null,
  longitude numeric not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Security / backup / device readiness
-- ---------------------------------------------------------------------------
create table if not exists public.security_checks (
  id uuid primary key default gen_random_uuid(),
  check_name text not null,
  status text not null default 'pending',
  result text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null default 'export',
  scope text not null default 'business',
  status text not null default 'requested',
  file_url text,
  row_count integer,
  requested_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Update helpers and data integrity
-- ---------------------------------------------------------------------------
create or replace function public.ns_normalize_phone(v text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(v,''), '[^0-9]', '', 'g'), 10)
$$;

create or replace function public.ns_normalize_address(v text)
returns text language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(v,'')), '\\s+', ' ', 'g'))
$$;

create or replace function public.ns_set_lead_normalized_fields()
returns trigger language plpgsql as $$
begin
  new.normalized_phone := public.ns_normalize_phone(new.phone);
  new.normalized_address := public.ns_normalize_address(new.address);
  return new;
end $$;

drop trigger if exists ns_leads_normalize on public.leads;
create trigger ns_leads_normalize before insert or update of phone,address on public.leads
for each row execute function public.ns_set_lead_normalized_fields();

create or replace function public.ns_set_door_normalized_fields()
returns trigger language plpgsql as $$
begin
  new.normalized_address := public.ns_normalize_address(new.address);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ns_doors_normalize on public.territory_doors;
create trigger ns_doors_normalize before insert or update of address,status,notes on public.territory_doors
for each row execute function public.ns_set_door_normalized_fields();

-- Status-history + permanent DNK enforcement.
create or replace function public.ns_log_door_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.status is distinct from old.status then
    if old.do_not_knock = true and new.status <> 'do_not_knock' then
      new.status := 'do_not_knock';
      new.do_not_knock := true;
    elsif new.status = 'do_not_knock' then
      new.do_not_knock := true;
    end if;
    new.first_visited_at := coalesce(old.first_visited_at, now());
    new.last_visited_at := now();
    new.visit_count := coalesce(old.visit_count,0)+1;
    insert into public.territory_door_history(door_id,employee_id,lead_id,previous_status,new_status,notes)
      values(new.id,new.last_employee_id,new.lead_id,old.status,new.status,new.notes);
  end if;
  return new;
end $$;

drop trigger if exists ns_door_status_history on public.territory_doors;
create trigger ns_door_status_history before update of status on public.territory_doors
for each row execute function public.ns_log_door_status();

-- Appointment status history + timestamps.
create or replace function public.ns_log_job_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and (new.status is distinct from old.status or new.field_status is distinct from old.field_status) then
    if new.field_status='en_route' and new.en_route_at is null then new.en_route_at:=now(); end if;
    if new.field_status='arrived' and new.arrived_at is null then new.arrived_at:=now(); end if;
    if new.field_status in ('started','in_progress') and new.started_at is null then new.started_at:=now(); end if;
    if new.field_status in ('finished','completed') and new.finished_at is null then new.finished_at:=now(); end if;
    insert into public.job_status_history(appointment_id,employee_id,previous_status,new_status,notes)
      values(new.id,coalesce(new.assigned_employee_id,new.assigned_manager_id),coalesce(old.field_status,old.status),coalesce(new.field_status,new.status),new.internal_notes);
  end if;
  return new;
end $$;

drop trigger if exists ns_job_status_history on public.appointments;
create trigger ns_job_status_history before update of status,field_status on public.appointments
for each row execute function public.ns_log_job_status();

-- D2D commission is earned only when a completed payment belongs to an appointment
-- carrying a salesperson attribution. Existing unique(employee,payment) prevents duplicates.
create or replace function public.ns_create_commission_for_payment()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  appt public.appointments%rowtype;
  rep public.employees%rowtype;
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from new.status) and new.appointment_id is not null then
    select * into appt from public.appointments where id=new.appointment_id;
    if appt.sales_rep_employee_id is not null then
      select * into rep from public.employees where id=appt.sales_rep_employee_id;
      if rep.id is not null then
        insert into public.commission_ledger(employee_id,appointment_id,payment_id,sale_amount,commission_rate,commission_amount,status,earned_at)
          values(rep.id,appt.id,new.id,new.amount,coalesce(rep.commission_rate,0),round(new.amount*coalesce(rep.commission_rate,0)/100,2),'earned',coalesce(new.created_at,now()))
        on conflict(employee_id,payment_id) do update set
          sale_amount=excluded.sale_amount,
          commission_rate=excluded.commission_rate,
          commission_amount=excluded.commission_amount;
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ns_payment_commission on public.payments;
create trigger ns_payment_commission after insert or update of status on public.payments
for each row execute function public.ns_create_commission_for_payment();

-- Create default checklist items when a job is started, using the service template.
create or replace function public.ns_seed_job_checklist()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.field_status in ('started','in_progress') and old.field_status is distinct from new.field_status then
    insert into public.job_checklist_items(appointment_id,label,sort_order,required)
    select new.id,t.label,t.sort_order,t.required
    from public.job_checklist_templates t
    where t.active=true and (lower(t.service_name)=lower(new.service_name) or t.service_name='*')
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists ns_seed_checklist on public.appointments;
create trigger ns_seed_checklist after update of field_status on public.appointments
for each row execute function public.ns_seed_job_checklist();

-- ---------------------------------------------------------------------------
-- Views for fast reporting
-- ---------------------------------------------------------------------------
create or replace view public.d2d_daily_performance as
select
  e.id employee_id,
  e.name employee_name,
  current_date performance_date,
  count(distinct d.id) filter(where d.last_visited_at::date=current_date) doors_worked,
  count(distinct d.id) filter(where d.last_visited_at::date=current_date and d.status in ('contacted','interested','follow_up','estimate','appointment_set','sold','customer')) contacts,
  count(distinct d.id) filter(where d.last_visited_at::date=current_date and d.status in ('appointment_set','sold','customer')) appointments,
  coalesce(sum(s.sale_amount) filter(where s.sold_at::date=current_date and s.status='completed'),0) revenue
from public.employees e
left join public.territory_doors d on d.last_employee_id=e.id
left join public.sales_records s on s.employee_id=e.id
where e.role='d2d_agent' and e.status='active'
group by e.id,e.name;

create or replace view public.customer_lifetime_summary as
select
  p.id customer_id,
  p.full_name,
  p.email,
  p.phone,
  count(distinct a.id) appointments,
  count(distinct a.id) filter(where a.status='completed') completed_jobs,
  coalesce(sum(pay.amount) filter(where pay.status='completed'),0) lifetime_spend,
  max(a.completed_at) last_service_at
from public.profiles p
left join public.appointments a on a.user_id=p.id
left join public.payments pay on pay.user_id=p.id
where p.role='customer'
group by p.id,p.full_name,p.email,p.phone;

-- ---------------------------------------------------------------------------
-- Seed checklist templates
-- ---------------------------------------------------------------------------
insert into public.job_checklist_templates(service_name,label,sort_order,required) values
('*','Vehicle walk-around / condition check',5,true),
('*','Before photos captured',10,true),
('*','Customer notes reviewed',15,true),
('Luxe Essential','Exterior hand wash',30,true),
('Luxe Essential','Wheels & tires',40,true),
('Luxe Essential','Interior vacuum',50,true),
('Luxe Essential','Surface cleaning',60,true),
('Luxe Essential','Interior & exterior glass',70,true),
('Luxe Essential','Spray protection',80,true),
('Luxe Signature','Exterior hand wash',30,true),
('Luxe Signature','Wheels & tires',40,true),
('Luxe Signature','Deep interior cleaning',50,true),
('Luxe Signature','Carpet & mat cleaning',60,true),
('Luxe Signature','Leather conditioning',70,true),
('Luxe Signature','Door jamb cleaning',80,true),
('Luxe Signature','Exterior decontamination',90,true),
('Luxe Elite','Full interior detail',30,true),
('Luxe Elite','Deep extraction',40,true),
('Luxe Elite','Leather treatment',50,true),
('Luxe Elite','Exterior detail',60,true),
('Luxe Elite','Paint decontamination',70,true),
('Luxe Elite','Paint enhancement',80,true),
('Luxe Elite','Premium sealant',90,true),
('*','After photos captured',900,true),
('*','Final quality check',910,true)
on conflict(service_name,label) do update set sort_order=excluded.sort_order,required=excluded.required,active=true;

-- ---------------------------------------------------------------------------
-- Seed communication templates. Customer job emails always originate from
-- noreply@northsplash.com; employment/recruiting/onboarding emails originate
-- from Admin@northsplash.com.
-- ---------------------------------------------------------------------------
insert into public.communication_templates(name,channel,event_key,subject,body,audience,from_email,reply_to,is_enabled) values
('Booking received','email','booking_received','We received your North Splash booking','Hi {{customer_name}}, we received your {{service_name}} request for {{appointment_date}}. We will confirm your appointment shortly.','customer','noreply@northsplash.com',null,true),
('Booking confirmed','email','booking_confirmed','Your North Splash appointment is confirmed','Hi {{customer_name}}, your {{service_name}} appointment is confirmed for {{appointment_date}} at {{appointment_time}}.','customer','noreply@northsplash.com',null,true),
('Booking declined','email','booking_declined','Update on your North Splash booking','Hi {{customer_name}}, we are unable to accept the requested appointment time. Please return to your portal to select another available time.','customer','noreply@northsplash.com',null,true),
('Appointment reminder','email','appointment_reminder','Reminder: your North Splash appointment','Your {{service_name}} appointment is coming up on {{appointment_date}} at {{appointment_time}}.','customer','noreply@northsplash.com',null,true),
('Detailer assigned','email','detailer_assigned','Your North Splash detailer is assigned','{{employee_name}} has been assigned to your {{service_name}} appointment.','customer','noreply@northsplash.com',null,true),
('Detailer en route','email','detailer_en_route','Your North Splash detailer is on the way','{{employee_name}} is en route to {{service_address}} for your appointment.','customer','noreply@northsplash.com',null,true),
('Detailer arrived','email','detailer_arrived','Your North Splash detailer has arrived','Your North Splash detailer has arrived for your {{service_name}} appointment.','customer','noreply@northsplash.com',null,true),
('Job started','email','job_started','Your North Splash service has started','We have started your {{service_name}} service.','customer','noreply@northsplash.com',null,true),
('Job completed','email','job_completed','Your North Splash service is complete','Your {{service_name}} is complete. Thank you for choosing North Splash Auto Luxe.','customer','noreply@northsplash.com',null,true),
('Review request','email','review_request','How did we do?','Thank you for choosing North Splash. We would appreciate your feedback on your completed service.','customer','noreply@northsplash.com',null,true),
('Application received','email','application_received','North Splash application received','Hi {{candidate_name}}, we received your application for {{position}}. Our team will review it and contact you with next steps.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('First interview','email','first_interview','North Splash first-round interview','Hi {{candidate_name}}, we would like to schedule your first-round interview for {{interview_date}}.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Second interview','email','second_interview','North Splash second-round interview','Hi {{candidate_name}}, we would like to move you forward to a second-round interview on {{interview_date}}.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Background check','email','background_check','North Splash background-check update','Hi {{candidate_name}}, your application has moved to the background-check stage.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Job offer','email','job_offer','Your North Splash job offer','Hi {{candidate_name}}, we are pleased to extend an offer for {{position}}. Please review the offer and respond by {{response_date}}.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Onboarding','email','onboarding','Welcome to North Splash','Welcome {{employee_name}}. Your onboarding tasks, portal access and required training are ready.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Start date','email','start_date','Your North Splash start date','Hi {{employee_name}}, this is a reminder that your start date is {{start_date}}.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Training assigned','email','training_assigned','North Splash training assigned','Hi {{employee_name}}, {{course_title}} has been assigned to your Training Center.','employee','Admin@northsplash.com','Admin@northsplash.com',true)
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Storage bucket for before/after/damage job photos
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('job-media','job-media',true,15728640,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ns_job_media_read on storage.objects;
create policy ns_job_media_read on storage.objects for select to authenticated using (bucket_id='job-media');
drop policy if exists ns_job_media_insert on storage.objects;
create policy ns_job_media_insert on storage.objects for insert to authenticated with check (bucket_id='job-media');
drop policy if exists ns_job_media_update on storage.objects;
create policy ns_job_media_update on storage.objects for update to authenticated using (bucket_id='job-media') with check (bucket_id='job-media');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'territory_door_history','territory_routes','territory_route_stops','d2d_daily_goals','rep_work_sessions',
    'customer_vehicles','crm_notes','customer_tags','referrals','job_checklist_templates','vehicle_inspections',
    'job_status_history','job_signatures','time_entry_breaks','commission_ledger','pay_rate_history','recruiting_events',
    'onboarding_tasks','training_lessons','training_questions','training_question_options','training_assignments',
    'training_attempts','training_signoffs','communication_logs','automation_events','geocode_cache','security_checks','backup_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Owner / manager / self-scoped policies.
drop policy if exists ns_door_history_read on public.territory_door_history;
create policy ns_door_history_read on public.territory_door_history for select to authenticated using (
  public.has_permission('leads.view_all') or employee_id=public.current_employee_id() or exists(
    select 1 from public.territory_doors d join public.lead_territories t on t.id=d.territory_id
    where d.id=door_id and t.assigned_employee_id=public.current_employee_id()
  )
);

drop policy if exists ns_routes_staff on public.territory_routes;
create policy ns_routes_staff on public.territory_routes for all to authenticated using (
  public.has_permission('territories.manage') or employee_id=public.current_employee_id()
) with check (public.has_permission('territories.manage') or employee_id=public.current_employee_id());

drop policy if exists ns_route_stops_staff on public.territory_route_stops;
create policy ns_route_stops_staff on public.territory_route_stops for all to authenticated using (
  exists(select 1 from public.territory_routes r where r.id=route_id and (r.employee_id=public.current_employee_id() or public.has_permission('territories.manage')))
) with check (
  exists(select 1 from public.territory_routes r where r.id=route_id and (r.employee_id=public.current_employee_id() or public.has_permission('territories.manage')))
);

drop policy if exists ns_goals_staff on public.d2d_daily_goals;
create policy ns_goals_staff on public.d2d_daily_goals for all to authenticated using (
  employee_id=public.current_employee_id() or public.has_permission('sales.manage')
) with check (employee_id=public.current_employee_id() or public.has_permission('sales.manage'));

drop policy if exists ns_work_sessions_staff on public.rep_work_sessions;
create policy ns_work_sessions_staff on public.rep_work_sessions for all to authenticated using (
  employee_id=public.current_employee_id() or public.has_permission('leads.view_all')
) with check (employee_id=public.current_employee_id() or public.has_permission('leads.manage'));

drop policy if exists ns_customer_vehicles on public.customer_vehicles;
create policy ns_customer_vehicles on public.customer_vehicles for all to authenticated using (
  user_id=auth.uid() or public.has_permission('crm.view')
) with check (user_id=auth.uid() or public.has_permission('appointments.manage'));

drop policy if exists ns_crm_notes on public.crm_notes;
create policy ns_crm_notes on public.crm_notes for all to authenticated using (public.has_permission('crm.view')) with check (public.has_permission('appointments.manage'));

drop policy if exists ns_customer_tags on public.customer_tags;
create policy ns_customer_tags on public.customer_tags for all to authenticated using (customer_id=auth.uid() or public.has_permission('crm.view')) with check (public.has_permission('appointments.manage'));

drop policy if exists ns_referrals on public.referrals;
create policy ns_referrals on public.referrals for select to authenticated using (referrer_customer_id=auth.uid() or referred_customer_id=auth.uid() or public.has_permission('crm.view'));

drop policy if exists ns_checklist_templates_read on public.job_checklist_templates;
create policy ns_checklist_templates_read on public.job_checklist_templates for select to authenticated using (true);
drop policy if exists ns_checklist_templates_manage on public.job_checklist_templates;
create policy ns_checklist_templates_manage on public.job_checklist_templates for all to authenticated using (public.has_permission('appointments.manage')) with check (public.has_permission('appointments.manage'));

drop policy if exists ns_vehicle_inspections on public.vehicle_inspections;
create policy ns_vehicle_inspections on public.vehicle_inspections for all to authenticated using (
  public.has_permission('appointments.manage') or employee_id=public.current_employee_id()
) with check (public.has_permission('appointments.manage') or employee_id=public.current_employee_id());

drop policy if exists ns_job_history on public.job_status_history;
create policy ns_job_history on public.job_status_history for select to authenticated using (
  public.has_permission('appointments.view') or employee_id=public.current_employee_id() or exists(select 1 from public.appointments a where a.id=appointment_id and a.user_id=auth.uid())
);

drop policy if exists ns_signatures on public.job_signatures;
create policy ns_signatures on public.job_signatures for all to authenticated using (
  public.has_permission('appointments.manage') or exists(select 1 from public.appointments a where a.id=appointment_id and (a.assigned_employee_id=public.current_employee_id() or a.user_id=auth.uid()))
) with check (
  public.has_permission('appointments.manage') or exists(select 1 from public.appointments a where a.id=appointment_id and (a.assigned_employee_id=public.current_employee_id() or a.user_id=auth.uid()))
);

drop policy if exists ns_breaks on public.time_entry_breaks;
create policy ns_breaks on public.time_entry_breaks for all to authenticated using (employee_id=public.current_employee_id() or public.has_permission('timecards.view')) with check (employee_id=public.current_employee_id() or public.has_permission('timecards.manage'));

drop policy if exists ns_commission_read on public.commission_ledger;
create policy ns_commission_read on public.commission_ledger for select to authenticated using (employee_id=public.current_employee_id() or public.has_permission('finance.view') or public.has_permission('sales.view'));
drop policy if exists ns_commission_manage on public.commission_ledger;
create policy ns_commission_manage on public.commission_ledger for update to authenticated using (public.has_permission('payroll.approve')) with check (public.has_permission('payroll.approve'));

drop policy if exists ns_pay_history on public.pay_rate_history;
create policy ns_pay_history on public.pay_rate_history for select to authenticated using (employee_id=public.current_employee_id() or public.has_permission('pay.view'));
drop policy if exists ns_pay_history_manage on public.pay_rate_history;
create policy ns_pay_history_manage on public.pay_rate_history for all to authenticated using (public.has_permission('pay.manage')) with check (public.has_permission('pay.manage'));

drop policy if exists ns_recruiting_events on public.recruiting_events;
create policy ns_recruiting_events on public.recruiting_events for all to authenticated using (public.has_permission('recruiting.manage')) with check (public.has_permission('recruiting.manage'));

drop policy if exists ns_onboarding on public.onboarding_tasks;
create policy ns_onboarding on public.onboarding_tasks for all to authenticated using (employee_id=public.current_employee_id() or public.has_permission('employees.view')) with check (employee_id=public.current_employee_id() or public.has_permission('employees.manage'));

drop policy if exists ns_training_lessons on public.training_lessons;
create policy ns_training_lessons on public.training_lessons for select to authenticated using (true);
drop policy if exists ns_training_lessons_manage on public.training_lessons;
create policy ns_training_lessons_manage on public.training_lessons for all to authenticated using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

drop policy if exists ns_training_questions on public.training_questions;
create policy ns_training_questions on public.training_questions for select to authenticated using (true);
drop policy if exists ns_training_questions_manage on public.training_questions;
create policy ns_training_questions_manage on public.training_questions for all to authenticated using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

drop policy if exists ns_training_options on public.training_question_options;
create policy ns_training_options on public.training_question_options for select to authenticated using (true);
drop policy if exists ns_training_options_manage on public.training_question_options;
create policy ns_training_options_manage on public.training_question_options for all to authenticated using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

drop policy if exists ns_training_assignments on public.training_assignments;
create policy ns_training_assignments on public.training_assignments for select to authenticated using (employee_id=public.current_employee_id() or public.has_permission('employees.view'));
drop policy if exists ns_training_assignments_manage on public.training_assignments;
create policy ns_training_assignments_manage on public.training_assignments for all to authenticated using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

drop policy if exists ns_training_attempts on public.training_attempts;
create policy ns_training_attempts on public.training_attempts for all to authenticated using (employee_id=public.current_employee_id() or public.has_permission('employees.view')) with check (employee_id=public.current_employee_id() or public.has_permission('employees.manage'));

drop policy if exists ns_training_signoffs on public.training_signoffs;
create policy ns_training_signoffs on public.training_signoffs for select to authenticated using (employee_id=public.current_employee_id() or public.has_permission('employees.view'));
drop policy if exists ns_training_signoffs_manage on public.training_signoffs;
create policy ns_training_signoffs_manage on public.training_signoffs for all to authenticated using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

drop policy if exists ns_communication_logs on public.communication_logs;
create policy ns_communication_logs on public.communication_logs for select to authenticated using (public.has_permission('notifications.manage') or related_customer_id=auth.uid() or related_employee_id=public.current_employee_id());

drop policy if exists ns_automation_events on public.automation_events;
create policy ns_automation_events on public.automation_events for select to authenticated using (public.has_permission('notifications.manage'));

drop policy if exists ns_geocode_cache on public.geocode_cache;
create policy ns_geocode_cache on public.geocode_cache for select to authenticated using (true);

drop policy if exists ns_security_checks on public.security_checks;
create policy ns_security_checks on public.security_checks for all to authenticated using (public.has_permission('audit.view')) with check (public.has_permission('permissions.manage'));

drop policy if exists ns_backup_runs on public.backup_runs;
create policy ns_backup_runs on public.backup_runs for all to authenticated using (public.has_permission('audit.view')) with check (public.has_permission('permissions.manage'));

-- ---------------------------------------------------------------------------
-- Performance indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_leads_normalized_phone on public.leads(normalized_phone) where normalized_phone <> '';
create index if not exists idx_leads_normalized_address on public.leads(normalized_address) where normalized_address <> '';
create index if not exists idx_leads_followup on public.leads(follow_up_at) where follow_up_at is not null;
create index if not exists idx_leads_assigned_status on public.leads(assigned_employee_id,status);
create index if not exists idx_doors_territory_status on public.territory_doors(territory_id,status);
create index if not exists idx_doors_followup on public.territory_doors(next_follow_up_at) where next_follow_up_at is not null;
create index if not exists idx_appointments_dispatch on public.appointments(dispatch_status,scheduled_at);
create index if not exists idx_appointments_employee_time on public.appointments(assigned_employee_id,scheduled_at);
create index if not exists idx_job_checklist_appointment on public.job_checklist_items(appointment_id,sort_order);
create index if not exists idx_training_assignments_employee on public.training_assignments(employee_id,status);
create index if not exists idx_time_breaks_entry on public.time_entry_breaks(time_entry_id);

-- ---------------------------------------------------------------------------
-- Optional default D2D goals for active reps
-- ---------------------------------------------------------------------------
insert into public.d2d_daily_goals(employee_id,goal_date,door_goal,contact_goal,appointment_goal,revenue_goal)
select id,current_date,50,15,4,1500 from public.employees where role='d2d_agent' and status='active'
on conflict(employee_id,goal_date) do nothing;

-- End of Phase 300 setup.

-- ---------------------------------------------------------------------------
-- Phase 300 communication coverage and useful default automations
-- ---------------------------------------------------------------------------
insert into public.communication_templates(name,channel,event_key,subject,body,audience,from_email,reply_to,is_enabled) values
('Appointment rescheduled','email','appointment_rescheduled','Your North Splash appointment was rescheduled','Hi {{customer_name}}, your {{service_name}} appointment has been moved to {{appointment_date}} at {{appointment_time}}.','customer','noreply@northsplash.com',null,true),
('Appointment cancelled','email','appointment_cancelled','Your North Splash appointment was cancelled','Hi {{customer_name}}, your {{service_name}} appointment has been cancelled. If you would like another time, return to your portal to book again.','customer','noreply@northsplash.com',null,true),
('Receipt ready','email','receipt_ready','Your North Splash receipt','Thank you {{customer_name}}. Your payment of {{amount}} for {{service_name}} was received.','customer','noreply@northsplash.com',null,true),
('Estimate sent','email','estimate_sent','Your North Splash estimate','Hi {{customer_name}}, your North Splash estimate for {{service_name}} is ready. Estimated total: {{amount}}.','customer','noreply@northsplash.com',null,true),
('Membership update','email','membership_update','North Splash membership update','Hi {{customer_name}}, there is an update to your {{membership_name}} membership. {{membership_message}}','customer','noreply@northsplash.com',null,true),
('Offer accepted','email','offer_accepted','Welcome to North Splash','Hi {{candidate_name}}, your offer has been accepted. We are excited to have you join North Splash. Your onboarding information will follow.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Offer declined','email','offer_declined','North Splash offer update','Hi {{candidate_name}}, we recorded your response to the North Splash offer. Thank you for your time and interest.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Employee invite','email','employee_invite','Your North Splash employee account','Hi {{employee_name}}, your North Splash employee portal account is ready. Use the secure link in this message to finish setting up access.','employee','Admin@northsplash.com','Admin@northsplash.com',true),
('Schedule changed','email','schedule_changed','Your North Splash schedule changed','Hi {{employee_name}}, your work schedule has been updated. Sign in to your employee portal to review the change.','employee','Admin@northsplash.com','Admin@northsplash.com',true)
on conflict do nothing;

insert into public.automation_rules(name,trigger_event,action_type,delay_minutes,is_enabled) values
('24-hour appointment reminder','appointment.reminder_due','email',0,true),
('D2D follow-up due alert','lead.follow_up_due','notification',0,true),
('Completed job review request','appointment.review_due','email',0,true)
on conflict do nothing;

-- Queue a review-request automation event after a job is completed.
create or replace function public.ns_queue_job_automation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' and coalesce(old.status,'') <> 'completed' then
    insert into public.automation_events(event_key,entity_type,entity_id,payload,status,process_after)
    values(
      'appointment.review_due','appointment',new.id,
      jsonb_build_object(
        'communication_event','review_request',
        'user_id',new.user_id,
        'customer_email',new.customer_email,
        'customer_name',new.customer_name,
        'service_name',new.service_name,
        'scheduled_at',new.scheduled_at
      ),
      'pending',now()+interval '2 hours'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists ns_queue_job_automation on public.appointments;
create trigger ns_queue_job_automation after update of status on public.appointments
for each row execute function public.ns_queue_job_automation();
