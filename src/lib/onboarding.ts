import { supabase, type Employee } from '@/lib/supabase';

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
  city: string;
  state: string;
  zip: string;
  work_auth: string;
  filing_status: string;
  allowances: string;
  extra_withholding: string;
  bank_name: string;
  routing_last4: string;
  account_last4: string;
  account_type: 'checking' | 'savings' | '';
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string;
  handbook_ack: boolean;
  i9_ack: boolean;
  steps: Record<string, boolean>;
};

export const PACKET_TASK_TITLE = '__onboarding_packet__';

export function emptyOnboarding(): OnboardingPacket {
  return {
    legal_first: '', legal_middle: '', legal_last: '', preferred: '', dob: '',
    ssn_last4: '', ssn_on_file: false, street: '', city: '', state: '', zip: '',
    work_auth: '', filing_status: '', allowances: '', extra_withholding: '',
    bank_name: '', routing_last4: '', account_last4: '', account_type: '',
    emergency_name: '', emergency_phone: '', emergency_relation: '',
    handbook_ack: false, i9_ack: false, steps: {},
  };
}

export function last4(value: string) {
  return value.replace(/\D/g, '').slice(-4);
}

export function onboardingPercent(packet?: OnboardingPacket | null) {
  const done = ONBOARDING_STEPS.filter((s) => packet?.steps?.[s]).length;
  return Math.round((done / ONBOARDING_STEPS.length) * 100);
}

export function onboardingStatusLabel(percent: number) {
  if (percent >= 100) return 'complete';
  if (percent > 0) return 'in_progress';
  return 'not_started';
}

function fromRow(row: Record<string, unknown>): OnboardingPacket {
  const steps = (row.steps && typeof row.steps === 'object') ? row.steps as Record<string, boolean> : {};
  return {
    ...emptyOnboarding(),
    legal_first: String(row.legal_first || ''),
    legal_middle: String(row.legal_middle || ''),
    legal_last: String(row.legal_last || ''),
    preferred: String(row.preferred || ''),
    dob: String(row.dob || ''),
    ssn_last4: String(row.ssn_last4 || ''),
    ssn_on_file: Boolean(row.ssn_last4) || Boolean(row.ssn_on_file),
    street: String(row.street || ''),
    city: String(row.city || ''),
    state: String(row.state || ''),
    zip: String(row.zip || ''),
    work_auth: String(row.work_auth || ''),
    filing_status: String(row.filing_status || ''),
    allowances: String(row.allowances || ''),
    extra_withholding: String(row.extra_withholding || ''),
    bank_name: String(row.bank_name || ''),
    routing_last4: String(row.routing_last4 || ''),
    account_last4: String(row.account_last4 || ''),
    account_type: (row.account_type === 'checking' || row.account_type === 'savings') ? row.account_type : '',
    emergency_name: String(row.emergency_name || ''),
    emergency_phone: String(row.emergency_phone || ''),
    emergency_relation: String(row.emergency_relation || ''),
    handbook_ack: Boolean(row.handbook_ack),
    i9_ack: Boolean(row.i9_ack),
    steps,
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
      if (parsed && typeof parsed === 'object') return { ...emptyOnboarding(), ...parsed, steps: parsed.steps || {} };
    } catch { /* ignore corrupt packet notes */ }
  }
  return emptyOnboarding();
}

export async function saveOnboardingPacket(employee: Employee, packet: OnboardingPacket) {
  const percent = onboardingPercent(packet);
  const status = onboardingStatusLabel(percent);
  const profileRow = toProfileRow(employee.id, packet);
  const upsert = await supabase.from('employee_onboarding_profiles').upsert(profileRow, { onConflict: 'employee_id' });
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
  { title: 'Identity & headshot', description: 'Legal name, birthday, and a roster photo.', category: 'identity' },
  { title: 'Tax withholding (W-4)', description: 'Filing status and last-four of SSN only.', category: 'tax' },
  { title: 'Direct deposit', description: 'Bank last-four for payroll.', category: 'pay' },
  { title: 'I-9 work eligibility', description: 'Hire attests they are authorized to work in the U.S.', category: 'work' },
  { title: 'Emergency contact', description: 'Who we call if something happens in the field.', category: 'emergency' },
  { title: 'Review company policies', description: 'Read the North Splash handbook and workplace policies.', category: 'policy' },
];

export async function seedHireOnboarding(employee: Employee, role?: string) {
  await supabase.from('employees').update({ onboarding_status: 'in_progress' }).eq('id', employee.id);
  const extra = role === 'd2d_agent'
    ? [{ title: 'Review territory workflow', description: 'House statuses, Do Not Knock, routing, and lead follow-up.', category: 'd2d' }]
    : role === 'detailer'
      ? [{ title: 'Review job workflow', description: 'Inspection, photos, checklist, QC, and completion standards.', category: 'detailer' }]
      : [];
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
