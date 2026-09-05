-- V22 runtime reliability: backfill tables used by the UI but missing from the checked-in migration chain.
-- Safe on existing deployments: every table/column is IF NOT EXISTS.
create extension if not exists pgcrypto;

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  is_available boolean not null default true,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  category text default 'operations', required_role text, required_roles jsonb not null default '[]'::jsonb,
  minimum_level integer not null default 1, passing_score numeric not null default 80,
  duration_minutes integer not null default 15, manager_signoff_required boolean not null default false,
  cover_image_url text, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(), name text not null, channel text not null default 'email',
  event_key text not null, subject text, body text not null default '', audience text not null default 'customer',
  from_email text, reply_to text, is_enabled boolean not null default true, send_delay_minutes integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_communication_templates_event on public.communication_templates(event_key,is_enabled);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(), name text not null, trigger_event text not null,
  action_type text not null, delay_minutes integer not null default 0, is_enabled boolean not null default true,
  status text not null default 'active', config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.crew_groups (
  id uuid primary key default gen_random_uuid(), name text not null, crew_type text not null default 'd2d',
  manager_employee_id uuid references public.employees(id) on delete set null,
  door_goal integer not null default 50, contact_goal integer not null default 15,
  appointment_goal integer not null default 4, revenue_goal numeric not null default 1500,
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crew_membership_history (
  id uuid primary key default gen_random_uuid(), crew_id uuid references public.crew_groups(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade, manager_employee_id uuid references public.employees(id) on delete set null,
  previous_crew_id uuid references public.crew_groups(id) on delete set null, change_type text not null default 'assigned',
  started_at timestamptz not null default now(), ended_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.crew_coaching_notes (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id) on delete cascade,
  manager_employee_id uuid references public.employees(id) on delete set null, note text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.crew_alerts (
  id uuid primary key default gen_random_uuid(), crew_id uuid references public.crew_groups(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null, severity text not null default 'info',
  title text not null, message text, status text not null default 'open', resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.crew_daily_closeouts (
  id uuid primary key default gen_random_uuid(), crew_id uuid not null references public.crew_groups(id) on delete cascade,
  manager_employee_id uuid references public.employees(id) on delete set null, work_date date not null,
  attendance_reviewed boolean not null default false, performance_reviewed boolean not null default false,
  tomorrow_reviewed boolean not null default false, notes text, created_at timestamptz not null default now(),
  unique(crew_id,work_date)
);

create table if not exists public.employee_message_channels (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  channel_type text not null default 'custom', audience_role text, crew_id uuid references public.crew_groups(id) on delete cascade,
  description text, created_by uuid references auth.users(id) on delete set null, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.employee_message_channel_members (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.employee_message_channels(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade, member_role text not null default 'member',
  can_post boolean not null default true, created_at timestamptz not null default now(), unique(channel_id,employee_id)
);
create table if not exists public.employee_messages (
  id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.employee_message_channels(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null, sender_employee_id uuid references public.employees(id) on delete set null,
  sender_name text not null default 'North Splash Team', body text not null, message_kind text not null default 'message',
  related_lead_id uuid references public.leads(id) on delete set null, related_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz
);
create index if not exists idx_employee_messages_channel_time on public.employee_messages(channel_id,created_at);
create table if not exists public.employee_message_reads (
  channel_id uuid not null references public.employee_message_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, last_read_at timestamptz not null default now(),
  primary key(channel_id,user_id)
);

create table if not exists public.lead_contact_attempts (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null, channel text not null default 'other', outcome text,
  notes text, attempted_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists idx_lead_contact_attempts_lead on public.lead_contact_attempts(lead_id,attempted_at desc);

create or replace function public.ns_is_internal_user()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or p.portal_role='owner'))
      or exists(select 1 from public.employees e where e.user_id=auth.uid() and coalesce(e.status,'active') <> 'terminated');
$$;
grant execute on function public.ns_is_internal_user() to authenticated;

-- Internal-only operational tables. Customers must not be able to browse staff messaging/crew data.
do $$ declare t text; begin
  foreach t in array array['training_courses','communication_templates','automation_rules','crew_groups','crew_membership_history','crew_coaching_notes','crew_alerts','crew_daily_closeouts','employee_message_channels','employee_message_channel_members','employee_messages','employee_message_reads','lead_contact_attempts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists ns_v22_internal on public.%I',t);
    execute format('create policy ns_v22_internal on public.%I for all to authenticated using (public.ns_is_internal_user()) with check (public.ns_is_internal_user())',t);
  end loop;
end $$;

-- Availability remains readable by signed-in customers for booking, but only owner/admin can mutate it.
alter table public.availability enable row level security;
drop policy if exists ns_v22_availability_read on public.availability;
create policy ns_v22_availability_read on public.availability for select to authenticated using (true);
drop policy if exists ns_v22_availability_write on public.availability;
create policy ns_v22_availability_write on public.availability for all to authenticated using (public.ns_is_admin_owner()) with check (public.ns_is_admin_owner());
