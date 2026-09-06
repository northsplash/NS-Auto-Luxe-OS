import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/lib/supabase';
import { notifyCustomer } from '@/lib/communications';

const SETTLED = new Set(['paid', 'succeeded', 'completed', 'settled']);

export type CollectMethod = 'cash' | 'check' | 'card';

export function isJobPaid(job?: Pick<Appointment, 'payment_status'> | null) {
  return SETTLED.has(String(job?.payment_status || '').toLowerCase());
}

export function isJobFinished(job?: Pick<Appointment, 'field_status' | 'status' | 'finished_at'> | null) {
  if (!job) return false;
  const field = String(job.field_status || '').toLowerCase();
  const status = String(job.status || '').toLowerCase();
  return field === 'finished' || status === 'finished' || status === 'completed' || Boolean(job.finished_at);
}

export function canCollectJob(job?: Pick<Appointment, 'field_status' | 'status' | 'payment_status' | 'finished_at' | 'archived'> | null) {
  if (!job || isJobPaid(job) || job.archived) return false;
  const status = String(job.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'no_show') return false;
  return isJobFinished(job);
}

export function qcIsPassed(job?: Pick<Appointment, 'qc_status'> | null) {
  const q = String(job?.qc_status || '').toLowerCase();
  return q === 'passed' || q === 'complete' || q === 'completed';
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
    payment_method: method,
  };

  await supabase
    .from('payments')
    .update({ status: 'completed', description: `${description} · settled` })
    .eq('appointment_id', job.id)
    .in('status', ['pending', 'unpaid', 'due', 'failed']);

  let inserted = await supabase.from('payments').insert(base).select('id').maybeSingle();
  if (inserted.error && /payment_method|method/i.test(inserted.error.message || '')) {
    const { payment_method: _method, ...rest } = base;
    inserted = await supabase.from('payments').insert(rest).select('id').maybeSingle();
  }
  if (inserted.error) throw inserted.error;

  const patch: Record<string, unknown> = { payment_status: 'paid' };
  if (qcIsPassed(job)) {
    patch.status = 'completed';
    patch.field_status = 'completed';
    patch.completed_at = job.completed_at || new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', job.id)
    .select()
    .single();
  if (error) throw error;
  const next = data as Appointment;
  void notifyCustomer('payment_received', next, { payment_method: method });
  if (qcIsPassed(job) || next.status === 'completed') void notifyCustomer('job_completed', next);
  return next;
}
