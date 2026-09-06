-- V29: Gusto-style hire packet. Last-four identifiers only. Never store a full SSN or bank account.
-- Safe to run more than once.

create table if not exists public.employee_onboarding_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  legal_first text not null default '',
  legal_middle text not null default '',
  legal_last text not null default '',
  preferred text not null default '',
  dob date,
  ssn_last4 text,
  street text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  work_auth text not null default '',
  filing_status text not null default '',
  allowances text not null default '',
  extra_withholding text not null default '',
  bank_name text not null default '',
  routing_last4 text,
  account_last4 text,
  account_type text,
  emergency_name text not null default '',
  emergency_phone text not null default '',
  emergency_relation text not null default '',
  handbook_ack boolean not null default false,
  i9_ack boolean not null default false,
  steps jsonb not null default '{}'::jsonb,
  percent_complete integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint employee_onboarding_ssn_last4_chk check (ssn_last4 is null or ssn_last4 ~ '^[0-9]{4}$'),
  constraint employee_onboarding_routing_last4_chk check (routing_last4 is null or routing_last4 ~ '^[0-9]{4}$'),
  constraint employee_onboarding_account_last4_chk check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  constraint employee_onboarding_account_type_chk check (account_type is null or account_type in ('checking','savings'))
);

alter table public.employees add column if not exists onboarding_status text not null default 'not_started';

comment on table public.employee_onboarding_profiles is
  'Hire onboarding packet. Stores last-four SSN and bank digits only.';
comment on column public.employee_onboarding_profiles.ssn_last4 is
  'Last four digits of SSN only. Full SSNs must never be written here.';

alter table public.employee_onboarding_profiles enable row level security;

drop policy if exists ns_v29_onboarding_profiles on public.employee_onboarding_profiles;
create policy ns_v29_onboarding_profiles on public.employee_onboarding_profiles
  for all to authenticated
  using (
    exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
    or public.ns_is_internal_user()
  )
  with check (
    exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
    or public.ns_is_internal_user()
  );

grant select, insert, update, delete on public.employee_onboarding_profiles to authenticated;

insert into public.employee_message_channels (name, slug, channel_type, description, is_active)
select 'Company', 'company', 'company', 'Everyone at North Splash', true
where not exists (select 1 from public.employee_message_channels where slug = 'company');
