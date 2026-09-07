-- V35: Gusto payroll fields on the hire packet (Personal details, W-4 2020, Ohio IT-4, payment method, I-9, emergency).
-- Safe to run more than once. Last-four identifiers only.

alter table public.employee_onboarding_profiles
  add column if not exists apartment text not null default '',
  add column if not exists personal_email text not null default '',
  add column if not exists personal_phone text not null default '',
  add column if not exists i9_uscis text not null default '',
  add column if not exists i9_work_until text not null default '',
  add column if not exists two_jobs boolean not null default false,
  add column if not exists other_income text not null default '',
  add column if not exists w4_deductions text not null default '',
  add column if not exists ohio_filing_status text not null default '',
  add column if not exists ohio_school_district text not null default '',
  add column if not exists ohio_extra_withholding text not null default '',
  add column if not exists payment_method text,
  add column if not exists emergency_email text not null default '',
  add column if not exists gusto jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.employee_onboarding_profiles
    add constraint employee_onboarding_payment_method_chk
    check (payment_method is null or payment_method in ('direct_deposit','paper_check'));
exception when duplicate_object then null;
end $$;

comment on column public.employee_onboarding_profiles.gusto is
  'Gusto payroll extras (W-4 2020, Ohio IT-4, payment method). Full SSN and bank numbers are never stored.';
comment on column public.employee_onboarding_profiles.payment_method is
  'Gusto payment method: direct_deposit or paper_check.';
