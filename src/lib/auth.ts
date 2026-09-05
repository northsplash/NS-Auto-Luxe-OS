import { supabase } from './supabase';
export type { Profile } from './supabase';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  phone: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
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

export async function trackPageView(page: string) {
  const sessionId =
    sessionStorage.getItem('ns_session') || crypto.randomUUID();

  sessionStorage.setItem('ns_session', sessionId);

  const { data: { session } } = await supabase.auth.getSession();
  const payload = {
    page,
    referrer: document.referrer || null,
    session_id: sessionId,
    user_agent: navigator.userAgent,
    user_id: session?.user?.id || null,
  };
  const first=await supabase.from('site_visits').insert(payload);
  if(first.error && /user_id/i.test(first.error.message||'')){
    const {user_id: _legacyUserId, ...legacyPayload}=payload;
    await supabase.from('site_visits').insert(legacyPayload);
  }
}
