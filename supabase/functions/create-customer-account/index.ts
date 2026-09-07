import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};
const ADMIN_FROM = 'North Splash Admin <Admin@northsplash.com>';
const STAFF_PORTALS = new Set(['owner', 'manager', 'employee', 'd2d', 'recruiter', 'finance']);
const STAFF_ROLES = new Set(['admin', 'employee', 'd2d_agent', 'detailer']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !key) throw new Error('Supabase server credentials are missing.');
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) throw new Error('Unauthorized');

    const { data: actor } = await admin.from('profiles').select('role,portal_role,permissions,is_active').eq('id', user.id).single();
    const allowed = actor?.role === 'admin'
      || ['owner', 'd2d', 'manager'].includes(actor?.portal_role || '')
      || Boolean(actor?.permissions?.['customers.manage']);
    if (!allowed || actor?.is_active === false) throw new Error('D2D or owner access is required to open a customer account.');

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    const fullName = String(body.full_name || '').trim();
    const phone = String(body.phone || '').trim();
    const vehicle = String(body.vehicle_info || '').trim();
    const address = String(body.address || '').trim();
    const leadId = body.lead_id ? String(body.lead_id) : '';
    const sendEmail = Boolean(body.send_email);
    const redirect = String(body.redirect_to || 'https://ns-auto-luxe-os.vercel.app/login');
    const membership = body.membership && typeof body.membership === 'object'
      ? { name: String(body.membership.name || '').trim(), price: Number(body.membership.price || 0) }
      : null;

    if (!email || !email.includes('@')) throw new Error('A valid email is required to create a customer account.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');

    const { data: existing } = await admin.from('profiles').select('id,email,role,portal_role,is_active,full_name').ilike('email', email).maybeSingle();
    if (existing && (STAFF_PORTALS.has(existing.portal_role || '') || STAFF_ROLES.has(existing.role || ''))) {
      throw new Error('That email already belongs to a North Splash team login.');
    }

    let authUser: { id: string; email?: string | null } | null = existing ? { id: existing.id, email: existing.email } : null;
    let created = false;

    if (!authUser) {
      const found = await (admin.auth.admin as { getUserByEmail?: (e: string) => Promise<{ data: { user: { id: string; email?: string | null } | null } }> }).getUserByEmail?.(email);
      if (found?.data?.user) authUser = found.data.user;
    }

    if (!authUser) {
      const createdUser = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone, created_via: 'd2d_door' },
      });
      if (createdUser.error) {
        const msg = createdUser.error.message || '';
        if (!/already|registered|exists/i.test(msg)) throw createdUser.error;
        const { data: profile } = await admin.from('profiles').select('id,email,role,portal_role').ilike('email', email).maybeSingle();
        if (profile && (STAFF_PORTALS.has(profile.portal_role || '') || STAFF_ROLES.has(profile.role || ''))) {
          throw new Error('That email already belongs to a North Splash team login.');
        }
        if (!profile) throw createdUser.error;
        authUser = { id: profile.id, email: profile.email };
      } else {
        authUser = createdUser.data.user;
        created = true;
      }
    }
    if (!authUser) throw new Error('Could not create or find that customer login.');

    await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: { full_name: fullName, phone, created_via: 'd2d_door' },
    }).catch(() => {});

    await admin.from('profiles').upsert({
      id: authUser.id,
      email,
      full_name: fullName || existing?.full_name || email,
      phone: phone || null,
      role: 'customer',
      portal_role: 'customer',
      is_active: true,
      vehicle_info: vehicle || null,
    }, { onConflict: 'id' });

    if (membership?.name) {
      const { data: sub } = await admin.from('subscriptions').select('id').eq('user_id', authUser.id).in('status', ['active', 'pending']).maybeSingle();
      if (!sub) {
        await admin.from('subscriptions').insert({
          user_id: authUser.id,
          plan_name: membership.name,
          plan_price: membership.price || 0,
          status: 'pending',
        }).catch(() => {});
      }
    }

    if (leadId) {
      await admin.from('leads').update({
        converted_customer_id: authUser.id,
        email,
        phone: phone || undefined,
        customer_name: fullName || undefined,
        address: address || undefined,
        vehicle_info: vehicle || undefined,
      }).eq('id', leadId).catch(() => {});
      await admin.from('territory_doors').update({ customer_id: authUser.id }).eq('lead_id', leadId).catch(() => {});
    }

    let emailed = false;
    let actionLink = '';
    if (sendEmail) {
      const generated = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: redirect } });
      actionLink = generated.data?.properties?.action_link || '';
      if (resendKey && actionLink) {
        const intro = created
          ? 'Your North Splash customer portal is ready. Sign in with the email and password your representative set with you at the door, or use the secure link below to choose a new password.'
          : 'Your North Splash customer portal login was updated at the door. Use the email and password your representative confirmed with you, or the secure link below if you need to reset it.';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: ADMIN_FROM,
            to: [email],
            reply_to: 'Admin@northsplash.com',
            subject: 'Your North Splash customer account',
            html: mail(fullName || 'there', intro, actionLink, redirect),
            text: `${intro}\n\nSign in: ${redirect}\n${actionLink}`,
          }),
        });
        emailed = response.ok;
      }
    }

    await admin.from('audit_logs').insert({
      actor_user_id: user.id,
      action: created ? 'customer_account_created' : 'customer_account_updated',
      entity_type: 'profile',
      entity_id: authUser.id,
      details: { email, lead_id: leadId || null, created, membership: membership?.name || null },
    }).catch(() => {});

    return json({
      success: true,
      created,
      existing: !created,
      user_id: authUser.id,
      email,
      emailed,
      action_link: resendKey ? undefined : (actionLink || undefined),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

function mail(name: string, intro: string, link: string, login: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1eb;font-family:Arial,sans-serif;color:#211811"><div style="max-width:620px;margin:auto;padding:34px 18px"><div style="background:#17110d;color:#fff;padding:22px 26px;border-radius:16px 16px 0 0"><b style="letter-spacing:3px">NORTH SPLASH</b><div style="font-size:10px;letter-spacing:4px;color:#c9a96e">AUTO LUXE</div></div><div style="background:#fff;padding:28px 26px;border:1px solid #eadfd3;border-top:0;border-radius:0 0 16px 16px"><h2>Welcome, ${esc(name)}</h2><p style="line-height:1.6">${esc(intro)}</p><p><a href="${esc(login)}" style="display:inline-block;background:#9d7651;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:700">Open customer portal</a></p><p style="margin-top:18px"><a href="${esc(link)}" style="color:#9d7651">Reset password instead</a></p><p style="color:#87776a;font-size:12px;margin-top:26px">Questions? Reply to Admin@northsplash.com.</p></div></div></body></html>`;
}
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
