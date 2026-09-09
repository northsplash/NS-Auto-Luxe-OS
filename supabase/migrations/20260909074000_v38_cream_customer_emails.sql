-- Customer mail: send from appointments@, replies to hello@.
-- Do not overwrite owner-edited subject/body copy.

update public.communication_templates
set from_email = 'appointments@northsplash.com'
where coalesce(audience, 'customer') = 'customer'
  and (
    from_email is null
    or btrim(from_email) = ''
    or from_email ilike '%noreply@northsplash.com%'
  );

update public.communication_templates
set reply_to = 'hello@northsplash.com'
where coalesce(audience, 'customer') = 'customer'
  and (
    reply_to is null
    or btrim(reply_to) = ''
    or reply_to ilike '%noreply@northsplash.com%'
    or reply_to ilike '%support@northsplash.com%'
  );
