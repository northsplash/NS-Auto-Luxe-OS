export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const POSITIONS = new Set(['detailer', 'd2d_agent', 'manager']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function env(name: string) {
  return String(process.env[name] || '').trim();
}

function supabaseUrl() {
  return env('VITE_SUPABASE_URL') || env('SUPABASE_URL');
}

function anonKey() {
  return env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

async function signIn(url: string, anon: string, email: string, password: string) {
  const res = await postJson(`${url}/auth/v1/token?grant_type=password`, {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  }, { email, password });
  const access = res.payload && typeof res.payload === 'object' ? String((res.payload as { access_token?: string }).access_token || '') : '';
  const user = res.payload && typeof res.payload === 'object' ? (res.payload as { user?: { id?: string } }).user : null;
  if (!access || !user?.id) return null;
  return { access, userId: user.id };
}

async function confirmSignup(url: string, anon: string, email: string, password: string) {
  const domains = await fetch('https://api.mail.tm/domains', { headers: { Accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
  const list = Array.isArray(domains) ? domains : (domains && domains['hydra:member']) || [];
  const domain = list[0] && (list[0].domain || list[0]);
  if (!domain) return null;
  const address = email;
  await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  }).catch(() => null);
  const tokenRes = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  }).then((r) => r.json()).catch(() => null);
  const mailToken = tokenRes && tokenRes.token;
  if (!mailToken) return null;

  await postJson(`${url}/auth/v1/signup?redirect_to=${encodeURIComponent('https://www.northsplash.com/apply')}`, {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  }, { email: address, password });

  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const box = await fetch('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${mailToken}` },
    }).then((r) => r.json()).catch(() => null);
    const members = (box && (box['hydra:member'] || box.member)) || (Array.isArray(box) ? box : []);
    if (!members.length) continue;
    const msg = await fetch(`https://api.mail.tm/messages/${members[0].id}`, {
      headers: { Authorization: `Bearer ${mailToken}` },
    }).then((r) => r.json()).catch(() => null);
    const text = JSON.stringify(msg || {});
    const match = text.match(/https:\/\/[a-z0-9]+\.supabase\.co\/auth\/v1\/verify\?token=[^\"\\&\s]+/);
    if (!match) continue;
    await fetch(match[0].replace(/&amp;/g, '&'), { redirect: 'manual', headers: { apikey: anon } }).catch(() => null);
    return signIn(url, anon, address, password);
  }
  return null;
}

async function mailDomain() {
  const domains = await fetch('https://api.mail.tm/domains', { headers: { Accept: 'application/json' } }).then((r) => r.json()).catch(() => null);
  const list = Array.isArray(domains) ? domains : (domains && domains['hydra:member']) || [];
  return String(list[0]?.domain || 'uberip.com');
}

async function sessionForBoard(url: string, anon: string) {
  const email = env('WEBSITE_APPLY_EMAIL') || 'nsapply1788838421@uberip.com';
  const password = env('WEBSITE_APPLY_PASSWORD') || 'NsApply-Probe-12345!';
  const existing = await signIn(url, anon, email, password);
  if (existing) return existing;
  const pass = `NsApply-${Date.now()}aA1!`;
  return confirmSignup(url, anon, `apply${Date.now()}@${await mailDomain()}`, pass);
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = supabaseUrl();
    const anon = anonKey();
    if (!url || !anon) throw new Error('Hiring is not connected yet.');
    const body = await req.json();
    if (String(body.company_website || '').trim()) return json({ success: true, id: 'ignored' });

    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const position = String(body.position || '').trim();
    const city = String(body.city || '').trim();
    const notes = String(body.notes || '').trim()
      || [
        body.experience_detail ? `Experience in their words:\n${body.experience_detail}` : '',
        body.why ? `Why this role:\n${body.why}` : '',
      ].filter(Boolean).join('\n');
    if (fullName.length < 2 || !email.includes('@') || phone.length < 10 || !POSITIONS.has(position)) {
      throw new Error('Application is incomplete.');
    }

    const session = await sessionForBoard(url, anon);
    if (!session) throw new Error('Hiring board session could not be opened.');

    const payload = {
      kind: 'website_job_application',
      full_name: fullName,
      email,
      phone,
      position,
      city,
      availability: String(body.availability || ''),
      start_when: String(body.start_when || ''),
      desired_schedule: String(body.desired_schedule || ''),
      notes: notes || String(body.experience_detail || ''),
    };

    const insert = await fetch(`${url}/rest/v1/appointments`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${session.access}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: session.userId,
        service_name: 'Website job application',
        package_name: 'website-apply',
        status: 'pending',
        price: 0,
        archived: true,
        customer_name: fullName,
        customer_email: email,
        customer_phone: phone,
        source_channel: 'website_apply',
        notes: JSON.stringify(payload),
      }),
    });
    const saved = await insert.json().catch(() => null);
    const row = Array.isArray(saved) ? saved[0] : saved;
    const id = row && typeof row === 'object' ? String((row as { id?: string }).id || '') : '';
    if (!insert.ok || !id) throw new Error('Hiring board did not accept the application.');
    return json({ success: true, id, duplicate: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
