import { supabase } from './supabase';

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

export async function logAudit(action: string, entity_type: string, entity_id?: string | null, details: Record<string, unknown> = {}) {
  try {
    await supabase.from('audit_logs').insert({ action, entity_type, entity_id: entity_id || null, details });
  } catch {
    // Audit logging must never block the user's operational action.
  }
}
