import { houseNumber, streetName } from '@/lib/fieldReview';
import type { OsCustomer, OsJob, OsLead, OsPayment } from '@/os/demoData';

export function phoneDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

export function sameHousehold(
  customer: Pick<OsCustomer, 'name' | 'phone' | 'email' | 'address'>,
  lead: Pick<OsLead, 'name' | 'phone' | 'email' | 'address' | 'alt_phone'>,
) {
  const digits = phoneDigits(customer.phone);
  if (digits.length >= 7 && (phoneDigits(lead.phone) === digits || phoneDigits(lead.alt_phone) === digits)) return true;
  const email = String(customer.email || '').trim().toLowerCase();
  if (email && email === String(lead.email || '').trim().toLowerCase()) return true;
  const customerName = String(customer.name || '').trim().toLowerCase();
  const leadName = String(lead.name || '').trim().toLowerCase();
  if (customerName && leadName && customerName === leadName && customerName !== 'unknown door') return true;
  const customerStreet = streetName(customer.address);
  const leadStreet = streetName(lead.address);
  const customerHouse = houseNumber(customer.address);
  const leadHouse = houseNumber(lead.address);
  return Boolean(
    customerStreet
    && customerStreet === leadStreet
    && Number.isFinite(customerHouse)
    && customerHouse === leadHouse
    && customerHouse < Number.POSITIVE_INFINITY,
  );
}

export function householdJobs(customer: OsCustomer, jobs: OsJob[]) {
  return jobs.filter((job) => job.customer === customer.name);
}

export function householdLeads(customer: OsCustomer, leads: OsLead[]) {
  return leads.filter((lead) => sameHousehold(customer, lead));
}

export function householdPayments(customer: OsCustomer, payments: OsPayment[]) {
  return payments.filter((payment) => payment.customer === customer.name);
}

export function householdPhotos(jobs: OsJob[]) {
  return jobs.flatMap((job) => (job.photos || []).map((photo) => ({ ...photo, jobId: job.id, service: job.service })));
}

export function householdBalance(jobs: OsJob[]) {
  return jobs.filter((job) => job.payment === 'due').reduce((sum, job) => sum + Number(job.price || 0), 0);
}

export function householdLifetime(jobs: OsJob[], payments: OsPayment[]) {
  const fromJobs = jobs.reduce((sum, job) => sum + Number(job.price || 0), 0);
  if (fromJobs) return fromJobs;
  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}
