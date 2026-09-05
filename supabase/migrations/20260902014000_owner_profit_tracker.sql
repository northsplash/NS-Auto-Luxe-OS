create table if not exists public.owner_profit_settings (
  id text primary key,
  assumptions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.owner_profit_settings enable row level security;
drop policy if exists "owner profit settings owner read" on public.owner_profit_settings;
create policy "owner profit settings owner read" on public.owner_profit_settings for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.portal_role='owner' and coalesce(p.is_active,true)=true)
);
drop policy if exists "owner profit settings owner write" on public.owner_profit_settings;
create policy "owner profit settings owner write" on public.owner_profit_settings for all to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.portal_role='owner' and coalesce(p.is_active,true)=true)
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.portal_role='owner' and coalesce(p.is_active,true)=true)
);
insert into public.owner_profit_settings(id,assumptions) values ('north-splash-auto-luxe','{}'::jsonb) on conflict (id) do nothing;
