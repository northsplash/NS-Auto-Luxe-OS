import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/lib/supabase';

const SETTLED = new Set(['paid', 'succeeded', 'completed', 'settled']);

export type CollectMethod = 'cash' | 'check' | 'card';

export function isJobPaid(job?: Pick<Appointment, 'payment_status'> | null) {
  return SETTLED.has(String(job?.payment_status || '').toLowerCase());
}

export function canCollectJob(job?: Pick<Appointment, 'field_status' | 'status' | 'payment_status'> | null) {
  if (!job || isJobPaid(job)) return false;
  const field = String(job.field_status || '').toLowerCase();
  const status = String(job.status || '').toLowerCase();
  return field === 'finished' || status === 'completed' || status === 'finished';
}

export async function markJobCollected(job: Appointment, method: CollectMethod) {
  const amount = Number(job.price || 0);
  const description = `${job.service_name || job.package_name || 'Detail'} · ${method}`;
  const base = {
    user_id: job.user_id || null,
    appointment_id: job.id,
    amount,
    status: 'completed',
    description,
  };
  let inserted = await supabase.from('payments').insert({ ...base, method }).select('id').maybeSingle();
  if (inserted.error && /method/i.test(inserted.error.message || '')) {
    inserted = await supabase.from('payments').insert(base).select('id').maybeSingle();
  }
  if (inserted.error) throw inserted.error;

  const { data, error } = await supabase
    .from('appointments')
    .update({ payment_status: 'paid' })
    .eq('id', job.id)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}
