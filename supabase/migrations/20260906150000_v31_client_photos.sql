-- V31: Client photo library for imported before/after and portfolio images.
-- Safe to run more than once. Uses the existing job-media storage bucket.

create table if not exists public.client_photos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade,
  customer_name text,
  customer_email text,
  appointment_id uuid references public.appointments(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  kind text not null default 'after',
  file_url text not null,
  storage_path text,
  file_name text,
  mime_type text,
  caption text,
  vehicle_info text,
  featured boolean not null default false,
  source text not null default 'import',
  created_at timestamptz not null default now()
);

create index if not exists idx_client_photos_customer on public.client_photos(customer_id, created_at desc);
create index if not exists idx_client_photos_email on public.client_photos(customer_email);

alter table public.client_photos enable row level security;
grant select, insert, update, delete on public.client_photos to authenticated;

drop policy if exists ns_client_photos_read on public.client_photos;
create policy ns_client_photos_read on public.client_photos
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.ns_is_internal_user()
    or public.has_permission('appointments.manage')
  );

drop policy if exists ns_client_photos_write on public.client_photos;
create policy ns_client_photos_write on public.client_photos
  for all to authenticated
  using (public.ns_is_internal_user() or public.has_permission('appointments.manage'))
  with check (public.ns_is_internal_user() or public.has_permission('appointments.manage'));
