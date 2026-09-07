import type { OnboardingPacket, OnboardingStepId } from '@/lib/onboarding';

function last4(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(-4);
}

/** Gusto People → Add employee / employee self-onboarding. Ohio because North Splash payroll is Ohio. */
export const GUSTO_FILING_STATUSES = [
  'Single or Married filing separately',
  'Married filing jointly',
  'Head of household',
] as const;

export const GUSTO_OHIO_FILING = ['Single', 'Married', 'Married filing separately'] as const;

export const GUSTO_I9_STATUSES = [
  'A citizen of the United States',
  'A noncitizen national of the United States',
  'A lawful permanent resident',
  'An alien authorized to work',
] as const;

export const GUSTO_PAYMENT_METHODS = [
  { value: 'direct_deposit', label: 'Direct deposit' },
  { value: 'paper_check', label: 'Paper check' },
] as const;

export function normalizeFilingStatus(value?: string | null) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v === 'Single' || v === 'Married filing separately') return GUSTO_FILING_STATUSES[0];
  if (v === 'Married') return GUSTO_FILING_STATUSES[1];
  return v;
}

export function normalizeI9Status(value?: string | null) {
  const v = String(value || '').trim();
  if (v === 'U.S. citizen') return GUSTO_I9_STATUSES[0];
  if (v === 'Permanent resident') return GUSTO_I9_STATUSES[2];
  if (v === 'Authorized to work') return GUSTO_I9_STATUSES[3];
  return v;
}

export function gustoStepCopy(id: OnboardingStepId) {
  if (id === 'identity') return { gusto: 'Personal details', enter: 'People → Add employee → Personal details' };
  if (id === 'tax') return { gusto: 'Tax withholdings', enter: 'People → Taxes → Federal W-4 and Ohio IT-4' };
  if (id === 'pay') return { gusto: 'Payment method', enter: 'People → Pay → Payment method' };
  if (id === 'work') return { gusto: 'Form I-9', enter: 'People → Documents → Form I-9, Section 1' };
  return { gusto: 'Emergency contacts', enter: 'People → Profile → Emergency contacts' };
}

export function validateGustoStep(
  id: OnboardingStepId,
  packet: OnboardingPacket,
  drafts: { ssn?: string; routing?: string; account?: string },
  extras?: { hasHeadshot?: boolean },
): string | null {
  if (id === 'identity') {
    if (!packet.legal_first.trim() || !packet.legal_last.trim() || !packet.dob) {
      return 'Gusto needs legal first name, last name, and date of birth.';
    }
    if (!packet.street.trim() || !packet.city.trim() || !packet.state.trim() || !packet.zip.trim()) {
      return 'Gusto needs a full home address for tax withholding.';
    }
    if (!packet.personal_phone.trim()) {
      return 'Gusto needs a personal phone number.';
    }
    if (extras && extras.hasHeadshot === false) {
      return 'Add a headshot so the field roster can recognize this hire.';
    }
  }
  if (id === 'tax') {
    const four = last4(drafts.ssn) || packet.ssn_last4;
    if (four.length !== 4) return 'Enter a Social Security number. Only the last four digits are stored here — Gusto still needs the full SSN.';
    if (!packet.filing_status) return 'Choose the Gusto federal filing status from Form W-4 Step 1c.';
  }
  if (id === 'pay') {
    if (!packet.payment_method) return 'Choose how Gusto should pay this hire: direct deposit or paper check.';
    if (packet.payment_method === 'direct_deposit') {
      const r = last4(drafts.routing) || packet.routing_last4;
      const a = last4(drafts.account) || packet.account_last4;
      if (r.length !== 4 || a.length !== 4 || !packet.account_type) {
        return 'Gusto direct deposit needs routing, account, and checking or savings. Only last-fours are stored here.';
      }
    }
  }
  if (id === 'work') {
    if (!packet.work_auth) return 'Choose the Gusto I-9 citizenship / employment status.';
    if (!packet.i9_ack) return 'Gusto I-9 Section 1 requires the work-authorization attestation.';
    if (packet.work_auth === GUSTO_I9_STATUSES[3] && !packet.i9_work_until.trim()) {
      return 'Gusto needs the work-authorization expiration date for this I-9 status.';
    }
  }
  if (id === 'emergency') {
    if (!packet.emergency_name.trim() || !packet.emergency_phone.trim()) {
      return 'Gusto emergency contacts need a name and phone number.';
    }
  }
  return null;
}

export function gustoExportRows(packet: OnboardingPacket) {
  const pay = packet.payment_method === 'paper_check'
    ? 'Paper check'
    : packet.payment_method === 'direct_deposit'
      ? `Direct deposit · ${packet.account_type || 'account'} · routing ••••${packet.routing_last4 || '????'} · account ••••${packet.account_last4 || '????'}`
      : 'Not set';
  return [
    ['Gusto → Personal details', `${packet.legal_first} ${packet.legal_middle} ${packet.legal_last}`.replace(/\s+/g, ' ').trim()],
    ['Preferred name', packet.preferred || '—'],
    ['Date of birth', packet.dob || '—'],
    ['SSN in Gusto', packet.ssn_last4 ? `Enter full SSN in Gusto (OS has •••-••-${packet.ssn_last4})` : 'Missing'],
    ['Home address', [packet.street, packet.apartment, `${packet.city}, ${packet.state} ${packet.zip}`].filter(Boolean).join(', ') || '—'],
    ['Phone', packet.personal_phone || '—'],
    ['Personal email', packet.personal_email || '—'],
    ['Gusto → Federal W-4', packet.filing_status || '—'],
    ['Two jobs / spouse works', packet.two_jobs ? 'Yes (W-4 Step 2)' : 'No'],
    ['Dependents amount (W-4 Step 3)', packet.allowances || '$0'],
    ['Other income (Step 4a)', packet.other_income || '$0'],
    ['Deductions (Step 4b)', packet.w4_deductions || '$0'],
    ['Extra withholding (Step 4c)', packet.extra_withholding || '$0'],
    ['Gusto → Ohio IT-4', packet.ohio_filing_status || '—'],
    ['Ohio school district', packet.ohio_school_district || '—'],
    ['Ohio extra withholding', packet.ohio_extra_withholding || '$0'],
    ['Gusto → Payment method', pay],
    ['Bank', packet.bank_name || '—'],
    ['Gusto → Form I-9', packet.work_auth || '—'],
    ['I-9 expiration / USCIS', [packet.i9_work_until, packet.i9_uscis].filter(Boolean).join(' · ') || '—'],
    ['Gusto → Emergency contact', [packet.emergency_name, packet.emergency_relation, packet.emergency_phone, packet.emergency_email].filter(Boolean).join(' · ') || '—'],
  ] as [string, string][];
}
