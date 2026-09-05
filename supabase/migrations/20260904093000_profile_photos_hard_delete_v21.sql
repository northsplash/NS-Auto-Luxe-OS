-- V21: shared profile photos + owner cleanup tools
alter table public.employees add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.site_visits add column if not exists user_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_site_visits_user_id on public.site_visits(user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists ns_profile_avatars_read on storage.objects;
create policy ns_profile_avatars_read on storage.objects for select using (bucket_id='profile-avatars');
drop policy if exists ns_profile_avatars_insert on storage.objects;
create policy ns_profile_avatars_insert on storage.objects for insert to authenticated with check (bucket_id='profile-avatars');
drop policy if exists ns_profile_avatars_update on storage.objects;
create policy ns_profile_avatars_update on storage.objects for update to authenticated using (bucket_id='profile-avatars') with check (bucket_id='profile-avatars');
drop policy if exists ns_profile_avatars_delete on storage.objects;
create policy ns_profile_avatars_delete on storage.objects for delete to authenticated using (bucket_id='profile-avatars');

create or replace function public.ns_is_admin_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or p.portal_role='owner'));
$$;

grant execute on function public.ns_is_admin_owner() to authenticated;

create or replace function public.owner_hard_delete_customer(target_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.ns_is_admin_owner() then raise exception 'Owner/admin access required'; end if;
  if target_user_id=auth.uid() then raise exception 'You cannot delete your own owner account here'; end if;
  -- Auth deletion cascades appointments, payments, subscriptions and profile rows that reference auth.users.
  delete from auth.users where id=target_user_id;
  return true;
end;$$;
grant execute on function public.owner_hard_delete_customer(uuid) to authenticated;

create or replace function public.owner_hard_delete_employee(target_employee_id uuid, delete_linked_login boolean default false)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare linked_user uuid;
begin
  if not public.ns_is_admin_owner() then raise exception 'Owner/admin access required'; end if;
  select user_id into linked_user from public.employees where id=target_employee_id;
  update public.appointments set assigned_employee_id=null where assigned_employee_id=target_employee_id;
  update public.appointments set assigned_manager_id=null where assigned_manager_id=target_employee_id;
  update public.appointments set sales_rep_employee_id=null where sales_rep_employee_id=target_employee_id;
  delete from public.training_signoffs where manager_employee_id=target_employee_id;
  delete from public.employees where id=target_employee_id;
  if delete_linked_login and linked_user is not null and linked_user<>auth.uid() then delete from auth.users where id=linked_user; end if;
  return true;
end;$$;
grant execute on function public.owner_hard_delete_employee(uuid,boolean) to authenticated;
