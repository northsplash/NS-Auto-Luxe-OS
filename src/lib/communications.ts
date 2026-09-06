import { supabase } from './supabase';
import type { Appointment } from './supabase';
import { firstWord, money } from './data';

export type CommunicationEvent =
  | 'booking_received' | 'booking_confirmed' | 'booking_declined' | 'appointment_reminder' | 'appointment_reminder_24h' | 'appointment_reminder_2h'
  | 'appointment_rescheduled' | 'appointment_cancelled' | 'detailer_assigned'
  | 'detailer_en_route' | 'detailer_approaching' | 'detailer_arrived' | 'job_started' | 'job_completed'
  | 'invoice_sent' | 'payment_reminder' | 'payment_received' | 'refund_issued' | 'receipt_ready' | 'thank_you' | 'review_request' | 'rebooking_30d' | 'rebooking_90d' | 'estimate_sent' | 'membership_update'
  | 'application_received' | 'first_interview' | 'second_interview' | 'background_check'
  | 'job_offer' | 'offer_accepted' | 'offer_declined' | 'onboarding' | 'start_date'
  | 'training_assigned' | 'employee_invite' | 'schedule_changed';

export async function sendCommunication(event_key: CommunicationEvent | string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('send-communication', {
    body: { event_key, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function notifyCustomer(
  event_key: CommunicationEvent,
  job: Pick<Appointment, 'id' | 'customer_email' | 'customer_name' | 'service_name' | 'scheduled_at' | 'price' | 'vehicle_info' | 'service_address'>,
  extra: Record<string, unknown> = {},
) {
  const email = job.customer_email;
  if (!email) return Promise.resolve();
  return sendCommunication(event_key, {
    appointment_id: job.id,
    recipient_email: email,
    variables: {
      customer_name: job.customer_name || 'Customer',
      customer_first_name: firstWord(job.customer_name, 'there'),
      service_name: job.service_name,
      service: job.service_name,
      appointment_time: job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : '',
      price: money(Number(job.price || 0)),
      vehicle: job.vehicle_info || '',
      service_address: job.service_address || '',
      ...extra,
    },
  }).catch((err) => console.warn(err));
}

export async function logAudit(action: string, entity_type: string, entity_id?: string | null, details: Record<string, unknown> = {}) {
  try {
    await supabase.from('audit_logs').insert({ action, entity_type, entity_id: entity_id || null, details });
  } catch {
    // Audit logging must never block the user's operational action.
  }
}
