-- North Splash OS V25
-- Flexible compensation + customer communication lifecycle + mobile-app readiness.
-- Safe to run after V21/V22/V23 migrations.

-- ---------------------------------------------------------------------------
-- Flexible employee compensation
-- ---------------------------------------------------------------------------
alter table public.employees add column if not exists annual_salary numeric not null default 0;
alter table public.employees add column if not exists per_job_rate numeric not null default 0;
alter table public.employees add column if not exists flat_commission numeric not null default 0;
alter table public.employees add column if not exists commission_basis text not null default 'revenue';
alter table public.employees add column if not exists pay_schedule text not null default 'weekly';
alter table public.employees add column if not exists overtime_eligible boolean not null default true;
alter table public.employees add column if not exists compensation_notes text;
alter table public.employees add column if not exists custom_compensation jsonb not null default '{}'::jsonb;

-- Do not force pay_type into a small enum. North Splash intentionally supports
-- hourly, salary, base_commission, commission_only, per_job and custom/mixed.
alter table public.employees alter column pay_type set default 'hourly';

-- ---------------------------------------------------------------------------
-- Communication template controls
-- ---------------------------------------------------------------------------
alter table public.communication_templates add column if not exists category text not null default 'other';
alter table public.communication_templates add column if not exists email_enabled boolean not null default true;
alter table public.communication_templates add column if not exists sms_enabled boolean not null default false;
alter table public.communication_templates add column if not exists sms_body text not null default '';
alter table public.communication_templates add column if not exists timing_label text not null default '';
alter table public.communication_templates add column if not exists template_version integer not null default 1;
create index if not exists idx_communication_templates_category on public.communication_templates(category,event_key);

-- Helper for idempotent template creation.
do $$
declare r record;
begin
  for r in select * from (values
    ('Booking confirmation','appointments','booking_received','Your North Splash detail is booked','Hi {{customer_first_name}},\n\nYour {{service}} for {{vehicle}} is booked for {{appointment_time}}. We’ll keep you updated as your appointment moves through the North Splash experience.','North Splash: Your {{service}} is booked for {{appointment_time}}. View appointment: {{portal_link}}','Immediately after booking',0,true,true),
    ('Appointment confirmed','appointments','booking_confirmed','Your appointment is confirmed','Hi {{customer_first_name}},\n\nYour North Splash appointment is confirmed for {{appointment_time}}. We look forward to taking care of {{vehicle}}.','North Splash: Your appointment is confirmed for {{appointment_time}}. {{portal_link}}','When confirmed',0,true,true),
    ('24-hour reminder','appointments','appointment_reminder_24h','Your detail is tomorrow','Hi {{customer_first_name}},\n\nA reminder that your {{service}} is scheduled for {{appointment_time}}.','North Splash reminder: Your {{service}} is scheduled for {{appointment_time}}. {{portal_link}}','24 hours before',-1440,true,true),
    ('2-hour reminder','appointments','appointment_reminder_2h','Your detail is coming up','Hi {{customer_first_name}},\n\nYour North Splash detail begins in about two hours.','North Splash: Your {{service}} starts in about 2 hours. {{portal_link}}','2 hours before',-120,false,true),
    ('Detailer assigned','field','detailer_assigned','Your detailer has been assigned','Hi {{customer_first_name}},\n\n{{detailer_name}} has been assigned to your {{service}}.','North Splash: {{detailer_name}} is assigned to your {{service}}. {{portal_link}}','When detailer assigned',0,true,true),
    ('Detailer en route','field','detailer_en_route','Your detailer is on the way','Hi {{customer_first_name}},\n\n{{detailer_name}} is on the way to your appointment. ETA: {{eta}}.','North Splash: {{detailer_name}} is on the way. ETA {{eta}}. Track: {{portal_link}}','When En Route is tapped',0,true,true),
    ('Detailer approaching','field','detailer_approaching','Your detailer is approaching','Hi {{customer_first_name}},\n\nYour North Splash detailer is approaching your location.','North Splash: Your detailer is approaching. ETA {{eta}}. {{portal_link}}','ETA threshold',0,false,true),
    ('Detailer arrived','field','detailer_arrived','Your detailer has arrived','Hi {{customer_first_name}},\n\n{{detailer_name}} has arrived for your appointment.','North Splash: {{detailer_name}} has arrived for your appointment.','When Arrived is tapped',0,false,true),
    ('Job started','field','job_started','Your detail is in progress','Hi {{customer_first_name}},\n\nYour {{service}} is now in progress.','North Splash: Your detail is now in progress. {{portal_link}}','When job starts',0,false,true),
    ('Job completed','field','job_completed','Your vehicle is ready','Hi {{customer_first_name}},\n\nYour North Splash detail is complete. View your appointment for final details, photos and payment information.','✨ Your vehicle is ready. Your North Splash detail is complete. {{portal_link}}','When job completes',0,true,true),
    ('Invoice sent','payments','invoice_sent','Your North Splash invoice is ready','Hi {{customer_first_name}},\n\nYour invoice for {{service}} is ready. Amount due: {{price}}.','North Splash: Your invoice for {{price}} is ready. Pay here: {{portal_link}}','When invoice is issued',0,true,true),
    ('Payment reminder','payments','payment_reminder','Payment reminder from North Splash','Hi {{customer_first_name}},\n\nThis is a reminder that {{price}} is still due for your North Splash service.','North Splash payment reminder: {{price}} is due. {{portal_link}}','Owner-configured',0,true,true),
    ('Payment received','payments','payment_received','Payment received — thank you','Hi {{customer_first_name}},\n\nWe received your payment of {{price}}. Thank you for choosing North Splash Auto Luxe.','North Splash: Payment received. Thank you for choosing us.','When payment completes',0,true,true),
    ('Refund issued','payments','refund_issued','Your refund has been issued','Hi {{customer_first_name}},\n\nA refund has been issued for your North Splash transaction.','North Splash: Your refund has been issued.','When refund completes',0,true,true),
    ('Thank-you','retention','thank_you','Thank you for choosing North Splash','Hi {{customer_first_name}},\n\nThank you for trusting North Splash Auto Luxe with {{vehicle}}.','North Splash: Thank you for choosing North Splash Auto Luxe.','After completion',120,true,false),
    ('Review request','retention','review_request','How did we do?','Hi {{customer_first_name}},\n\nWe’d love your feedback on your recent {{service}}.','North Splash: How did we do? We’d appreciate your review. {{portal_link}}','2 hours after completion',120,true,true),
    ('30-day rebooking','retention','rebooking_30d','Ready for your next detail?','Hi {{customer_first_name}},\n\nIt’s been about a month since your last North Splash service. Keep {{vehicle}} looking its best by booking your next detail.','North Splash: Ready for your next detail? Book here: {{portal_link}}','30 days after completion',43200,true,true),
    ('90-day rebooking','retention','rebooking_90d','Time for a refresh?','Hi {{customer_first_name}},\n\nIt may be time to refresh {{vehicle}}. Schedule your next North Splash detail when you’re ready.','North Splash: Time for a refresh? {{portal_link}}','90 days after completion',129600,true,true)
  ) as x(name,category,event_key,subject,body,sms_body,timing_label,send_delay_minutes,email_enabled,sms_enabled)
  loop
    if not exists (select 1 from public.communication_templates where event_key=r.event_key) then
      insert into public.communication_templates(name,channel,event_key,subject,body,audience,from_email,is_enabled,send_delay_minutes,category,email_enabled,sms_enabled,sms_body,timing_label)
      values(r.name,'email',r.event_key,r.subject,r.body,'customer','appointments@northsplash.com',true,r.send_delay_minutes,r.category,r.email_enabled,r.sms_enabled,r.sms_body,r.timing_label);
    else
      update public.communication_templates set category=r.category,timing_label=r.timing_label,sms_body=case when coalesce(sms_body,'')='' then r.sms_body else sms_body end,email_enabled=coalesce(email_enabled,r.email_enabled),sms_enabled=coalesce(sms_enabled,r.sms_enabled),updated_at=now() where event_key=r.event_key;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Default automation rules for time-driven communications.
-- Rules can be disabled/edited from Owner/Admin -> Automations.
-- ---------------------------------------------------------------------------
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
      insert into public.automation_rules(name,trigger_event,action_type,delay_minutes,is_enabled,status,config)
      values(r.name,r.trigger_event,r.action_type,r.delay_minutes,true,'active','{}'::jsonb);
    end if;
  end loop;
end $$;

-- Owner/Admin can manage the expanded compensation and communication settings
-- through the existing elevated policies/functions from V21/V22/V23.
