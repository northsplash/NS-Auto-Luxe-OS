-- North Splash OS V25.1
-- Hotfix for existing automation_rules tables created before V22.
-- Safe to run more than once.

alter table if exists public.automation_rules
  add column if not exists status text not null default 'active';

alter table if exists public.automation_rules
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table if exists public.automation_rules
  add column if not exists updated_at timestamptz not null default now();

update public.automation_rules
set status = case when coalesce(is_enabled, true) then 'active' else 'paused' end
where status is null or status = '';

-- Make sure the V25 default rules exist after the schema repair.
do $$
declare r record;
begin
  for r in select * from (values
    ('24-hour appointment reminder','appointment.reminder_24h','email',0),
    ('2-hour appointment reminder','appointment.reminder_2h','email',0),
    ('Post-service review request','job.review_due','email',0),
    ('30-day rebooking reminder','customer.rebook_30d','email',0),
    ('90-day rebooking reminder','customer.rebook_90d','email',0)
  ) as x(name,trigger_event,action_type,delay_minutes)
  loop
    if not exists(select 1 from public.automation_rules where name=r.name) then
      insert into public.automation_rules
        (name,trigger_event,action_type,delay_minutes,is_enabled,status,config)
      values
        (r.name,r.trigger_event,r.action_type,r.delay_minutes,true,'active','{}'::jsonb);
    end if;
  end loop;
end $$;
