-- V28: document flexible pay + refresh customer SMS copy to Uber-style day-of updates.
-- Safe to run more than once. Catalog rows were first seeded in V25.

comment on column public.employees.pay_type is
  'hourly | salary | base_commission | commission_only | per_job | hourly_plus_commission | salary_plus_commission | custom';

comment on column public.employees.title is
  'Free-text job title. Independent from system role and pay mix.';

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='communication_templates') then
    update public.communication_templates
      set sms_body = 'North Splash: {detailer_name} is on the way to your {service}. ETA {eta}. Track: {portal_link}',
          timing_label = 'Detailer taps En Route'
      where event_key = 'detailer_en_route';
    update public.communication_templates
      set sms_body = 'North Splash: {detailer_name} has arrived for your appointment.',
          timing_label = 'Detailer taps Arrived'
      where event_key = 'detailer_arrived';
    update public.communication_templates
      set sms_body = 'Your vehicle is ready. Your North Splash detail is complete. View photos & receipt: {portal_link}',
          timing_label = 'Job completed'
      where event_key = 'job_completed';
    update public.communication_templates
      set sms_body = 'North Splash: Time for your next detail? Book your {vehicle}: {portal_link}',
          name = '90-day rebooking reminder'
      where event_key = 'rebooking_90d';
  end if;
end $$;
