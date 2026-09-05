-- North Splash OS V23: runtime bug fixes discovered by schema/UI audit.
-- Safe to run after V21 + V22. All changes are additive or relax an invalid NOT NULL constraint.

-- Employee fields used throughout Admin/People/Crew/Payroll UI.
alter table public.employees add column if not exists title text;
alter table public.employees add column if not exists department text;
alter table public.employees add column if not exists manager_employee_id uuid references public.employees(id) on delete set null;
alter table public.employees add column if not exists hourly_rate numeric not null default 0;
alter table public.employees add column if not exists weekly_base numeric not null default 0;
alter table public.employees add column if not exists pay_type text not null default 'hourly';
alter table public.employees add column if not exists work_location text;
alter table public.employees add column if not exists training_status text not null default 'active';
create index if not exists idx_employees_manager on public.employees(manager_employee_id);
create index if not exists idx_employees_department on public.employees(department);

-- Booking availability duration used by both Admin and Customer portals.
alter table public.availability add column if not exists slot_minutes integer not null default 60;

-- Appointment fields used by field dispatch, D2D scheduling, signatures and geolocation.
alter table public.appointments add column if not exists customer_email text;
alter table public.appointments add column if not exists customer_phone text;
alter table public.appointments add column if not exists dispatch_status text;
alter table public.appointments add column if not exists field_status text;
alter table public.appointments add column if not exists latitude double precision;
alter table public.appointments add column if not exists longitude double precision;
alter table public.appointments add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.appointments add column if not exists sales_rep_employee_id uuid references public.employees(id) on delete set null;
alter table public.appointments add column if not exists source_channel text;
alter table public.appointments add column if not exists customer_signature text;
alter table public.appointments add column if not exists customer_signature_at timestamptz;
create index if not exists idx_appointments_sales_rep on public.appointments(sales_rep_employee_id);
create index if not exists idx_appointments_lead on public.appointments(lead_id);
create index if not exists idx_appointments_field_status on public.appointments(field_status);

-- Lead lifecycle fields used by estimate flow, next actions, archive/reactivation tools.
alter table public.leads add column if not exists estimate_id uuid;
alter table public.leads add column if not exists next_action text;
alter table public.leads add column if not exists next_action_at timestamptz;
alter table public.leads add column if not exists archive_reason text;
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists cooldown_until timestamptz;
alter table public.leads add column if not exists reactivated_at timestamptz;
alter table public.leads add column if not exists reactivation_status text;
create index if not exists idx_leads_next_action on public.leads(next_action_at) where next_action_at is not null;
create index if not exists idx_leads_archived on public.leads(archived_at) where archived_at is not null;

-- Time clock geolocation + approval fields used by employee and manager portals.
alter table public.time_entries add column if not exists clock_in_latitude double precision;
alter table public.time_entries add column if not exists clock_in_longitude double precision;
alter table public.time_entries add column if not exists clock_out_latitude double precision;
alter table public.time_entries add column if not exists clock_out_longitude double precision;
alter table public.time_entries add column if not exists is_late boolean not null default false;
alter table public.time_entries add column if not exists approved_at timestamptz;

-- Job media metadata used by Job Mode uploads.
alter table public.job_media add column if not exists file_name text;
alter table public.job_media add column if not exists mime_type text;

-- Crew Command UI uses daily_* goal names. Keep V22 legacy goal columns for backwards compatibility.
alter table public.crew_groups add column if not exists daily_door_goal integer not null default 50;
alter table public.crew_groups add column if not exists daily_appointment_goal integer not null default 4;
alter table public.crew_groups add column if not exists daily_revenue_goal numeric not null default 1500;
alter table public.crew_groups add column if not exists daily_job_goal integer not null default 4;
update public.crew_groups set
  daily_door_goal=coalesce(nullif(daily_door_goal,0),door_goal,50),
  daily_appointment_goal=coalesce(nullif(daily_appointment_goal,0),appointment_goal,4),
  daily_revenue_goal=coalesce(nullif(daily_revenue_goal,0),revenue_goal,1500)
where true;

-- Message avatars are snapshotted so owner/admin messages can show photos even without an employee row.
alter table public.employee_messages add column if not exists sender_avatar_url text;

-- Custom message groups can be created by owner/admin accounts that do not have an employee row.
alter table public.employee_message_channel_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.employee_message_channel_members alter column employee_id drop not null;
create index if not exists idx_employee_message_members_user on public.employee_message_channel_members(user_id);
create unique index if not exists idx_employee_message_members_channel_user_unique
  on public.employee_message_channel_members(channel_id,user_id) where user_id is not null;

-- Keep profile and employee avatar URLs aligned for linked staff accounts.
create or replace function public.ns_sync_employee_avatar_to_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.user_id is not null and new.avatar_url is distinct from old.avatar_url then
    update public.profiles set avatar_url=new.avatar_url where id=new.user_id;
  end if;
  return new;
end;$$;
drop trigger if exists trg_sync_employee_avatar_to_profile on public.employees;
create trigger trg_sync_employee_avatar_to_profile
after update of avatar_url on public.employees
for each row execute function public.ns_sync_employee_avatar_to_profile();

-- Tighten avatar storage writes to each signed-in user's own folder.
drop policy if exists ns_profile_avatars_insert on storage.objects;
create policy ns_profile_avatars_insert on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists ns_profile_avatars_update on storage.objects;
create policy ns_profile_avatars_update on storage.objects for update to authenticated
using (bucket_id='profile-avatars' and ((storage.foldername(name))[1]=auth.uid()::text or public.ns_is_admin_owner()))
with check (bucket_id='profile-avatars' and ((storage.foldername(name))[1]=auth.uid()::text or public.ns_is_admin_owner()));
drop policy if exists ns_profile_avatars_delete on storage.objects;
create policy ns_profile_avatars_delete on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and ((storage.foldername(name))[1]=auth.uid()::text or public.ns_is_admin_owner()));

do $$ begin
  alter table public.employee_message_channel_members
    add constraint employee_message_member_has_identity check (employee_id is not null or user_id is not null);
exception when duplicate_object then null; end $$;
