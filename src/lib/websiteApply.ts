import { supabase, type Appointment, type RecruitingCandidate } from '@/lib/supabase';

export const WEBSITE_APPLY_SERVICE = 'Website job application';
export const WEBSITE_APPLY_PACKAGE = 'website-apply';

export type WebsiteApplication = {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  city?: string;
  availability?: string;
  start_when?: string;
  notes?: string;
  desired_schedule?: string;
};

export function isWebsiteJobApplication(row: Partial<Appointment> | Record<string, unknown> | null | undefined) {
  if (!row) return false;
  const service = String(row.service_name || '');
  const pack = String(row.package_name || '');
  const channel = String(row.source_channel || '');
  const kind = String(row.appointment_type || '');
  const notes = String(row.notes || '');
  return (
    pack === WEBSITE_APPLY_PACKAGE
    || service === WEBSITE_APPLY_SERVICE
    || channel === 'website_apply'
    || kind === 'job_application'
    || notes.includes('"kind":"website_job_application"')
  );
}

export function operationalAppointments<T extends Partial<Appointment>>(rows: T[]) {
  return rows.filter((row) => !row.archived && !isWebsiteJobApplication(row));
}

function positionFromPackage(value: string) {
  if (value === 'd2d_agent' || value === 'detailer' || value === 'manager') return value;
  return '';
}

export function candidateFromAppointment(row: Partial<Appointment> & Record<string, unknown>): WebsiteApplication | null {
  const notes = String(row.notes || '');
  let parsed: Record<string, unknown> = {};
  const jsonStart = notes.indexOf('{');
  if (jsonStart >= 0) {
    try { parsed = JSON.parse(notes.slice(jsonStart)); } catch { parsed = {}; }
  }
  const position = String(parsed.position || positionFromPackage(String(row.package_name || '')) || 'detailer');
  const fullName = String(parsed.full_name || row.customer_name || '').trim();
  const email = String(parsed.email || row.customer_email || '').trim().toLowerCase();
  const phone = String(parsed.phone || row.customer_phone || '').replace(/\D/g, '');
  if (fullName.length < 2 || !email.includes('@') || phone.length < 10) return null;
  return {
    full_name: fullName,
    email,
    phone,
    position: position === 'd2d_agent' || position === 'manager' ? position : 'detailer',
    city: String(parsed.city || ''),
    availability: String(parsed.availability || ''),
    start_when: String(parsed.start_when || ''),
    notes: String(parsed.notes || notes),
    desired_schedule: String(parsed.desired_schedule || ''),
  };
}

export function recruitingRowFromApplication(app: WebsiteApplication) {
  return {
    full_name: app.full_name,
    email: app.email,
    phone: app.phone,
    position: app.position,
    stage: 'applied',
    source: 'Website',
    background_status: 'not_started',
    desired_schedule: app.desired_schedule || [app.availability, app.start_when ? `start ${app.start_when}` : ''].filter(Boolean).join(' · ') || null,
    notes: app.notes || 'Website application',
  };
}

function sameApplicant(existing: RecruitingCandidate, app: WebsiteApplication) {
  return String(existing.email || '').toLowerCase() === app.email && existing.position === app.position;
}

export async function importWebsiteApplications() {
  const { data: rows, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) return { imported: 0, error: error.message };

  const pending = (rows || []).filter(isWebsiteJobApplication).map(candidateFromAppointment).filter(Boolean) as WebsiteApplication[];
  if (!pending.length) return { imported: 0 };

  const { data: existing } = await supabase
    .from('recruiting_candidates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  const have = existing || [];
  let imported = 0;

  for (const app of pending) {
    if (have.some((row) => sameApplicant(row, app))) continue;
    const insert = await supabase.from('recruiting_candidates').insert(recruitingRowFromApplication(app)).select().single();
    if (insert.error) continue;
    if (insert.data) {
      have.unshift(insert.data);
      imported += 1;
    }
  }

  return { imported, candidates: have };
}
