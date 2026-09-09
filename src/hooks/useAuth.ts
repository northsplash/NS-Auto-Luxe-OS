import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, getProfile } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileError('');
    try {
      const next = await getProfile(userId);
      setProfile(next);
    } catch (err) {
      setProfile(null);
      setProfileError(err instanceof Error && err.message ? err.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setProfileError('');
          setLoading(false);
        }
      } catch {
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileError('');
        setLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setLoading(true);
        setTimeout(() => {
          void loadProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setProfileError('');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  return { user, session, profile, profileError, loading, reloadProfile };
}
