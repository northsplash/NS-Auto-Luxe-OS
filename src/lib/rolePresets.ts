import type { CompensationPlan } from '@/lib/compensation';

export type SystemRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'detailer'
  | 'd2d_agent'
  | 'office'
  | 'finance'
  | 'recruiter'
  | 'employee'
  | 'custom';

export type PayType =
  | 'hourly'
  | 'salary'
  | 'base_commission'
  | 'commission_only'
  | 'per_job'
  | 'hourly_plus_commission'
  | 'salary_plus_commission'
  | 'custom';

export type PayMix = {
  hourly: boolean;
  salary: boolean;
  weeklyBase: boolean;
  commission: boolean;
  perJob: boolean;
  customRules: boolean;
};

export type EmployeeDraft = {
  name: string;
  role: SystemRole;
  title: string;
  department: string;
  phone: string;
  email: string;
  employment_level: number;
  pay_type: PayType;
  hourly_rate: number;
  weekly_base: number;
  commission_rate: number;
  annual_salary: number;
  per_job_rate: number;
  flat_commission: number;
  commission_basis: 'revenue' | 'gross_profit' | 'job' | 'membership';
  pay_schedule: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  overtime_eligible: boolean;
  compensation_notes: string;
  custom_compensation: CompensationPlan;
  work_modes: string[];
  hire_date: string;
  work_location: string;
  status: string;
};

export const SYSTEM_ROLES: { value: SystemRole; label: string; hint: string }[] = [
  { value: 'owner', label: 'Owner', hint: 'Full OS access, can also work field jobs' },
  { value: 'admin', label: 'Admin', hint: 'Office / operations admin, salaried or mixed' },
  { value: 'manager', label: 'Manager', hint: 'Crew and schedule authority' },
  { value: 'detailer', label: 'Detailer', hint: 'Field service / mobile detailing' },
  { value: 'd2d_agent', label: 'D2D Sales', hint: 'Door-to-door canvassing and closing' },
  { value: 'office', label: 'Office / Concierge', hint: 'Phones, booking, customer care' },
  { value: 'finance', label: 'Finance', hint: 'Payroll, payments, reporting' },
  { value: 'recruiter', label: 'Recruiter', hint: 'Hiring pipeline and onboarding' },
  { value: 'employee', label: 'Team member', hint: 'General employee access' },
  { value: 'custom', label: 'Custom role', hint: 'Any title, any pay mix' },
];

export const WORK_MODES: { value: string; label: string }[] = [
  { value: 'owner', label: 'Owner tools' },
  { value: 'admin', label: 'Admin / office OS' },
  { value: 'manager', label: 'Manager tools' },
  { value: 'detailer', label: 'Detailing / field service' },
  { value: 'd2d', label: 'D2D sales / canvassing' },
  { value: 'finance', label: 'Finance / payroll' },
  { value: 'recruiter', label: 'Hiring / onboarding' },
];

type RolePreset = {
  title: string;
  department: string;
  pay_type: PayType;
  hourly_rate: number;
  weekly_base: number;
  commission_rate: number;
  annual_salary: number;
  per_job_rate: number;
  flat_commission: number;
  pay_schedule: EmployeeDraft['pay_schedule'];
  overtime_eligible: boolean;
  work_modes: string[];
  notes: string;
};

export const ROLE_PRESETS: Record<SystemRole, RolePreset> = {
  owner: {
    title: 'Owner',
    department: 'Ownership',
    pay_type: 'custom',
    hourly_rate: 0,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'monthly',
    overtime_eligible: false,
    work_modes: ['owner', 'admin', 'manager', 'detailer', 'd2d'],
    notes: 'Owner can take field work without changing permissions.',
  },
  admin: {
    title: 'Operations Administrator',
    department: 'Operations',
    pay_type: 'salary',
    hourly_rate: 0,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 62000,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'biweekly',
    overtime_eligible: false,
    work_modes: ['admin', 'manager'],
    notes: 'Salary is a starting point — add commission or stipend if this admin also sells or manages a book.',
  },
  manager: {
    title: 'Operations Manager',
    department: 'Operations',
    pay_type: 'hourly_plus_commission',
    hourly_rate: 24,
    weekly_base: 0,
    commission_rate: 3,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'weekly',
    overtime_eligible: true,
    work_modes: ['manager', 'detailer'],
    notes: 'Hourly plus a small override on crew revenue.',
  },
  detailer: {
    title: 'Mobile Detailer',
    department: 'Detailing',
    pay_type: 'hourly',
    hourly_rate: 17,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 25,
    flat_commission: 0,
    pay_schedule: 'weekly',
    overtime_eligible: true,
    work_modes: ['detailer'],
    notes: 'Add per-job or membership bonuses with custom rules.',
  },
  d2d_agent: {
    title: 'D2D Sales Representative',
    department: 'Sales',
    pay_type: 'base_commission',
    hourly_rate: 0,
    weekly_base: 300,
    commission_rate: 10,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'weekly',
    overtime_eligible: false,
    work_modes: ['d2d'],
    notes: 'Weekly draw plus commission. Raise the % or add a sale bonus per person.',
  },
  office: {
    title: 'Concierge / Office Coordinator',
    department: 'Customer Care',
    pay_type: 'hourly',
    hourly_rate: 18,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'biweekly',
    overtime_eligible: true,
    work_modes: ['admin'],
    notes: 'Switch to salary or add booking bonuses as needed.',
  },
  finance: {
    title: 'Finance Administrator',
    department: 'Finance',
    pay_type: 'salary',
    hourly_rate: 0,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 68000,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'biweekly',
    overtime_eligible: false,
    work_modes: ['finance', 'admin'],
    notes: 'Salaried. Add a year-end bonus as a custom rule if you want one.',
  },
  recruiter: {
    title: 'Talent Recruiter',
    department: 'People',
    pay_type: 'base_commission',
    hourly_rate: 0,
    weekly_base: 400,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 250,
    pay_schedule: 'biweekly',
    overtime_eligible: false,
    work_modes: ['recruiter'],
    notes: 'Weekly base plus a flat amount per hired employee — edit the flat amount.',
  },
  employee: {
    title: 'Team Member',
    department: 'Operations',
    pay_type: 'hourly',
    hourly_rate: 16,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'weekly',
    overtime_eligible: true,
    work_modes: [],
    notes: '',
  },
  custom: {
    title: '',
    department: '',
    pay_type: 'custom',
    hourly_rate: 0,
    weekly_base: 0,
    commission_rate: 0,
    annual_salary: 0,
    per_job_rate: 0,
    flat_commission: 0,
    pay_schedule: 'weekly',
    overtime_eligible: true,
    work_modes: [],
    notes: 'Build this person from scratch — any title, any mix of pay.',
  },
};

export const emptyEmployeeDraft = (): EmployeeDraft => ({
  name: '',
  role: 'detailer',
  title: ROLE_PRESETS.detailer.title,
  department: ROLE_PRESETS.detailer.department,
  phone: '',
  email: '',
  employment_level: 1,
  pay_type: 'hourly',
  hourly_rate: 17,
  weekly_base: 0,
  commission_rate: 0,
  annual_salary: 0,
  per_job_rate: 0,
  flat_commission: 0,
  commission_basis: 'revenue',
  pay_schedule: 'weekly',
  overtime_eligible: true,
  compensation_notes: '',
  custom_compensation: { rules: [], guarantee_floor_weekly: 0, cap_weekly: 0 },
  work_modes: ['detailer'],
  hire_date: new Date().toISOString().slice(0, 10),
  work_location: 'Raleigh',
  status: 'active',
});

export function payMixFromDraft(d: Pick<EmployeeDraft, 'pay_type' | 'hourly_rate' | 'annual_salary' | 'weekly_base' | 'commission_rate' | 'per_job_rate'>): PayMix {
  const t = d.pay_type;
  return {
    hourly: t === 'hourly' || t === 'hourly_plus_commission' || t === 'custom' && Number(d.hourly_rate) > 0,
    salary: t === 'salary' || t === 'salary_plus_commission' || t === 'custom' && Number(d.annual_salary) > 0,
    weeklyBase: t === 'base_commission' || t === 'custom' && Number(d.weekly_base) > 0,
    commission: ['base_commission', 'commission_only', 'hourly_plus_commission', 'salary_plus_commission'].includes(t) || t === 'custom' && Number(d.commission_rate) > 0,
    perJob: t === 'per_job' || t === 'custom' && Number(d.per_job_rate) > 0,
    customRules: t === 'custom',
  };
}

export function payTypeFromMix(mix: PayMix): PayType {
  const flags = [mix.hourly, mix.salary, mix.weeklyBase, mix.commission, mix.perJob, mix.customRules].filter(Boolean).length;
  if (mix.customRules || flags > 2) return 'custom';
  if (mix.hourly && mix.commission && !mix.salary && !mix.weeklyBase && !mix.perJob) return 'hourly_plus_commission';
  if (mix.salary && mix.commission && !mix.hourly && !mix.weeklyBase && !mix.perJob) return 'salary_plus_commission';
  if (mix.weeklyBase && mix.commission && flags === 2) return 'base_commission';
  if (mix.commission && flags === 1) return 'commission_only';
  if (mix.salary && flags === 1) return 'salary';
  if (mix.perJob && flags === 1) return 'per_job';
  if (mix.hourly && flags === 1) return 'hourly';
  if (flags === 0) return 'custom';
  return 'custom';
}

export function applyRolePreset(current: EmployeeDraft, role: SystemRole, keepCustomTitle: boolean): EmployeeDraft {
  const preset = ROLE_PRESETS[role];
  const previousPresetTitle = ROLE_PRESETS[current.role]?.title;
  const keepTitle = keepCustomTitle || (current.title.trim() !== '' && current.title !== previousPresetTitle);
  return {
    ...current,
    role,
    title: keepTitle ? current.title : preset.title,
    department: current.department && current.department !== ROLE_PRESETS[current.role].department
      ? current.department
      : preset.department,
    pay_type: preset.pay_type,
    hourly_rate: preset.hourly_rate,
    weekly_base: preset.weekly_base,
    commission_rate: preset.commission_rate,
    annual_salary: preset.annual_salary,
    per_job_rate: preset.per_job_rate,
    flat_commission: preset.flat_commission,
    pay_schedule: preset.pay_schedule,
    overtime_eligible: preset.overtime_eligible,
    work_modes: [...preset.work_modes],
    compensation_notes: preset.notes,
  };
}

export function applyPayPresetOnly(current: EmployeeDraft): EmployeeDraft {
  const preset = ROLE_PRESETS[current.role];
  return {
    ...current,
    pay_type: preset.pay_type,
    hourly_rate: preset.hourly_rate,
    weekly_base: preset.weekly_base,
    commission_rate: preset.commission_rate,
    annual_salary: preset.annual_salary,
    per_job_rate: preset.per_job_rate,
    flat_commission: preset.flat_commission,
    pay_schedule: preset.pay_schedule,
    overtime_eligible: preset.overtime_eligible,
    compensation_notes: preset.notes,
  };
}
