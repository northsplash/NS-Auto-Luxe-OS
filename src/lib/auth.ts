import { isDemoMode, supabase } from './supabase';
export type { Profile } from './supabase';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  phone: string,
  referrerContact = '',
) {
  const contact = referrerContact.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        referred: Boolean(contact),
        referrer_contact: contact,
      },
    },
  });

  if (error) throw error;

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

const VISIT_BLOCK_KEY = 'ns_visit_blocked_v2';

function visitStore(key: string, value?: string) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return null;
  }
}

export async function trackPageView(page: string) {
  if (typeof window === 'undefined') return;
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
  if (isDemoMode || !supabaseUrl || /placeholder\.supabase\.co/i.test(supabaseUrl)) return;
  if (visitStore(VISIT_BLOCK_KEY) === '1') return;

  const sessionId = visitStore('ns_session') || crypto.randomUUID();
  visitStore('ns_session', sessionId);

  const { error } = await supabase.rpc('log_site_visit', {
    p_page: String(page || '/').slice(0, 200),
    p_referrer: (document.referrer || '').slice(0, 500) || null,
    p_session_id: sessionId,
    p_user_agent: (navigator.userAgent || '').slice(0, 400) || null,
  });
  if (error) visitStore(VISIT_BLOCK_KEY, '1');
}
