import type { Appointment, Employee, Payment, Profile } from '@/lib/supabase';

const KEY = 'ns_owner_home_cache_v1';
const MAX_AGE_MS = 8 * 60 * 1000;

export type OwnerHomeCache = {
  at: number;
  appointments: Appointment[];
  employees: Employee[];
  customers: Profile[];
  payments: Payment[];
};

export function readOwnerHomeCache(): OwnerHomeCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as OwnerHomeCache | null;
    if (!parsed || Date.now() - Number(parsed.at || 0) > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.appointments) || !Array.isArray(parsed.employees)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOwnerHomeCache(payload: Omit<OwnerHomeCache, 'at'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ...payload }));
  } catch {
    /* private mode / quota */
  }
}
