import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};
const ADMIN_FROM = 'North Splash Careers <Admin@northsplash.com>';
const POSITIONS: Record<string, string> = {
  detailer: 'Mobile Detailer',
  d2d_agent: 'Door-to-door Sales',
  manager: 'Operations / Concierge',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !key) throw new Error('Supabase server credentials are missing.');
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const body = await req.json();

    if (String(body.company_website || '').trim()) {
      return json({ success: true, id: 'ignored' });
    }

    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const position = String(body.position || '').trim();
    const city = String(body.city || '').trim();
    const availability = String(body.availability || '').trim();
    const why = String(body.why || '').trim();
    const experienceDetail = String(body.experience_detail || '').trim();
    const startWhen = String(body.start_when || '').trim();
    const years = Number(body.years_experience);
    const authorized = Boolean(body.authorized_to_work);
    const transportation = Boolean(body.transportation);
    const weekends = Boolean(body.weekends);
    const hasLicense = Boolean(body.has_license);
    const fieldRole = position === 'detailer' || position === 'd2d_agent';
    const positionLabel = POSITIONS[position];

    if (!fullName || fullName.length < 2) throw new Error('Enter your full name.');
    if (!email.includes('@')) throw new Error('Enter a valid email.');
    if (phone.length < 10) throw new Error('Enter a 10-digit phone number.');
    if (new Set(phone).size === 1) throw new Error('Enter a real phone number.');
    if (!positionLabel) throw new Error('Choose a role.');
    if (!city) throw new Error('Enter the North Carolina city you work from.');
    if (!startWhen) throw new Error('Tell us the earliest day you can start.');
    if (experienceDetail.length < 20) throw new Error('Tell us about your related experience in a couple of sentences.');
    if (fieldRole && !hasLicense) throw new Error('Field roles need a valid driver’s license.');
    if (!authorized) throw new Error('You must be authorized to work in the United States.');
    if (why.length < 20) throw new Error('Tell us a little more about why you want this role.');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await admin.from('recruiting_candidates')
      .select('id')
      .ilike('email', email)
      .eq('position', position)
      .gte('created_at', weekAgo)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return json({ success: true, id: existing.id, duplicate: true });
    }

    const notes = [
      'Website application',
      `City: ${city}, NC`,
      startWhen ? `Earliest start: ${startWhen}` : '',
      availability ? `Availability: ${availability}${weekends ? '; some weekends' : ''}` : '',
      Number.isFinite(years) ? `Related experience: ${years} year${years === 1 ? '' : 's'}` : '',
      `Driver’s license: ${hasLicense ? 'Yes' : fieldRole ? 'No / not confirmed' : 'Not required for this seat'}`,
      `Authorized to work in the U.S.: ${authorized ? 'Yes' : 'No'}`,
      `Reliable transportation: ${transportation ? 'Yes' : 'No'}`,
      experienceDetail ? `Experience in their words:\n${experienceDetail}` : '',
      why ? `Why this role:\n${why}` : '',
    ].filter(Boolean).join('\n');

    const insert = await admin.from('recruiting_candidates').insert({
      full_name: fullName,
      email,
      phone,
      position,
      stage: 'applied',
      source: 'Website',
      background_status: 'not_started',
      desired_schedule: [availability, startWhen ? `start ${startWhen}` : ''].filter(Boolean).join(' · ') || null,
      city,
      years_experience: Number.isFinite(years) ? years : null,
      authorized_to_work: authorized,
      notes,
    }).select('id').single();

    if (insert.error) {
      const fallback = await admin.from('recruiting_candidates').insert({
        full_name: fullName,
        email,
        phone,
        position,
        stage: 'applied',
        source: 'Website',
        background_status: 'not_started',
        desired_schedule: [availability, startWhen ? `start ${startWhen}` : ''].filter(Boolean).join(' · ') || null,
        notes,
      }).select('id').single();
      if (fallback.error) throw fallback.error;
      insert.data = fallback.data;
    }

    const candidateId = insert.data?.id;
    await admin.from('recruiting_events').insert({
      candidate_id: candidateId,
      event_type: 'application_received',
      new_stage: 'applied',
      notes: 'Submitted from northsplash.com/apply',
    }).catch(() => {});
    await admin.from('business_notifications').insert({
      target_portal_role: 'owner',
      title: 'New job application',
      message: `${fullName} applied for ${positionLabel} from the website.`,
      notification_type: 'info',
      link: '/admin',
    }).catch(() => {});

    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: ADMIN_FROM,
          to: [email],
          reply_to: 'Admin@northsplash.com',
          subject: `We received your ${positionLabel} application`,
          html: mail(fullName, positionLabel),
          text: `Hi ${fullName}, we received your application for ${positionLabel} across North Carolina. A hiring manager will review it and contact you if there is a fit.\n\nNorth Splash Auto Luxe`,
        }),
      }).catch(() => {});
    }

    return json({ success: true, id: candidateId, duplicate: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

function mail(name: string, role: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1eb;font-family:Arial,sans-serif;color:#211811"><div style="max-width:620px;margin:auto;padding:34px 18px"><div style="background:#17110d;color:#fff;padding:22px 26px;border-radius:16px 16px 0 0"><b style="letter-spacing:3px">NORTH SPLASH</b><div style="font-size:10px;letter-spacing:4px;color:#c9a96e">AUTO LUXE</div></div><div style="background:#fff;padding:28px 26px;border:1px solid #eadfd3;border-top:0;border-radius:0 0 16px 16px"><h2>Application received</h2><p style="line-height:1.6">Hi ${esc(name)}, we received your application for <strong>${esc(role)}</strong>. Hiring reviews candidates for work across North Carolina and will reach out if there is a next step.</p><p style="color:#87776a;font-size:12px;margin-top:26px">Questions? Reply to Admin@northsplash.com.</p></div></div></body></html>`;
}
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
