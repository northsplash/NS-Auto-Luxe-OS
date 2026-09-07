import { supabase, type Employee } from '@/lib/supabase';
import { isOwnerFieldEmployee } from '@/lib/ownerFieldMode';
import { assignAcademyForEmployee, courseIdsForEmployee, D2D_ACADEMY_ID, DETAIL_ACADEMY_ID } from '@/lib/trainingAcademy';
import { normalizeFilingStatus, normalizeI9Status } from '@/lib/gustoPayroll';

export const ONBOARDING_STEPS = ['identity', 'tax', 'pay', 'work', 'emergency'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type OnboardingPacket = {
  legal_first: string;
  legal_middle: string;
  legal_last: string;
  preferred: string;
  dob: string;
  ssn_last4: string;
  ssn_on_file: boolean;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  personal_email: string;
  personal_phone: string;
  work_auth: string;
  i9_uscis: string;
  i9_work_until: string;
  filing_status: string;
  allowances: string;
  extra_withholding: string;
  two_jobs: boolean;
  other_income: string;
  w4_deductions: string;
  ohio_filing_status: string;
  ohio_school_district: string;
  ohio_extra_withholding: string;
  bank_name: string;
  routing_last4: string;
  account_last4: string;
  account_type: 'checking' | 'savings' | '';
  payment_method: 'direct_deposit' | 'paper_check' | '';
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string;
  emergency_email: string;
  handbook_ack: boolean;
  i9_ack: boolean;
  headshot?: string;
  steps: Record<string, boolean>;
};

export const PACKET_TASK_TITLE = '__onboarding_packet__';

export function emptyOnboarding(): OnboardingPacket {
  return {
    legal_first: '', legal_middle: '', legal_last: '', preferred: '', dob: '',
    ssn_last4: '', ssn_on_file: false, street: '', apartment: '', city: '', state: '', zip: '',
    personal_email: '', personal_phone: '',
    work_auth: '', i9_uscis: '', i9_work_until: '',
    filing_status: '', allowances: '', extra_withholding: '', two_jobs: false, other_income: '', w4_deductions: '',
    ohio_filing_status: '', ohio_school_district: '', ohio_extra_withholding: '',
    bank_name: '', routing_last4: '', account_last4: '', account_type: '', payment_method: 'direct_deposit',
    emergency_name: '', emergency_phone: '', emergency_relation: '', emergency_email: '',
    handbook_ack: false, i9_ack: false, steps: {},
  };
}

export function last4(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(-4);
}

export const ONBOARDING_STEP_META: Array<{ id: OnboardingStepId; label: string; hint: string; next: string; gusto: string }> = [
  { id: 'identity', label: 'Personal', gusto: 'Personal details', hint: 'The same personal details Gusto asks when you add an employee: legal name, birthday, home address, phone, and email.', next: 'Gusto personal details' },
  { id: 'tax', label: 'W-4 & Ohio', gusto: 'Tax withholdings', hint: 'Federal Form W-4 (2020+) and Ohio IT-4 — the screens Gusto opens under Taxes. OS keeps only the last four of the SSN; enter the full SSN in Gusto.', next: 'Gusto tax withholdings' },
  { id: 'pay', label: 'Payment', gusto: 'Payment method', hint: 'How Gusto pays this person: direct deposit or paper check. Routing and account stay last-four here; type the full numbers into Gusto.', next: 'Gusto payment method' },
  { id: 'work', label: 'I-9', gusto: 'Form I-9', hint: 'Form I-9 Section 1 citizenship status, matching Gusto’s I-9.', next: 'Gusto Form I-9' },
  { id: 'emergency', label: 'Emergency', gusto: 'Emergency contacts', hint: 'Name, relationship, phone, and email — Gusto’s emergency contact fields.', next: 'Gusto emergency contacts' },
];

export function onboardingPercent(packet?: OnboardingPacket | null) {
  const done = ONBOARDING_STEPS.filter((s) => packet?.steps?.[s]).length;
  return Math.round((done / ONBOARDING_STEPS.length) * 100);
}

export function remainingStepIds(packet?: OnboardingPacket | null) {
  return ONBOARDING_STEPS.filter((id) => !packet?.steps?.[id]);
}

export function remainingStepLabels(packet?: OnboardingPacket | null) {
  return remainingStepIds(packet).map((id) => ONBOARDING_STEP_META.find((s) => s.id === id)?.label || id);
}

export function nextOnboardingStep(packet?: OnboardingPacket | null) {
  const id = remainingStepIds(packet)[0];
  return ONBOARDING_STEP_META.find((s) => s.id === id) || null;
}

export function academyNextLabel(employee?: Pick<Employee, 'role' | 'work_modes'> | null) {
  if (!employee) return 'New-hire academy';
  const ids = courseIdsForEmployee(employee as Employee);
  const d2d = ids.includes(D2D_ACADEMY_ID);
  const detail = ids.includes(DETAIL_ACADEMY_ID);
  if (d2d && detail) return 'Door-to-door and detailing academies';
  if (d2d) return 'Door-to-door academy';
  if (detail) return 'Detailing academy';
  return 'New-hire academy';
}

export function onboardingStatusLabel(percent: number) {
  if (percent >= 100) return 'complete';
  if (percent > 0) return 'in_progress';
  return 'not_started';
}

export function isOnboardingOpen(status?: string | null) {
  const st = String(status || '').toLowerCase();
  return Boolean(st) && !['complete', 'completed', 'done'].includes(st);
}

export function isLeadershipSeat(employee?: Pick<Employee, 'role' | 'title' | 'department' | 'notes' | 'work_modes' | 'employment_level'> | null) {
  if (!employee) return false;
  const role = String(employee.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return isOwnerFieldEmployee(employee as Employee);
}

export function isHirePacketOpen(employee?: Employee | null) {
  return Boolean(employee) && isOnboardingOpen(employee.onboarding_status) && !isLeadershipSeat(employee);
}

export function preferLinkedPeople<T extends { id: string; email?: string | null; user_id?: string | null }>(people: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const person of people) {
    const key = String(person.email || '').trim().toLowerCase() || `id:${person.id}`;
    const prev = byKey.get(key);
    if (!prev || (!prev.user_id && person.user_id)) byKey.set(key, person);
  }
  return [...byKey.values()];
}

function fromRow(row: Record<string, unknown>): OnboardingPacket {
  const steps = (row.steps && typeof row.steps === 'object') ? row.steps as Record<string, boolean> : {};
  const gusto = (row.gusto && typeof row.gusto === 'object') ? row.gusto as Record<string, unknown> : {};
  const pick = (key: string, fallback = '') => String(row[key] ?? gusto[key] ?? fallback);
  const pickBool = (key: string) => Boolean(row[key] ?? gusto[key]);
  return {
    ...emptyOnboarding(),
    legal_first: pick('legal_first'),
    legal_middle: pick('legal_middle'),
    legal_last: pick('legal_last'),
    preferred: pick('preferred'),
    dob: pick('dob'),
    ssn_last4: pick('ssn_last4'),
    ssn_on_file: Boolean(pick('ssn_last4')) || pickBool('ssn_on_file'),
    street: pick('street'),
    apartment: pick('apartment'),
    city: pick('city'),
    state: pick('state'),
    zip: pick('zip'),
    personal_email: pick('personal_email'),
    personal_phone: pick('personal_phone'),
    work_auth: normalizeI9Status(pick('work_auth')),
    i9_uscis: pick('i9_uscis'),
    i9_work_until: pick('i9_work_until'),
    filing_status: normalizeFilingStatus(pick('filing_status')),
    allowances: pick('allowances'),
    extra_withholding: pick('extra_withholding'),
    two_jobs: pickBool('two_jobs'),
    other_income: pick('other_income'),
    w4_deductions: pick('w4_deductions'),
    ohio_filing_status: pick('ohio_filing_status'),
    ohio_school_district: pick('ohio_school_district'),
    ohio_extra_withholding: pick('ohio_extra_withholding'),
    bank_name: pick('bank_name'),
    routing_last4: pick('routing_last4'),
    account_last4: pick('account_last4'),
    account_type: (row.account_type === 'checking' || row.account_type === 'savings' || gusto.account_type === 'checking' || gusto.account_type === 'savings')
      ? (String(row.account_type || gusto.account_type) as 'checking' | 'savings')
      : '',
    payment_method: pick('payment_method') === 'paper_check'
      ? 'paper_check'
      : pick('payment_method') === 'direct_deposit' || pick('routing_last4')
        ? 'direct_deposit'
        : '',
    emergency_name: pick('emergency_name'),
    emergency_phone: pick('emergency_phone'),
    emergency_relation: pick('emergency_relation'),
    emergency_email: pick('emergency_email'),
    handbook_ack: pickBool('handbook_ack'),
    i9_ack: pickBool('i9_ack'),
    steps,
  };
}

function gustoBag(packet: OnboardingPacket) {
  return {
    apartment: packet.apartment,
    personal_email: packet.personal_email,
    personal_phone: packet.personal_phone,
    i9_uscis: packet.i9_uscis,
    i9_work_until: packet.i9_work_until,
    two_jobs: packet.two_jobs,
    other_income: packet.other_income,
    w4_deductions: packet.w4_deductions,
    ohio_filing_status: packet.ohio_filing_status,
    ohio_school_district: packet.ohio_school_district,
    ohio_extra_withholding: packet.ohio_extra_withholding,
    payment_method: packet.payment_method,
    emergency_email: packet.emergency_email,
  };
}

function toProfileRow(employeeId: string, packet: OnboardingPacket) {
  return {
    employee_id: employeeId,
    legal_first: packet.legal_first,
    legal_middle: packet.legal_middle,
    legal_last: packet.legal_last,
    preferred: packet.preferred,
    dob: packet.dob || null,
    ssn_last4: packet.ssn_last4 || null,
    street: packet.street,
    apartment: packet.apartment,
    city: packet.city,
    state: packet.state,
    zip: packet.zip,
    personal_email: packet.personal_email,
    personal_phone: packet.personal_phone,
    work_auth: packet.work_auth,
    i9_uscis: packet.i9_uscis,
    i9_work_until: packet.i9_work_until,
    filing_status: packet.filing_status,
    allowances: packet.allowances,
    extra_withholding: packet.extra_withholding,
    two_jobs: packet.two_jobs,
    other_income: packet.other_income,
    w4_deductions: packet.w4_deductions,
    ohio_filing_status: packet.ohio_filing_status,
    ohio_school_district: packet.ohio_school_district,
    ohio_extra_withholding: packet.ohio_extra_withholding,
    bank_name: packet.bank_name,
    routing_last4: packet.routing_last4 || null,
    account_last4: packet.account_last4 || null,
    account_type: packet.account_type || null,
    payment_method: packet.payment_method || null,
    emergency_name: packet.emergency_name,
    emergency_phone: packet.emergency_phone,
    emergency_relation: packet.emergency_relation,
    emergency_email: packet.emergency_email,
    handbook_ack: packet.handbook_ack,
    i9_ack: packet.i9_ack,
    gusto: gustoBag(packet),
    steps: packet.steps,
    percent_complete: onboardingPercent(packet),
    updated_at: new Date().toISOString(),
  };
}

export async function loadOnboardingPacket(employeeId: string): Promise<OnboardingPacket> {
  const profile = await supabase.from('employee_onboarding_profiles').select('*').eq('employee_id', employeeId).maybeSingle();
  if (!profile.error && profile.data) return fromRow(profile.data as Record<string, unknown>);
  const task = await supabase.from('onboarding_tasks').select('description').eq('employee_id', employeeId).eq('title', PACKET_TASK_TITLE).maybeSingle();
  if (task.data?.description) {
    try {
      const parsed = JSON.parse(task.data.description);
      if (parsed && typeof parsed === 'object') {
        return {
          ...emptyOnboarding(),
          ...parsed,
          filing_status: normalizeFilingStatus(parsed.filing_status),
          work_auth: normalizeI9Status(parsed.work_auth),
          steps: parsed.steps || {},
        };
      }
    } catch { /* ignore corrupt packet notes */ }
  }
  return emptyOnboarding();
}

export async function saveOnboardingPacket(employee: Employee, packet: OnboardingPacket) {
  const percent = onboardingPercent(packet);
  const status = onboardingStatusLabel(percent);
  const profileRow = toProfileRow(employee.id, packet);
  let upsert = await supabase.from('employee_onboarding_profiles').upsert(profileRow, { onConflict: 'employee_id' });
  if (upsert.error) {
    upsert = await supabase.from('employee_onboarding_profiles').upsert({
      employee_id: employee.id,
      legal_first: packet.legal_first,
      legal_middle: packet.legal_middle,
      legal_last: packet.legal_last,
      preferred: packet.preferred,
      dob: packet.dob || null,
      ssn_last4: packet.ssn_last4 || null,
      street: packet.street,
      city: packet.city,
      state: packet.state,
      zip: packet.zip,
      work_auth: packet.work_auth,
      filing_status: packet.filing_status,
      allowances: packet.allowances,
      extra_withholding: packet.extra_withholding,
      bank_name: packet.bank_name,
      routing_last4: packet.routing_last4 || null,
      account_last4: packet.account_last4 || null,
      account_type: packet.account_type || null,
      emergency_name: packet.emergency_name,
      emergency_phone: packet.emergency_phone,
      emergency_relation: packet.emergency_relation,
      handbook_ack: packet.handbook_ack,
      i9_ack: packet.i9_ack,
      gusto: gustoBag(packet),
      steps: packet.steps,
      percent_complete: percent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id' });
  }
  if (upsert.error) {
    const existing = await supabase.from('onboarding_tasks').select('id').eq('employee_id', employee.id).eq('title', PACKET_TASK_TITLE).maybeSingle();
    const payload = {
      employee_id: employee.id,
      title: PACKET_TASK_TITLE,
      description: JSON.stringify(packet),
      category: 'packet',
      required: true,
      status: percent >= 100 ? 'completed' : 'pending',
      completed_at: percent >= 100 ? new Date().toISOString() : null,
    };
    if (existing.data?.id) {
      const { error } = await supabase.from('onboarding_tasks').update(payload).eq('id', existing.data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('onboarding_tasks').insert(payload);
      if (error) throw error;
    }
  }

  const displayName = [packet.preferred || packet.legal_first, packet.legal_last].filter(Boolean).join(' ').trim();
  const employeePatch: Record<string, unknown> = {
    emergency_contact: packet.emergency_name || null,
    emergency_phone: packet.emergency_phone || null,
    onboarding_status: status,
  };
  if (packet.steps.identity && displayName) employeePatch.name = displayName;
  if (packet.personal_phone) employeePatch.phone = packet.personal_phone;
  if (packet.personal_email) employeePatch.email = packet.personal_email;
  await syncHireTasks(employee.id, packet);
  const { data, error } = await supabase.from('employees').update(employeePatch).eq('id', employee.id).select().single();
  if (error && !/onboarding_status/i.test(error.message)) throw error;
  if (error && /onboarding_status/i.test(error.message)) {
    delete employeePatch.onboarding_status;
    const retry = await supabase.from('employees').update(employeePatch).eq('id', employee.id).select().single();
    if (retry.error) throw retry.error;
    return retry.data as Employee;
  }
  return (data || employee) as Employee;
}

export const DEFAULT_HIRE_TASKS: Array<{ title: string; description: string; category: string }> = [
  { title: 'Identity & headshot', description: 'Gusto personal details: legal name, birthday, home address, phone, email, roster photo.', category: 'identity' },
  { title: 'Tax withholding (W-4)', description: 'Gusto federal W-4 (2020+) and Ohio IT-4. Last-four of SSN only in OS.', category: 'tax' },
  { title: 'Direct deposit', description: 'Gusto payment method: direct deposit or paper check.', category: 'pay' },
  { title: 'I-9 work eligibility', description: 'Gusto Form I-9 Section 1 citizenship status and attestation.', category: 'work' },
  { title: 'Emergency contact', description: 'Gusto emergency contact: name, relationship, phone, email.', category: 'emergency' },
  { title: 'Review company policies', description: 'Read the North Splash handbook and workplace policies.', category: 'policy' },
];

export async function seedHireOnboarding(employee: Employee, role?: string) {
  const hire = { ...employee, role: role || employee.role } as Employee;
  await supabase.from('employees').update({ onboarding_status: 'in_progress' }).eq('id', employee.id);
  const academyIds = courseIdsForEmployee(hire);
  const extra = [
    ...(academyIds.includes(D2D_ACADEMY_ID) ? [{ title: 'Complete door-to-door academy', description: 'Map, knock colors, door script, and next house. Pass the quiz before you canvass live.', category: 'd2d' }] : []),
    ...(academyIds.includes(DETAIL_ACADEMY_ID) ? [{ title: 'Complete detailing academy', description: 'Job packet, live status, photos, checklist, and QC. Pass the quiz before you run jobs solo.', category: 'detailer' }] : []),
  ];
  for (const task of [...DEFAULT_HIRE_TASKS, ...extra]) {
    const existing = await supabase.from('onboarding_tasks').select('id').eq('employee_id', employee.id).eq('title', task.title).maybeSingle();
    if (!existing.data) {
      await supabase.from('onboarding_tasks').insert({
        employee_id: employee.id,
        title: task.title,
        description: task.description,
        category: task.category,
        required: true,
        status: 'pending',
      });
    }
  }
  try { await assignAcademyForEmployee(hire); } catch (err) { console.warn('Academy assign skipped', err); }
}

export type OnboardingTask = {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  required?: boolean;
};

export async function loadOnboardingTasks(employeeId: string): Promise<OnboardingTask[]> {
  const { data } = await supabase.from('onboarding_tasks').select('*').eq('employee_id', employeeId).order('created_at');
  return ((data || []) as OnboardingTask[]).filter((t) => t.title !== PACKET_TASK_TITLE);
}

async function syncHireTasks(employeeId: string, packet: OnboardingPacket) {
  const titles: string[] = [];
  if (packet.steps.identity) titles.push('Identity & headshot');
  if (packet.steps.tax) titles.push('Tax withholding (W-4)');
  if (packet.steps.pay) titles.push('Direct deposit');
  if (packet.steps.work) titles.push('I-9 work eligibility');
  if (packet.handbook_ack || packet.steps.work) titles.push('Review company policies');
  if (packet.steps.emergency) titles.push('Emergency contact');
  if (!titles.length) return;
  await supabase.from('onboarding_tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('employee_id', employeeId).in('title', titles);
}

export type OnboardingSummary = {
  employeeId: string;
  percent: number;
  nextLabel: string;
  remaining: string[];
};

export async function loadOnboardingSummaries(employeeIds: string[]): Promise<OnboardingSummary[]> {
  if (!employeeIds.length) return [];
  const { data } = await supabase.from('employee_onboarding_profiles').select('employee_id, percent_complete, steps').in('employee_id', employeeIds);
  const byId = new Map((data || []).map((row: Record<string, unknown>) => [String(row.employee_id), row]));
  return employeeIds.map((id) => {
    const row = byId.get(id);
    const packet = row ? fromRow(row) : emptyOnboarding();
    const remaining = remainingStepLabels(packet);
    return {
      employeeId: id,
      percent: Number(row?.percent_complete ?? onboardingPercent(packet)) || 0,
      nextLabel: remaining[0] || 'Packet complete',
      remaining,
    };
  });
}
