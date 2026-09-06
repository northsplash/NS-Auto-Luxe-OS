-- V33: Customer referral credits ($20 each when a signup matches an existing customer).
-- Safe to run more than once.

alter table if exists public.profiles
  add column if not exists account_credit numeric not null default 0,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create table if not exists public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referred_id uuid not null references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referrer_contact text not null,
  credit_each numeric not null default 20,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index if not exists idx_customer_referrals_referrer on public.customer_referrals(referrer_id, created_at desc);
create index if not exists idx_customer_referrals_referred on public.customer_referrals(referred_id);

alter table public.customer_referrals enable row level security;
grant select on public.customer_referrals to authenticated;
revoke insert, update, delete on public.customer_referrals from authenticated;
revoke insert, update, delete on public.customer_referrals from public;

drop policy if exists ns_v33_referrals_read on public.customer_referrals;
create policy ns_v33_referrals_read on public.customer_referrals
  for select to authenticated
  using (
    referred_id = auth.uid()
    or referrer_id = auth.uid()
    or public.ns_is_internal_user()
  );

drop policy if exists ns_v33_referrals_insert on public.customer_referrals;
create policy ns_v33_referrals_insert on public.customer_referrals
  for insert to authenticated
  with check (referred_id = auth.uid() or public.ns_is_internal_user());

-- Customers can update their own profile, so lock credit fields unless an RPC opts in.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id = auth.uid() and not public.has_permission('permissions.manage') then
    new.role := old.role;
    new.portal_role := old.portal_role;
    new.permissions := old.permissions;
    new.is_active := old.is_active;
    if current_setting('ns.allow_credit_update', true) is distinct from '1' then
      new.account_credit := old.account_credit;
      new.referred_by := old.referred_by;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_customer_referral(p_contact text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  contact text := lower(trim(coalesce(p_contact, '')));
  digits text := regexp_replace(contact, '[^0-9]', '', 'g');
  me public.profiles;
  referrer public.profiles;
  existing public.customer_referrals;
  credit numeric := 20;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to apply a referral.');
  end if;
  if contact = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter the phone or email of the person who referred you.');
  end if;

  select * into me from public.profiles where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Your customer profile is not ready yet. Try again in a moment.');
  end if;

  select * into existing from public.customer_referrals where referred_id = uid;
  if found then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'credit', existing.credit_each,
      'referrer_id', existing.referrer_id,
      'message', 'This account already has a referral credit.'
    );
  end if;

  select * into referrer
  from public.profiles p
  where p.id <> uid
    and (
      (position('@' in contact) > 0 and lower(coalesce(p.email, '')) = contact)
      or (
        length(digits) >= 7
        and length(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')) >= 7
        and right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 10) = right(digits, 10)
      )
    )
  order by case when coalesce(p.role, 'customer') = 'customer' then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'No matching North Splash customer for that phone or email yet. You can still create the account — we apply $20 each once they are on file.'
    );
  end if;

  perform set_config('ns.allow_credit_update', '1', true);

  insert into public.customer_referrals (referred_id, referrer_id, referrer_contact, credit_each)
  values (uid, referrer.id, trim(coalesce(p_contact, '')), credit);

  update public.profiles
    set account_credit = coalesce(account_credit, 0) + credit,
        referred_by = case when id = uid then referrer.id else referred_by end
    where id in (uid, referrer.id);

  return jsonb_build_object(
    'ok', true,
    'credit', credit,
    'referrer_id', referrer.id,
    'referrer_name', coalesce(nullif(referrer.full_name, ''), referrer.email, 'Customer'),
    'message', 'Referral matched. $20 is on your account and $20 is on theirs, used on the next visit.'
  );
end $$;

create or replace function public.spend_account_credit(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  available numeric;
  spent numeric;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'spent', 0, 'error', 'Sign in required.');
  end if;
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', true, 'spent', 0, 'remaining', 0);
  end if;

  perform set_config('ns.allow_credit_update', '1', true);
  select coalesce(account_credit, 0) into available from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'spent', 0, 'error', 'Profile not found.');
  end if;
  spent := least(available, p_amount);
  update public.profiles set account_credit = available - spent where id = uid;
  return jsonb_build_object('ok', true, 'spent', spent, 'remaining', available - spent);
end $$;

revoke all on function public.apply_customer_referral(text) from public;
revoke all on function public.spend_account_credit(numeric) from public;
grant execute on function public.apply_customer_referral(text) to authenticated;
grant execute on function public.spend_account_credit(numeric) to authenticated;

comment on table public.customer_referrals is
  'Customer portal signup referrals. Both parties receive $20 account credit when the referrer matches.';
comment on column public.profiles.account_credit is
  'Prepaid visit credit, including referral rewards. Applied to the next booked or collected job.';
