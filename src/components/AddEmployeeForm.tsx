import CompensationRuleBuilder from '@/components/CompensationRuleBuilder';
import {
  SYSTEM_ROLES,
  WORK_MODES,
  applyPayPresetOnly,
  applyRolePreset,
  payMixFromDraft,
  payTypeFromMix,
  type EmployeeDraft,
  type PayMix,
  type SystemRole,
} from '@/lib/rolePresets';

type Props = {
  value: EmployeeDraft;
  onChange: (next: EmployeeDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting?: boolean;
  submitLabel?: string;
};

const PAY_TYPES: { value: EmployeeDraft['pay_type']; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'salary', label: 'Salary' },
  { value: 'base_commission', label: 'Weekly draw + commission' },
  { value: 'commission_only', label: 'Commission only' },
  { value: 'per_job', label: 'Per completed job' },
  { value: 'hourly_plus_commission', label: 'Hourly + commission' },
  { value: 'salary_plus_commission', label: 'Salary + commission' },
  { value: 'custom', label: 'Custom mix' },
];

function showsHourly(t: string) {
  return ['hourly', 'hourly_plus_commission', 'custom'].includes(t);
}
function showsSalary(t: string) {
  return ['salary', 'salary_plus_commission', 'custom'].includes(t);
}
function showsWeekly(t: string) {
  return ['base_commission', 'custom'].includes(t);
}
function showsCommission(t: string) {
  return ['base_commission', 'commission_only', 'hourly_plus_commission', 'salary_plus_commission', 'custom'].includes(t);
}
function showsPerJob(t: string) {
  return ['per_job', 'custom'].includes(t);
}

export default function AddEmployeeForm({ value, onChange, onSubmit, submitting, submitLabel = 'Add team member' }: Props) {
  const mix = payMixFromDraft(value);
  const patch = (partial: Partial<EmployeeDraft>) => onChange({ ...value, ...partial });
  const setMix = (key: keyof PayMix, on: boolean) => {
    const nextMix = { ...mix, [key]: on };
    const pay_type = payTypeFromMix(nextMix);
    patch({
      pay_type,
      hourly_rate: nextMix.hourly ? value.hourly_rate || 17 : 0,
      annual_salary: nextMix.salary ? value.annual_salary || 52000 : 0,
      weekly_base: nextMix.weeklyBase ? value.weekly_base || 300 : 0,
      commission_rate: nextMix.commission ? value.commission_rate || 10 : 0,
      per_job_rate: nextMix.perJob ? value.per_job_rate || 25 : 0,
    });
  };

  return (
    <form className="modal-form employee-create-v25 ns-hire-form" onSubmit={onSubmit}>
      <div className="employee-create-section">
        <div className="employee-create-section-head">
          <span>1</span>
          <div>
            <strong>Identity</strong>
            <small>Job title is free text. System role only controls default tools — it never locks pay.</small>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Full name</label>
            <input required value={value.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label>Custom job title</label>
            <input required value={value.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Client Experience Admin" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>System role</label>
            <select
              value={value.role}
              onChange={(e) => onChange(applyRolePreset(value, e.target.value as SystemRole, false))}
            >
              {SYSTEM_ROLES.map((role) => (
                <option value={role.value} key={role.value}>{role.label}</option>
              ))}
            </select>
            <small className="helper-text">{SYSTEM_ROLES.find((r) => r.value === value.role)?.hint}</small>
          </div>
          <div className="form-group">
            <label>Department</label>
            <input value={value.department} onChange={(e) => patch({ department: e.target.value })} placeholder="Sales, Detailing, Operations..." />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={value.email} onChange={(e) => patch({ email: e.target.value })} placeholder="team@northsplash.com" />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={value.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="330-000-0000" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Hire date</label>
            <input type="date" value={value.hire_date} onChange={(e) => patch({ hire_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Work location</label>
            <input value={value.work_location} onChange={(e) => patch({ work_location: e.target.value })} placeholder="Raleigh" />
          </div>
        </div>
      </div>

      <div className="employee-create-section compensation-builder-v25">
        <div className="employee-create-section-head">
          <span>2</span>
          <div>
            <strong>Pay structure</strong>
            <small>Mix salary, hourly, commission, draw, and per-job pay for admins, detailers, and anyone else.</small>
          </div>
        </div>
        <div className="ns-pay-mix" role="group" aria-label="Pay mix">
          {([
            ['hourly', 'Hourly'],
            ['salary', 'Salary'],
            ['weeklyBase', 'Weekly draw'],
            ['commission', 'Commission'],
            ['perJob', 'Per job'],
            ['customRules', 'Extra rules'],
          ] as [keyof PayMix, string][]).map(([key, label]) => (
            <label key={key} className={mix[key] ? 'on' : ''}>
              <input type="checkbox" checked={mix[key]} onChange={(e) => setMix(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Named structure</label>
            <select value={value.pay_type} onChange={(e) => patch({ pay_type: e.target.value as EmployeeDraft['pay_type'] })}>
              {PAY_TYPES.map((t) => <option value={t.value} key={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Pay schedule</label>
            <select value={value.pay_schedule} onChange={(e) => patch({ pay_schedule: e.target.value as EmployeeDraft['pay_schedule'] })}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="semimonthly">Twice monthly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <button type="button" className="btn-outline btn-sm ns-preset-btn" onClick={() => onChange(applyPayPresetOnly(value))}>
          Apply suggested pay for {SYSTEM_ROLES.find((r) => r.value === value.role)?.label}
        </button>
        {(showsHourly(value.pay_type) || mix.hourly) && (
          <div className="form-row">
            <div className="form-group">
              <label>Hourly rate</label>
              <input type="number" min="0" step="0.25" value={value.hourly_rate} onChange={(e) => patch({ hourly_rate: Number(e.target.value) })} />
            </div>
            <div className="form-group check-group-v25">
              <label>
                <input type="checkbox" checked={value.overtime_eligible} onChange={(e) => patch({ overtime_eligible: e.target.checked })} />
                Overtime eligible
              </label>
            </div>
          </div>
        )}
        {(showsSalary(value.pay_type) || mix.salary) && (
          <div className="form-group">
            <label>Annual salary</label>
            <input type="number" min="0" step="500" value={value.annual_salary} onChange={(e) => patch({ annual_salary: Number(e.target.value) })} />
          </div>
        )}
        {(showsWeekly(value.pay_type) || mix.weeklyBase) && (
          <div className="form-group">
            <label>Weekly base / draw</label>
            <input type="number" min="0" step="25" value={value.weekly_base} onChange={(e) => patch({ weekly_base: Number(e.target.value) })} />
          </div>
        )}
        {(showsCommission(value.pay_type) || mix.commission) && (
          <div className="form-row">
            <div className="form-group">
              <label>Commission %</label>
              <input type="number" min="0" max="100" step="0.25" value={value.commission_rate} onChange={(e) => patch({ commission_rate: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Flat $ / sale</label>
              <input type="number" min="0" step="5" value={value.flat_commission} onChange={(e) => patch({ flat_commission: Number(e.target.value) })} />
            </div>
          </div>
        )}
        {(showsPerJob(value.pay_type) || mix.perJob) && (
          <div className="form-group">
            <label>Per-job rate</label>
            <input type="number" min="0" step="5" value={value.per_job_rate} onChange={(e) => patch({ per_job_rate: Number(e.target.value) })} />
          </div>
        )}
        {(showsCommission(value.pay_type) || mix.commission) && (
          <div className="form-group">
            <label>Commission basis</label>
            <select value={value.commission_basis} onChange={(e) => patch({ commission_basis: e.target.value as EmployeeDraft['commission_basis'] })}>
              <option value="revenue">Collected revenue</option>
              <option value="gross_profit">Gross profit</option>
              <option value="job">Completed jobs</option>
              <option value="membership">Membership sales</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Compensation notes</label>
          <textarea rows={2} value={value.compensation_notes} onChange={(e) => patch({ compensation_notes: e.target.value })} placeholder="Guaranteed draw, exceptions, vesting, specialty pay..." />
        </div>
        <CompensationRuleBuilder value={value.custom_compensation} onChange={(custom_compensation) => patch({ custom_compensation, pay_type: 'custom' })} />
      </div>

      <div className="employee-create-section">
        <div className="employee-create-section-head">
          <span>3</span>
          <div>
            <strong>Tools & level</strong>
            <small>Turn on every workspace this person should actually use.</small>
          </div>
        </div>
        <div className="form-group">
          <label>Work modes / capabilities</label>
          <div className="capability-checks-v27">
            {WORK_MODES.map((mode) => (
              <label key={mode.value}>
                <input
                  type="checkbox"
                  checked={value.work_modes.includes(mode.value)}
                  onChange={(e) => patch({
                    work_modes: e.target.checked
                      ? [...new Set([...value.work_modes, mode.value])]
                      : value.work_modes.filter((x) => x !== mode.value),
                  })}
                />
                <span>{mode.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Employee level</label>
          <select value={value.employment_level} onChange={(e) => patch({ employment_level: Number(e.target.value) })}>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
            <option value={4}>Level 4</option>
            <option value={5}>Level 5</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn-primary btn-full" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
