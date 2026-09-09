/** Cream customer-email HTML shared by preview and (copied into) the SendGrid function. */

export const EMAIL_SUPPORT = 'hello@northsplash.com';
export const EMAIL_PHONE = '330-990-3956';
export const EMAIL_PORTAL = 'https://ns-auto-luxe-os.vercel.app/portal';

const TZ = 'America/New_York';

export function fillMerge(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}|\{([a-z0-9_.]+)\}/gi, (_, a: string, b: string) => {
    const key = String(a || b || '');
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key] ?? '';
    return '';
  });
}

export function withEmailAliases(vars: Record<string, string>): Record<string, string> {
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

export function formatEasternStamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatEasternDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
}

export function emailCtaLabel(eventKey: string) {
  const key = String(eventKey || '');
  if (key === 'booking_received') return 'Confirm appointment';
  if (key === 'invoice_sent' || key === 'payment_reminder') return 'Pay now';
  if (key === 'payment_received' || key === 'receipt_ready' || key === 'refund_issued') return 'View receipt';
  if (key === 'review_request') return 'Leave a review';
  if (key.startsWith('rebooking')) return 'Book again';
  return 'View appointment';
}

export function emailEyebrow(eventKey: string) {
  const key = String(eventKey || '');
  if (key.includes('payment') || key.includes('invoice') || key.includes('refund') || key.includes('receipt')) return 'Payment';
  if (key.includes('review') || key.includes('thank') || key.startsWith('rebooking')) return 'North Splash';
  return 'Appointment update';
}

export function emailStatusIndex(eventKey: string) {
  const flow = ['booking_received', 'booking_confirmed', 'detailer_en_route', 'job_started', 'job_completed'];
  const aliases: Record<string, string> = {
    appointment_reminder: 'booking_confirmed',
    appointment_reminder_24h: 'booking_confirmed',
    appointment_reminder_2h: 'booking_confirmed',
    appointment_rescheduled: 'booking_confirmed',
    detailer_assigned: 'booking_confirmed',
    detailer_approaching: 'detailer_en_route',
    detailer_arrived: 'detailer_en_route',
    invoice_sent: 'job_completed',
    payment_reminder: 'job_completed',
    payment_received: 'job_completed',
    refund_issued: 'job_completed',
    receipt_ready: 'job_completed',
    review_request: 'job_completed',
    thank_you: 'job_completed',
    rebooking_30d: 'job_completed',
    rebooking_90d: 'job_completed',
  };
  return Math.max(0, flow.indexOf(aliases[eventKey] || eventKey));
}

export function escapeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c
  ));
}

export type CustomerEmailModel = {
  subject: string;
  body: string;
  eventKey: string;
  vars: Record<string, string>;
  detailerName?: string;
  detailerPhoto?: string;
};

export function buildCustomerEmailHtml(model: CustomerEmailModel) {
  const vars = withEmailAliases(model.vars);
  const subject = fillMerge(model.subject, vars);
  const message = fillMerge(model.body, vars);
  const body = escapeHtml(message).replace(/\n/g, '<br/>');
  const idx = emailStatusIndex(model.eventKey);
  const steps = ['Appointment', 'Confirmed', 'En route', 'In progress', 'Complete'];
  const status = steps.map((label, i) => {
    const on = i <= Math.min(4, idx);
    return `<td style="text-align:center;width:20%;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:${on ? '#b8893a' : '#8a8176'};padding:0 4px"><div style="height:4px;border-radius:8px;background:${on ? '#1c1814' : '#eadfd3'};margin-bottom:8px"></div>${label}</td>`;
  }).join('');
  const initial = escapeHtml(String(model.detailerName || vars.detailer_name || 'D').trim().slice(0, 1) || 'D');
  const photo = model.detailerPhoto || vars.detailer_photo || '';
  const avatar = photo
    ? `<img src="${escapeHtml(photo)}" width="44" height="44" alt="" style="border-radius:50%;object-fit:cover;border:1px solid #eadfd3"/>`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#1c1814;color:#fffdf8;font-weight:800;font-size:16px;line-height:44px;text-align:center">${initial}</div>`;
  const detailer = (model.detailerName || vars.detailer_name)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fffdf8;border:1px solid #eadfd3;border-radius:14px"><tr><td style="padding:14px 16px">${avatar}</td><td style="padding:14px 16px 14px 0;font-family:Georgia,Times,serif;color:#1c1814"><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#b8893a;font-family:Arial,Helvetica,sans-serif">Assigned detailer</div><div style="font-size:16px;font-weight:700;margin-top:2px">${escapeHtml(model.detailerName || vars.detailer_name)}</div></td></tr></table>`
    : '';
  const service = vars.service || vars.service_name;
  const details = (service || vars.vehicle || vars.appointment_time || vars.price)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#f7f1e8;border:1px solid #eadfd3;border-radius:14px"><tr><td style="padding:18px 20px;font-family:Georgia,Times,serif;color:#1c1814">${service ? `<div style="font-size:20px;font-weight:700">${escapeHtml(service)}</div>` : ''}${vars.vehicle ? `<div style="margin-top:4px;color:#6f675e;font-size:14px">${escapeHtml(vars.vehicle)}</div>` : ''}${vars.appointment_time ? `<div style="margin-top:12px;font-weight:700">${escapeHtml(vars.appointment_time)}</div>` : ''}${vars.address ? `<div style="margin-top:4px;color:#6f675e;font-size:14px">${escapeHtml(vars.address)}</div>` : ''}${vars.eta ? `<div style="margin-top:8px;font-size:13px;color:#6f675e">ETA ${escapeHtml(vars.eta)}</div>` : ''}${vars.price ? `<div style="margin-top:14px;font-size:22px;font-weight:800">${escapeHtml(vars.price)}</div>` : ''}</td></tr></table>`
    : '';
  const cta = emailCtaLabel(model.eventKey);
  const href = escapeHtml(vars.portal_link || EMAIL_PORTAL);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#efe8dc"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe8dc;padding:24px 12px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffdf8;border:1px solid #eadfd3;border-radius:18px;overflow:hidden"><tr><td style="background:#1c1814;padding:22px 28px"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.28em;font-weight:800;color:#fffdf8">NORTH SPLASH</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.34em;color:#e8c96a;margin-top:4px">AUTO LUXE</div></td></tr><tr><td style="padding:28px 28px 8px;font-family:Georgia,Times,serif;color:#1c1814"><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#b8893a;font-weight:800">${escapeHtml(emailEyebrow(model.eventKey))}</div><h1 style="font-size:26px;line-height:1.25;margin:8px 0 18px;font-weight:700">${escapeHtml(subject)}</h1>${details}${detailer}<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#3d3832">${body}</div><table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 20px"><tr><td style="background:#1c1814;border-radius:10px"><a href="${href}" style="display:inline-block;padding:13px 22px;color:#fffdf8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800">${escapeHtml(cta)}</a></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr>${status}</tr></table></td></tr><tr><td style="padding:0 28px 24px;border-top:1px solid #eadfd3;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#6f675e"><div style="padding-top:16px">North Splash Auto Luxe · North Carolina<br/>${EMAIL_SUPPORT} · ${EMAIL_PHONE}<br/>Reply to this email if you need to change the window.</div></td></tr></table></td></tr></table></body></html>`;
}
