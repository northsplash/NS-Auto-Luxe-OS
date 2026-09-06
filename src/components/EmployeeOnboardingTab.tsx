import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Check, FileText, Landmark, ShieldCheck, UserRound } from 'lucide-react';
import { firstWord, prettyLabel } from '@/lib/data';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import {
  emptyOnboarding,
  last4,
  loadOnboardingPacket,
  loadOnboardingTasks,
  onboardingPercent,
  saveOnboardingPacket,
  type OnboardingPacket,
  type OnboardingStepId,
  type OnboardingTask,
} from '@/lib/onboarding';
import type { Employee } from '@/lib/supabase';

const STEPS: Array<{ id: OnboardingStepId; label: string; Icon: typeof UserRound; hint: string }> = [
  { id: 'identity', label: 'Identity', Icon: UserRound, hint: 'Legal name, birthday, and a headshot for the roster.' },
  { id: 'tax', label: 'Tax', Icon: FileText, hint: 'W-4 style withholding. We keep only the last four of the SSN.' },
  { id: 'pay', label: 'Direct deposit', Icon: Landmark, hint: 'Bank routing and account, last four only.' },
  { id: 'work', label: 'Work eligibility', Icon: ShieldCheck, hint: 'I-9 attestation the hire completes themselves.' },
  { id: 'emergency', label: 'Emergency', Icon: ShieldCheck, hint: 'Who we call if something happens in the field.' },
];

type Props = {
  employee: Employee;
  onUpdated: (employee: Employee) => void;
};

export default function EmployeeOnboardingTab({ employee, onUpdated }: Props) {
  const [packet, setPacket] = useState<OnboardingPacket>(emptyOnboarding());
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [step, setStep] = useState<OnboardingStepId>('identity');
  const [ssnDraft, setSsnDraft] = useState('');
  const [routingDraft, setRoutingDraft] = useState('');
  const [accountDraft, setAccountDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadOnboardingPacket(employee.id), loadOnboardingTasks(employee.id)])
      .then(([next, nextTasks]) => {
        if (!alive) return;
        setPacket({
          ...next,
          emergency_name: next.emergency_name || employee.emergency_contact || '',
          emergency_phone: next.emergency_phone || employee.emergency_phone || '',
        });
        setTasks(nextTasks);
        const firstOpen = STEPS.find((s) => !next.steps[s.id])?.id || 'identity';
        setStep(firstOpen);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [employee.id]);

  const percent = onboardingPercent(packet);
  const remaining = useMemo(() => STEPS.filter((s) => !packet.steps[s.id]), [packet.steps]);

  const persist = async (next: OnboardingPacket) => {
    setSaving(true);
    setError('');
    try {
      const updated = await saveOnboardingPacket(employee, next);
      setPacket(next);
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const patch = (partial: Partial<OnboardingPacket>) => {
    setPacket((prev) => ({ ...prev, ...partial, steps: { ...prev.steps, ...(partial.steps || {}) } }));
  };

  const completeStep = async (id: OnboardingStepId) => {
    setError('');
    let next: OnboardingPacket = { ...packet, steps: { ...packet.steps } };
    if (id === 'identity') {
      if (!next.legal_first.trim() || !next.legal_last.trim() || !next.dob) {
        setError('Legal first name, last name, and birthday are required.');
        return;
      }
      if (!employee.avatar_url) {
        setError('Add a headshot so the field roster can recognize this hire.');
        return;
      }
    }
    if (id === 'tax') {
      const four = last4(ssnDraft) || next.ssn_last4;
      if (four.length !== 4) {
        setError('Enter a Social Security number. Only the last four digits are stored.');
        return;
      }
      if (!next.filing_status) {
        setError('Choose a W-4 filing status.');
        return;
      }
      next = { ...next, ssn_last4: four, ssn_on_file: true };
      setSsnDraft('');
    }
    if (id === 'pay') {
      const r = last4(routingDraft) || next.routing_last4;
      const a = last4(accountDraft) || next.account_last4;
      if (r.length !== 4 || a.length !== 4 || !next.account_type) {
        setError('Enter routing and account numbers, and choose checking or savings.');
        return;
      }
      next = { ...next, routing_last4: r, account_last4: a };
      setRoutingDraft('');
      setAccountDraft('');
    }
    if (id === 'work' && (!next.work_auth || !next.i9_ack)) {
      setError('Work eligibility and the I-9 attestation are required.');
      return;
    }
    if (id === 'emergency' && (!next.emergency_name.trim() || !next.emergency_phone.trim())) {
      setError('Emergency name and phone are required.');
      return;
    }
    next.steps = { ...next.steps, [id]: true };
    await persist(next);
    const order = STEPS.map((s) => s.id);
    setStep(order[Math.min(order.indexOf(id) + 1, order.length - 1)]);
  };

  if (loading) return <div className="ns-empty compact">Loading onboarding packet…</div>;

  return (
    <div className="nsos-onboard-flow live-onboard-v29">
      <div className="nsos-onboard-hero">
        <div>
          <span className="nsos-eyebrow eyebrow">Onboarding packet</span>
          <h3>Finish hiring {firstWord(employee.name)}</h3>
          <p>The hire fills this in. North Splash stores last-four identifiers only — never a full Social or full account number.</p>
        </div>
        <strong>{percent}%</strong>
      </div>
      <ol className="nsos-onboard-steps">
        {STEPS.map((s) => (
          <li key={s.id}>
            <button type="button" className={`${step === s.id ? 'active' : ''} ${packet.steps[s.id] ? 'done' : ''}`} onClick={() => setStep(s.id)}>
              {packet.steps[s.id] ? <Check size={14} /> : <s.Icon size={14} />}
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      {error && <div className="nsos-onboard-error" role="alert">{error}</div>}

      {step === 'identity' && (
        <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={(e: FormEvent) => { e.preventDefault(); void completeStep('identity'); }}>
          <p>{STEPS[0].hint}</p>
          <div className="live-onboard-headshot">
            <EmployeeAvatar employee={employee} size="xl" editable onUploaded={(url) => onUpdated({ ...employee, avatar_url: url })} />
            <span><Camera size={14} /> Roster headshot</span>
          </div>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Legal first</span><input value={packet.legal_first} onChange={(e) => patch({ legal_first: e.target.value })} required /></label>
            <label className="nsos-field profile-field-v25"><span>Middle</span><input value={packet.legal_middle} onChange={(e) => patch({ legal_middle: e.target.value })} /></label>
            <label className="nsos-field profile-field-v25"><span>Legal last</span><input value={packet.legal_last} onChange={(e) => patch({ legal_last: e.target.value })} required /></label>
          </div>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Preferred name</span><input value={packet.preferred} onChange={(e) => patch({ preferred: e.target.value })} placeholder="What the crew should use" /></label>
            <label className="nsos-field profile-field-v25"><span>Birthday</span><input type="date" value={packet.dob} onChange={(e) => patch({ dob: e.target.value })} required /></label>
          </div>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Street</span><input value={packet.street} onChange={(e) => patch({ street: e.target.value })} /></label>
            <label className="nsos-field profile-field-v25"><span>City</span><input value={packet.city} onChange={(e) => patch({ city: e.target.value })} /></label>
            <label className="nsos-field profile-field-v25"><span>State</span><input value={packet.state} onChange={(e) => patch({ state: e.target.value })} /></label>
            <label className="nsos-field profile-field-v25"><span>ZIP</span><input value={packet.zip} onChange={(e) => patch({ zip: e.target.value })} /></label>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save identity'}</button>
        </form>
      )}

      {step === 'tax' && (
        <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={(e) => { e.preventDefault(); void completeStep('tax'); }}>
          <p>{STEPS[1].hint}</p>
          <label className="nsos-field profile-field-v25"><span>Social Security number</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder={packet.ssn_on_file ? `On file · •••-••-${packet.ssn_last4}` : 'XXX-XX-XXXX'}
              value={ssnDraft}
              onChange={(e) => setSsnDraft(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Filing status</span>
              <select value={packet.filing_status} onChange={(e) => patch({ filing_status: e.target.value })}>
                <option value="">Select</option>
                <option>Single</option>
                <option>Married filing jointly</option>
                <option>Head of household</option>
              </select>
            </label>
            <label className="nsos-field profile-field-v25"><span>Dependents</span><input value={packet.allowances} onChange={(e) => patch({ allowances: e.target.value })} placeholder="0" /></label>
            <label className="nsos-field profile-field-v25"><span>Extra withholding</span><input value={packet.extra_withholding} onChange={(e) => patch({ extra_withholding: e.target.value })} placeholder="$0" /></label>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save tax info'}</button>
        </form>
      )}

      {step === 'pay' && (
        <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={(e) => { e.preventDefault(); void completeStep('pay'); }}>
          <p>{STEPS[2].hint}</p>
          <label className="nsos-field profile-field-v25"><span>Bank name</span><input value={packet.bank_name} onChange={(e) => patch({ bank_name: e.target.value })} /></label>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Routing number</span><input inputMode="numeric" placeholder={packet.routing_last4 ? `••••${packet.routing_last4}` : '9 digits'} value={routingDraft} onChange={(e) => setRoutingDraft(e.target.value)} /></label>
            <label className="nsos-field profile-field-v25"><span>Account number</span><input inputMode="numeric" placeholder={packet.account_last4 ? `••••${packet.account_last4}` : 'Account'} value={accountDraft} onChange={(e) => setAccountDraft(e.target.value)} /></label>
            <label className="nsos-field profile-field-v25"><span>Type</span>
              <select value={packet.account_type} onChange={(e) => patch({ account_type: e.target.value as OnboardingPacket['account_type'] })}>
                <option value="">Select</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save deposit'}</button>
        </form>
      )}

      {step === 'work' && (
        <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={(e) => { e.preventDefault(); void completeStep('work'); }}>
          <p>{STEPS[3].hint}</p>
          <label className="nsos-field profile-field-v25"><span>Citizenship / work status</span>
            <select value={packet.work_auth} onChange={(e) => patch({ work_auth: e.target.value })}>
              <option value="">Select</option>
              <option>U.S. citizen</option>
              <option>Permanent resident</option>
              <option>Authorized to work</option>
            </select>
          </label>
          <label className="nsos-check live-onboard-check">
            <input type="checkbox" checked={packet.i9_ack} onChange={(e) => patch({ i9_ack: e.target.checked })} />
            I attest under penalty of perjury that I am authorized to work in the United States (I-9 Section 1).
          </label>
          <label className="nsos-check live-onboard-check">
            <input type="checkbox" checked={packet.handbook_ack} onChange={(e) => patch({ handbook_ack: e.target.checked })} />
            I received the North Splash handbook and workplace policies.
          </label>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save eligibility'}</button>
        </form>
      )}

      {step === 'emergency' && (
        <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={(e) => { e.preventDefault(); void completeStep('emergency'); }}>
          <p>{STEPS[4].hint}</p>
          <div className="form-row">
            <label className="nsos-field profile-field-v25"><span>Contact name</span><input value={packet.emergency_name} onChange={(e) => patch({ emergency_name: e.target.value })} required /></label>
            <label className="nsos-field profile-field-v25"><span>Phone</span><input value={packet.emergency_phone} onChange={(e) => patch({ emergency_phone: e.target.value })} required /></label>
            <label className="nsos-field profile-field-v25"><span>Relation</span><input value={packet.emergency_relation} onChange={(e) => patch({ emergency_relation: e.target.value })} placeholder="Spouse, parent…" /></label>
          </div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : remaining.length <= 1 ? 'Complete onboarding' : 'Save emergency contact'}</button>
        </form>
      )}

      {tasks.length > 0 && (
        <div className="live-onboard-tasks">
          <span className="eyebrow">Packet checklist</span>
          {tasks.map((t) => (
            <div key={t.id} className={t.status === 'completed' ? 'done' : ''}>
              <strong>{t.title}</strong>
              <small>{t.description || t.category}</small>
              <em>{prettyLabel(t.status)}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
