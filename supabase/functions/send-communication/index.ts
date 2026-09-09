import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};

const TZ = 'America/New_York';
const EMAIL_SUPPORT = 'hello@northsplash.com';
const EMAIL_PHONE = '330-990-3956';
const EMAIL_PORTAL = 'https://ns-auto-luxe-os.vercel.app/portal';

const CUSTOMER_EVENTS = new Set([
  'booking_received', 'booking_confirmed', 'booking_declined', 'appointment_reminder', 'appointment_reminder_24h', 'appointment_reminder_2h',
  'appointment_rescheduled', 'appointment_cancelled', 'detailer_assigned', 'detailer_en_route', 'detailer_approaching', 'detailer_arrived', 'job_started',
  'job_completed', 'invoice_sent', 'payment_reminder', 'payment_received', 'refund_issued', 'receipt_ready', 'thank_you', 'review_request', 'rebooking_30d', 'rebooking_90d',
  'estimate_sent', 'membership_update',
]);
const EMPLOYEE_EVENTS = new Set(['application_received', 'first_interview', 'second_interview', 'background_check', 'job_offer', 'offer_accepted', 'offer_declined', 'onboarding', 'start_date', 'training_assigned', 'employee_invite', 'schedule_changed']);

function serverKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.default || parsed?.service_role || parsed?.serviceRole || '';
  } catch {
    return '';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = serverKey();
    const sendgridKey = Deno.env.get('SENDGRID_API_KEY') || '';
    const defaultFromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || 'appointments@northsplash.com';
    const defaultFromName = Deno.env.get('SENDGRID_FROM_NAME') || 'North Splash Auto Luxe';
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase server credentials are missing.');
    if (!sendgridKey) throw new Error('SENDGRID_API_KEY is missing from Edge Function secrets.');

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) throw new Error('Authorization token is missing.');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized.');
    const { data: actor } = await admin.from('profiles').select('id,role,portal_role,permissions,is_active').eq('id', user.id).maybeSingle();
    if (!actor) throw new Error('User profile could not be found.');
    if (actor.is_active === false && actor.role !== 'admin') throw new Error('Account is inactive.');

    const body = await req.json();
    const eventKey = String(body.event_key || '').trim();
    if (!CUSTOMER_EVENTS.has(eventKey) && !EMPLOYEE_EVENTS.has(eventKey)) throw new Error(`Unsupported communication event: ${eventKey}`);
    const requestedChannel = String(body.channel || 'email');
    if (requestedChannel === 'sms') return json({ success: false, skipped: true, error: 'SMS provider is not connected yet. Email automation is active.' }, 400);

    const { data: template, error: templateError } = await admin.from('communication_templates').select('*').eq('event_key', eventKey).eq('is_enabled', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (templateError) throw new Error(`Unable to load communication template: ${templateError.message}`);
    if (!template || template.email_enabled === false) return json({ success: true, skipped: true, reason: 'Email template disabled or missing.' });

    const audience = EMPLOYEE_EVENTS.has(eventKey) ? 'employee' : 'customer';
    let recipientEmail = String(body.recipient_email || '').trim();
    let relatedCustomerId = body.customer_id || null, relatedEmployeeId = body.employee_id || null, relatedCandidateId = body.candidate_id || null, relatedAppointmentId = body.appointment_id || null;
    let appointment: any = null, detailer: any = null, customer: any = null;
    const directRecipient = Boolean(recipientEmail) && !relatedAppointmentId && !relatedCandidateId && !relatedEmployeeId && !relatedCustomerId;
    if (directRecipient) {
      const allowed = actor.role === 'admin' || actor.portal_role === 'owner' || actor.permissions?.['communications.manage'];
      if (!allowed) throw new Error('Communication testing access required.');
    }

    if (relatedAppointmentId) {
      const { data: appt, error } = await admin.from('appointments').select('*').eq('id', relatedAppointmentId).maybeSingle();
      if (error || !appt) throw new Error(error?.message || 'Appointment not found.');
      appointment = appt;
      const currentEmployee = await employeeId(admin, user.id);
      const elevated = actor.role === 'admin' || actor.portal_role === 'owner' || actor.permissions?.['appointments.manage'];
      if (!elevated && ![appt.assigned_employee_id, appt.assigned_manager_id].includes(currentEmployee)) throw new Error('Not allowed to send updates for this appointment.');
      relatedCustomerId = relatedCustomerId || appt.user_id;
      recipientEmail = recipientEmail || appt.customer_email || '';
      if (appt.assigned_employee_id) {
        const { data: e } = await admin.from('employees').select('id,name,avatar_url,phone,title').eq('id', appt.assigned_employee_id).maybeSingle();
        detailer = e || null;
      }
      if (appt.user_id) {
        const { data: p } = await admin.from('profiles').select('id,full_name,email,phone,avatar_url').eq('id', appt.user_id).maybeSingle();
        customer = p || null;
        recipientEmail = recipientEmail || p?.email || '';
      }
    }
    if (relatedCandidateId) {
      requireHR(actor);
      const { data: c } = await admin.from('recruiting_candidates').select('email,full_name').eq('id', relatedCandidateId).maybeSingle();
      recipientEmail = c?.email || recipientEmail;
    }
    if (relatedEmployeeId && audience === 'employee') {
      const elevated = actor.role === 'admin' || actor.portal_role === 'owner' || actor.permissions?.['employees.manage'] || actor.permissions?.['recruiting.manage'];
      if (!elevated) throw new Error('Employee communication access required.');
      const { data: e } = await admin.from('employees').select('email,name,avatar_url').eq('id', relatedEmployeeId).maybeSingle();
      recipientEmail = e?.email || recipientEmail;
    }
    if (!recipientEmail) throw new Error('Recipient email is missing.');

    const portalBase = Deno.env.get('OWNER_PORTAL_URL') || 'https://ns-auto-luxe-os.vercel.app';
    const vars = withAliases({
      company_name: 'North Splash Auto Luxe',
      support_email: EMAIL_SUPPORT,
      support_phone: EMAIL_PHONE,
      customer_first_name: firstName(customer?.full_name || appointment?.customer_name || String(body.variables?.customer_name || 'Customer')),
      customer_name: String(customer?.full_name || appointment?.customer_name || body.variables?.customer_name || 'Customer'),
      detailer_name: String(detailer?.name || body.variables?.detailer_name || body.variables?.employee_name || 'Your North Splash detailer'),
      detailer_photo: String(detailer?.avatar_url || body.variables?.detailer_photo || ''),
      employee_name: String(detailer?.name || body.variables?.employee_name || ''),
      service: String(appointment?.service_name || body.variables?.service || body.variables?.service_name || 'North Splash service'),
      service_name: String(appointment?.service_name || body.variables?.service_name || body.variables?.service || 'North Splash service'),
      vehicle: String(appointment?.vehicle_info || body.variables?.vehicle || body.variables?.vehicle_info || 'Your vehicle'),
      vehicle_info: String(appointment?.vehicle_info || body.variables?.vehicle_info || body.variables?.vehicle || 'Your vehicle'),
      appointment_time: formatDate(appointment?.scheduled_at) || String(body.variables?.appointment_time || ''),
      appointment_date: formatDay(appointment?.scheduled_at) || String(body.variables?.appointment_date || ''),
      address: String(appointment?.service_address || body.variables?.address || body.variables?.service_address || ''),
      service_address: String(appointment?.service_address || body.variables?.service_address || body.variables?.address || ''),
      price: money(appointment?.price ?? body.variables?.price ?? body.variables?.amount),
      amount: money(appointment?.price ?? body.variables?.amount ?? body.variables?.price),
      eta: String(body.variables?.eta || ''),
      portal_link: String(body.variables?.portal_link || `${portalBase}/portal`),
      ...strVars(body.variables),
    });
    const subject = fillMerge(String(template.subject || 'North Splash Update'), vars);
    const text = fillMerge(String(template.body || ''), vars);
    let fromEmail = String(template.from_email || defaultFromEmail).replace(/^.*<([^>]+)>.*$/, '$1').trim();
    if (audience === 'customer' && /noreply@northsplash\.com/i.test(fromEmail)) fromEmail = defaultFromEmail;
    const fromName = audience === 'employee' ? 'North Splash Admin' : defaultFromName;
    const replyToEmail = String(template.reply_to || Deno.env.get('SENDGRID_REPLY_TO_EMAIL') || EMAIL_SUPPORT).replace(/^.*<([^>]+)>.*$/, '$1').trim();

    const { data: log, error: logError } = await admin.from('communication_logs').insert({
      event_key: eventKey, audience, recipient_email: recipientEmail, from_email: `${fromName} <${fromEmail}>`,
      subject, status: 'sending', related_customer_id: relatedCustomerId, related_employee_id: relatedEmployeeId,
      related_candidate_id: relatedCandidateId, related_appointment_id: relatedAppointmentId,
    }).select().single();
    if (logError) throw new Error(`Unable to create communication log: ${logError.message}`);

    const html = emailHtml({ subject, message: text, eventKey, vars, detailer });
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }], subject }],
        from: { email: fromEmail, name: fromName },
        reply_to: { email: replyToEmail, name: 'North Splash Auto Luxe' },
        content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      await admin.from('communication_logs').update({ status: 'failed', error_message: raw || `SendGrid HTTP ${response.status}` }).eq('id', log.id);
      throw new Error(raw || `SendGrid rejected the message with HTTP ${response.status}.`);
    }
    const providerId = response.headers.get('x-message-id');
    await admin.from('communication_logs').update({ status: 'sent', provider_id: providerId || null, sent_at: new Date().toISOString() }).eq('id', log.id);
    return json({ success: true, id: providerId, log_id: log.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-communication]', message);
    return json({ success: false, error: message }, 400);
  }
});

async function employeeId(admin: any, userId: string) {
  const { data } = await admin.from('employees').select('id').eq('user_id', userId).maybeSingle();
  return data?.id || null;
}
function requireHR(actor: any) {
  if (!(actor?.role === 'admin' || actor?.portal_role === 'owner' || actor?.permissions?.['recruiting.manage'])) throw new Error('Recruiting access required.');
}
function strVars(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null || typeof value === 'object') continue;
    out[key] = String(value);
  }
  return out;
}
function fillMerge(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}|\{([a-z0-9_.]+)\}/gi, (_, a: string, b: string) => {
    const key = String(a || b || '');
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? '';
    return '';
  });
}
function withAliases(vars: Record<string, string>): Record<string, string> {
  const next = { ...vars };
  const set = (key: string, value?: string) => {
    if (!next[key] && value) next[key] = value;
  };
  set('service_name', next.service);
  set('service', next.service_name);
  set('vehicle_info', next.vehicle);
  set('vehicle', next.vehicle_info);
  set('amount', next.price);
  set('price', next.amount);
  set('customer_name', next.customer_first_name);
  set('customer_first_name', next.customer_name ? next.customer_name.split(/\s+/)[0] : '');
  set('employee_name', next.detailer_name);
  set('detailer_name', next.employee_name);
  set('address', next.service_address);
  set('service_address', next.address);
  set('appointment_date', next.appointment_time);
  set('portal_link', next.portal_link || EMAIL_PORTAL);
  set('company_name', 'North Splash Auto Luxe');
  set('support_email', EMAIL_SUPPORT);
  set('support_phone', EMAIL_PHONE);
  return next;
}
function firstName(v: string) {
  return String(v || 'Customer').trim().split(/\s+/)[0] || 'Customer';
}
function formatDate(v?: string | null) {
  if (!v) return '';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return String(v);
  return date.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });
}
function formatDay(v?: string | null) {
  if (!v) return '';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return String(v);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
}
function money(v: any) {
  const n = Number(String(v ?? 0).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : String(v || '');
}
function ctaLabel(eventKey: string) {
  const key = String(eventKey || '');
  if (key === 'booking_received') return 'Confirm appointment';
  if (key === 'invoice_sent' || key === 'payment_reminder') return 'Pay now';
  if (key === 'payment_received' || key === 'receipt_ready' || key === 'refund_issued') return 'View receipt';
  if (key === 'review_request') return 'Leave a review';
  if (key.startsWith('rebooking')) return 'Book again';
  return 'View appointment';
}
function eyebrow(eventKey: string) {
  const key = String(eventKey || '');
  if (key.includes('payment') || key.includes('invoice') || key.includes('refund') || key.includes('receipt')) return 'Payment';
  if (key.includes('review') || key.includes('thank') || key.startsWith('rebooking')) return 'North Splash';
  return 'Appointment update';
}
function statusIndex(eventKey: string) {
  const flow = ['booking_received', 'booking_confirmed', 'detailer_en_route', 'job_started', 'job_completed'];
  const aliases: Record<string, string> = {
    appointment_reminder: 'booking_confirmed', appointment_reminder_24h: 'booking_confirmed', appointment_reminder_2h: 'booking_confirmed',
    appointment_rescheduled: 'booking_confirmed', detailer_assigned: 'booking_confirmed', detailer_approaching: 'detailer_en_route',
    detailer_arrived: 'detailer_en_route', invoice_sent: 'job_completed', payment_reminder: 'job_completed', payment_received: 'job_completed',
    refund_issued: 'job_completed', receipt_ready: 'job_completed', review_request: 'job_completed', thank_you: 'job_completed',
    rebooking_30d: 'job_completed', rebooking_90d: 'job_completed',
  };
  return Math.max(0, flow.indexOf(aliases[eventKey] || eventKey));
}
function escapeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));
}
function emailHtml({ subject, message, eventKey, vars, detailer }: { subject: string; message: string; eventKey: string; vars: Record<string, string>; detailer: any }) {
  const body = escapeHtml(message).replace(/\n/g, '<br/>');
  const idx = statusIndex(eventKey);
  const steps = ['Appointment', 'Confirmed', 'En route', 'In progress', 'Complete'];
  const status = steps.map((label, i) => {
    const on = i <= Math.min(4, idx);
    return `<td style="text-align:center;width:20%;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:${on ? '#b8893a' : '#8a8176'};padding:0 4px"><div style="height:4px;border-radius:8px;background:${on ? '#1c1814' : '#eadfd3'};margin-bottom:8px"></div>${label}</td>`;
  }).join('');
  const detailerName = String(detailer?.name || vars.detailer_name || '');
  const initial = escapeHtml(detailerName.trim().slice(0, 1) || 'D');
  const photo = String(detailer?.avatar_url || vars.detailer_photo || '');
  const avatar = photo
    ? `<img src="${escapeHtml(photo)}" width="44" height="44" alt="" style="border-radius:50%;object-fit:cover;border:1px solid #eadfd3"/>`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#1c1814;color:#fffdf8;font-weight:800;font-size:16px;line-height:44px;text-align:center">${initial}</div>`;
  const detailerBlock = detailerName
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fffdf8;border:1px solid #eadfd3;border-radius:14px"><tr><td style="padding:14px 16px">${avatar}</td><td style="padding:14px 16px 14px 0;font-family:Georgia,Times,serif;color:#1c1814"><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#b8893a;font-family:Arial,Helvetica,sans-serif">Assigned detailer</div><div style="font-size:16px;font-weight:700;margin-top:2px">${escapeHtml(detailerName)}</div></td></tr></table>`
    : '';
  const service = vars.service || vars.service_name;
  const details = (service || vars.vehicle || vars.appointment_time || vars.price)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#f7f1e8;border:1px solid #eadfd3;border-radius:14px"><tr><td style="padding:18px 20px;font-family:Georgia,Times,serif;color:#1c1814">${service ? `<div style="font-size:20px;font-weight:700">${escapeHtml(service)}</div>` : ''}${vars.vehicle ? `<div style="margin-top:4px;color:#6f675e;font-size:14px">${escapeHtml(vars.vehicle)}</div>` : ''}${vars.appointment_time ? `<div style="margin-top:12px;font-weight:700">${escapeHtml(vars.appointment_time)}</div>` : ''}${vars.address ? `<div style="margin-top:4px;color:#6f675e;font-size:14px">${escapeHtml(vars.address)}</div>` : ''}${vars.eta ? `<div style="margin-top:8px;font-size:13px;color:#6f675e">ETA ${escapeHtml(vars.eta)}</div>` : ''}${vars.price ? `<div style="margin-top:14px;font-size:22px;font-weight:800">${escapeHtml(vars.price)}</div>` : ''}</td></tr></table>`
    : '';
  const href = escapeHtml(vars.portal_link || EMAIL_PORTAL);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#efe8dc"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe8dc;padding:24px 12px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffdf8;border:1px solid #eadfd3;border-radius:18px;overflow:hidden"><tr><td style="background:#1c1814;padding:22px 28px"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.28em;font-weight:800;color:#fffdf8">NORTH SPLASH</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.34em;color:#e8c96a;margin-top:4px">AUTO LUXE</div></td></tr><tr><td style="padding:28px 28px 8px;font-family:Georgia,Times,serif;color:#1c1814"><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#b8893a;font-weight:800">${escapeHtml(eyebrow(eventKey))}</div><h1 style="font-size:26px;line-height:1.25;margin:8px 0 18px;font-weight:700">${escapeHtml(subject)}</h1>${details}${detailerBlock}<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#3d3832">${body}</div><table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 20px"><tr><td style="background:#1c1814;border-radius:10px"><a href="${href}" style="display:inline-block;padding:13px 22px;color:#fffdf8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800">${escapeHtml(ctaLabel(eventKey))}</a></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr>${status}</tr></table></td></tr><tr><td style="padding:0 28px 24px;border-top:1px solid #eadfd3;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#6f675e"><div style="padding-top:16px">North Splash Auto Luxe · North Carolina<br/>${EMAIL_SUPPORT} · ${EMAIL_PHONE}<br/>Reply to this email if you need to change the window.</div></td></tr></table></td></tr></table></body></html>`;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
