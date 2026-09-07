-- Website apply must work without a staff login and without a Vercel service-role key.
-- RLS/GRANT on recruiting_candidates is not enough on locked-down projects; this
-- SECURITY DEFINER RPC is the path anon and authenticated clients can execute.

alter table public.recruiting_candidates
  add column if not exists city text,
  add column if not exists years_experience numeric,
  add column if not exists authorized_to_work boolean;

grant insert on table public.recruiting_candidates to anon, authenticated;

drop policy if exists "website_job_apply" on public.recruiting_candidates;
create policy "website_job_apply" on public.recruiting_candidates
for insert
to anon, authenticated
with check (
  stage = 'applied'
  and source = 'Website'
  and full_name is not null
  and char_length(btrim(full_name)) between 2 and 120
  and email is not null
  and phone is not null
  and position in ('detailer', 'd2d_agent', 'manager')
);

create or replace function public.submit_website_job_application(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text := btrim(coalesce(payload->>'full_name', ''));
  email text := lower(btrim(coalesce(payload->>'email', '')));
  phone text := regexp_replace(coalesce(payload->>'phone', ''), '\D', '', 'g');
  position text := btrim(coalesce(payload->>'position', ''));
  city text := btrim(coalesce(payload->>'city', ''));
  availability text := btrim(coalesce(payload->>'availability', ''));
  why text := btrim(coalesce(payload->>'why', ''));
  experience_detail text := btrim(coalesce(payload->>'experience_detail', ''));
  start_when text := btrim(coalesce(payload->>'start_when', ''));
  years numeric;
  authorized boolean := coalesce((payload->>'authorized_to_work')::boolean, false);
  transportation boolean := coalesce((payload->>'transportation')::boolean, false);
  weekends boolean := coalesce((payload->>'weekends')::boolean, false);
  has_license boolean := coalesce((payload->>'has_license')::boolean, false);
  field_role boolean := position in ('detailer', 'd2d_agent');
  position_label text;
  notes text;
  existing_id uuid;
  candidate_id uuid;
  desired text;
begin
  if length(btrim(coalesce(payload->>'company_website', ''))) > 0 then
    return jsonb_build_object('success', true, 'id', 'ignored', 'duplicate', false);
  end if;

  position_label := case position
    when 'detailer' then 'Mobile Detailer'
    when 'd2d_agent' then 'Door-to-door Sales'
    when 'manager' then 'Operations / Concierge'
    else null
  end;

  begin
    years := nullif(payload->>'years_experience', '')::numeric;
  exception when others then
    years := null;
  end;

  if length(full_name) < 2 then
    raise exception 'Enter your full name.';
  end if;
  if position('@' in email) = 0 then
    raise exception 'Enter a valid email.';
  end if;
  if length(phone) < 10 then
    raise exception 'Enter a 10-digit phone number.';
  end if;
  if phone ~ '^(.)\1+$' then
    raise exception 'Enter a real phone number.';
  end if;
  if position_label is null then
    raise exception 'Choose a role.';
  end if;
  if length(city) < 2 then
    raise exception 'Enter the North Carolina city you work from.';
  end if;
  if start_when = '' then
    raise exception 'Tell us the earliest day you can start.';
  end if;
  if length(experience_detail) < 20 then
    raise exception 'Tell us about your related experience in a couple of sentences.';
  end if;
  if field_role and not has_license then
    raise exception 'Field roles need a valid driver’s license.';
  end if;
  if not authorized then
    raise exception 'You must be authorized to work in the United States.';
  end if;
  if length(why) < 20 then
    raise exception 'Tell us a little more about why you want this role.';
  end if;

  select c.id into existing_id
  from public.recruiting_candidates c
  where lower(c.email) = email
    and c.position = position
    and c.created_at >= (now() - interval '7 days')
  limit 1;

  if existing_id is not null then
    return jsonb_build_object('success', true, 'id', existing_id, 'duplicate', true);
  end if;

  notes := concat_ws(E'\n',
    'Website application',
    'City: ' || city || ', NC',
    case when start_when <> '' then 'Earliest start: ' || start_when else null end,
    case when availability <> '' then 'Availability: ' || availability || case when weekends then '; some weekends' else '' end else null end,
    case when years is not null then 'Related experience: ' || years::text || ' year' || case when years = 1 then '' else 's' end else null end,
    'Driver’s license: ' || case when has_license then 'Yes' when field_role then 'No / not confirmed' else 'Not required for this seat' end,
    'Authorized to work in the U.S.: ' || case when authorized then 'Yes' else 'No' end,
    'Reliable transportation: ' || case when transportation then 'Yes' else 'No' end,
    case when experience_detail <> '' then E'Experience in their words:\n' || experience_detail else null end,
    case when why <> '' then E'Why this role:\n' || why else null end
  );

  desired := nullif(concat_ws(' · ', nullif(availability, ''), case when start_when <> '' then 'start ' || start_when else null end), '');

  begin
    insert into public.recruiting_candidates (
      full_name, email, phone, position, stage, source, background_status,
      desired_schedule, city, years_experience, authorized_to_work, notes
    ) values (
      full_name, email, phone, position, 'applied', 'Website', 'not_started',
      desired, city, years, authorized, notes
    ) returning id into candidate_id;
  exception when others then
    insert into public.recruiting_candidates (
      full_name, email, phone, position, stage, source, background_status,
      desired_schedule, notes
    ) values (
      full_name, email, phone, position, 'applied', 'Website', 'not_started',
      desired, notes
    ) returning id into candidate_id;
  end;

  begin
    insert into public.recruiting_events (candidate_id, event_type, new_stage, notes)
    values (candidate_id, 'application_received', 'applied', 'Submitted from northsplash.com/apply');
  exception when others then
    null;
  end;

  begin
    insert into public.business_notifications (target_portal_role, title, message, notification_type, link)
    values (
      'owner',
      'New job application',
      full_name || ' applied for ' || position_label || ' from the website.',
      'info',
      '/admin'
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('success', true, 'id', candidate_id, 'duplicate', false);
end;
$$;

revoke all on function public.submit_website_job_application(jsonb) from public;
grant execute on function public.submit_website_job_application(jsonb) to anon, authenticated;
