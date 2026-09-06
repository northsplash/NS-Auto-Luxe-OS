import { FormEvent, useMemo, useState } from 'react';
import { Camera, Check, Landmark, ShieldCheck, UserRound, FileText } from 'lucide-react';
import { firstWord } from '@/lib/data';
import type { OnboardingPacket, OsEmployee } from './demoData';
import { emptyOnboarding, onboardingPercent } from './demoData';
import { useOs } from './osStore';

const STEPS = [
  { id: 'identity', label: 'Identity', Icon: UserRound, hint: 'Legal name, birthday, and a headshot for the roster.' },
  { id: 'tax', label: 'Tax', Icon: FileText, hint: 'W-4 style withholding. We keep only the last four of the SSN.' },
  { id: 'pay', label: 'Direct deposit', Icon: Landmark, hint: 'Bank routing and account, last four only.' },
  { id: 'work', label: 'Work eligibility', Icon: ShieldCheck, hint: 'I-9 attestation the hire completes themselves.' },
  { id: 'emergency', label: 'Emergency', Icon: ShieldCheck, hint: 'Who we call if something happens in the field.' },
] as const;

function last4(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(-4);
}

function shrinkHeadshot(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('That file is not a usable image.'));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function OnboardingTab({ employee }: { employee: OsEmployee }) {
  const os = useOs();
  const packet: OnboardingPacket = { ...emptyOnboarding(), ...(employee.onboarding_packet || {}) };
  const [step, setStep] = useState<(typeof STEPS)[number]['id']>('identity');
  const [ssnDraft, setSsnDraft] = useState('');
  const [routingDraft, setRoutingDraft] = useState('');
  const [accountDraft, setAccountDraft] = useState('');
  const [error, setError] = useState('');
  const percent = onboardingPercent(packet, employee.documents);

  const patch = (partial: Partial<OnboardingPacket>, steps?: string[]) => {
    const next: OnboardingPacket = {
      ...packet,
      ...partial,
      steps: { ...packet.steps, ...(steps || []).reduce((m, id) => ({ ...m, [id]: true }), {}) },
    };
    const documents = (employee.documents || []).map((d) => {
      const name = String(d.name || '').toLowerCase();
      if (next.steps.identity && (name.includes('headshot') || name.includes('photo'))) return { ...d, status: 'complete' as const };
      if (next.steps.tax && name.includes('w-4')) return { ...d, status: 'complete' as const };
      if (next.steps.pay && name.includes('deposit')) return { ...d, status: 'complete' as const };
      if (next.steps.work && (name.includes('i-9') || (next.handbook_ack && name.includes('handbook')))) return { ...d, status: 'complete' as const };
      return d;
    });
    os.updateEmployee(employee.id, {
      onboarding_packet: next,
      photo: next.headshot || employee.photo,
      documents,
      onboarding: onboardingPercent(next, documents),
      name: [next.preferred || next.legal_first, next.legal_last].filter(Boolean).join(' ') || employee.name,
    });
  };

  const completeStep = (id: (typeof STEPS)[number]['id']) => {
    setError('');
    if (id === 'identity') {
      if (!packet.legal_first.trim() || !packet.legal_last.trim() || !packet.dob) {
        setError('Legal first name, last name, and birthday are required.');
        return;
      }
      if (!packet.headshot) {
        setError('Add a headshot so the field roster can recognize this hire.');
        return;
      }
    }
    if (id === 'tax') {
      const four = last4(ssnDraft) || packet.ssn_last4;
      if (four.length !== 4) {
        setError('Enter a Social Security number. Only the last four digits are stored.');
        return;
      }
      if (!packet.filing_status) {
        setError('Choose a W-4 filing status.');
        return;
      }
      patch({ ssn_last4: four, ssn_on_file: true }, [id]);
      setSsnDraft('');
      setStep('pay');
      return;
    }
    if (id === 'pay') {
      const r = last4(routingDraft) || packet.routing_last4;
      const a = last4(accountDraft) || packet.account_last4;
      if (r.length !== 4 || a.length !== 4 || !packet.account_type) {
        setError('Enter routing and account numbers, and choose checking or savings.');
        return;
      }
      patch({ routing_last4: r, account_last4: a }, [id]);
      setRoutingDraft('');
      setAccountDraft('');
      setStep('work');
      return;
    }
    if (id === 'work' && (!packet.work_auth || !packet.i9_ack)) {
      setError('Work eligibility and the I-9 attestation are required.');
      return;
    }
    if (id === 'emergency' && (!packet.emergency_name.trim() || !packet.emergency_phone.trim())) {
      setError('Emergency name and phone are required.');
      return;
    }
    patch({}, [id]);
    const order = STEPS.map((s) => s.id);
    setStep(order[Math.min(order.indexOf(id) + 1, order.length - 1)]);
  };

  const onPhoto = async (e: FormEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    try {
      const headshot = await shrinkHeadshot(file);
      patch({ headshot });
    } catch {
      setError('Could not use that photo. Try a JPG or PNG under 8 MB.');
    }
  };

  const remaining = useMemo(() => STEPS.filter((s) => !packet.steps[s.id]), [packet.steps]);

  return (
    <div className="nsos-onboard-flow">
      <div className="nsos-onboard-hero">
        <div>
          <span className="nsos-eyebrow">Gusto-style packet</span>
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
        <form className="nsos-card nsos-onboard-card" onSubmit={(e) => { e.preventDefault(); completeStep('identity'); }}>
          <p>{STEPS[0].hint}</p>
          <label className="nsos-headshot">
            {packet.headshot ? <img src={packet.headshot} alt="" /> : <span><Camera size={18} />Add headshot</span>}
            <input type="file" accept="image/*" onChange={onPhoto} />
          </label>
          <div className="form-row">
            <label className="nsos-field">Legal first<input value={packet.legal_first} onChange={(e) => patch({ legal_first: e.target.value })} required /></label>
            <label className="nsos-field">Middle<input value={packet.legal_middle} onChange={(e) => patch({ legal_middle: e.target.value })} /></label>
            <label className="nsos-field">Legal last<input value={packet.legal_last} onChange={(e) => patch({ legal_last: e.target.value })} required /></label>
          </div>
          <div className="form-row">
            <label className="nsos-field">Preferred name<input value={packet.preferred} onChange={(e) => patch({ preferred: e.target.value })} placeholder="What the crew should use" /></label>
            <label className="nsos-field">Birthday<input type="date" value={packet.dob} onChange={(e) => patch({ dob: e.target.value })} required /></label>
          </div>
          <div className="form-row">
            <label className="nsos-field">Street<input value={packet.street} onChange={(e) => patch({ street: e.target.value })} /></label>
            <label className="nsos-field">City<input value={packet.city} onChange={(e) => patch({ city: e.target.value })} /></label>
            <label className="nsos-field">State<input value={packet.state} onChange={(e) => patch({ state: e.target.value })} /></label>
            <label className="nsos-field">ZIP<input value={packet.zip} onChange={(e) => patch({ zip: e.target.value })} /></label>
          </div>
          <button className="nsos-btn" type="submit">Save identity</button>
        </form>
      )}
      {step === 'tax' && (
        <form className="nsos-card nsos-onboard-card" onSubmit={(e) => { e.preventDefault(); completeStep('tax'); }}>
          <p>{STEPS[1].hint}</p>
          <label className="nsos-field">Social Security number
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder={packet.ssn_on_file ? `On file · •••-••-${packet.ssn_last4}` : 'XXX-XX-XXXX'}
              value={ssnDraft}
              onChange={(e) => setSsnDraft(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="nsos-field">Filing status
              <select value={packet.filing_status} onChange={(e) => patch({ filing_status: e.target.value })}>
                <option value="">Select</option>
                <option>Single</option>
                <option>Married filing jointly</option>
                <option>Head of household</option>
              </select>
            </label>
            <label className="nsos-field">Dependents<input value={packet.allowances} onChange={(e) => patch({ allowances: e.target.value })} placeholder="0" /></label>
            <label className="nsos-field">Extra withholding<input value={packet.extra_withholding} onChange={(e) => patch({ extra_withholding: e.target.value })} placeholder="$0" /></label>
          </div>
          <button className="nsos-btn" type="submit">Save tax info</button>
        </form>
      )}
      {step === 'pay' && (
        <form className="nsos-card nsos-onboard-card" onSubmit={(e) => { e.preventDefault(); completeStep('pay'); }}>
          <p>{STEPS[2].hint}</p>
          <label className="nsos-field">Bank name<input value={packet.bank_name} onChange={(e) => patch({ bank_name: e.target.value })} /></label>
          <div className="form-row">
            <label className="nsos-field">Routing number<input inputMode="numeric" placeholder={packet.routing_last4 ? `••••${packet.routing_last4}` : '9 digits'} value={routingDraft} onChange={(e) => setRoutingDraft(e.target.value)} /></label>
            <label className="nsos-field">Account number<input inputMode="numeric" placeholder={packet.account_last4 ? `••••${packet.account_last4}` : 'Account'} value={accountDraft} onChange={(e) => setAccountDraft(e.target.value)} /></label>
            <label className="nsos-field">Type
              <select value={packet.account_type} onChange={(e) => patch({ account_type: e.target.value as OnboardingPacket['account_type'] })}>
                <option value="">Select</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
          </div>
          <button className="nsos-btn" type="submit">Save deposit</button>
        </form>
      )}
      {step === 'work' && (
        <form className="nsos-card nsos-onboard-card" onSubmit={(e) => { e.preventDefault(); completeStep('work'); }}>
          <p>{STEPS[3].hint}</p>
          <label className="nsos-field">Citizenship / work status
            <select value={packet.work_auth} onChange={(e) => patch({ work_auth: e.target.value })}>
              <option value="">Select</option>
              <option>U.S. citizen</option>
              <option>Permanent resident</option>
              <option>Authorized to work</option>
            </select>
          </label>
          <label className="nsos-check">
            <input type="checkbox" checked={packet.i9_ack} onChange={(e) => patch({ i9_ack: e.target.checked })} />
            I attest under penalty of perjury that I am authorized to work in the United States (I-9 Section 1).
          </label>
          <label className="nsos-check">
            <input type="checkbox" checked={packet.handbook_ack} onChange={(e) => patch({ handbook_ack: e.target.checked })} />
            I received the North Splash handbook and workplace policies.
          </label>
          <button className="nsos-btn" type="submit">Save eligibility</button>
        </form>
      )}
      {step === 'emergency' && (
        <form className="nsos-card nsos-onboard-card" onSubmit={(e) => { e.preventDefault(); completeStep('emergency'); }}>
          <p>{STEPS[4].hint}</p>
          <div className="form-row">
            <label className="nsos-field">Contact name<input value={packet.emergency_name} onChange={(e) => patch({ emergency_name: e.target.value })} required /></label>
            <label className="nsos-field">Phone<input value={packet.emergency_phone} onChange={(e) => patch({ emergency_phone: e.target.value })} required /></label>
            <label className="nsos-field">Relation<input value={packet.emergency_relation} onChange={(e) => patch({ emergency_relation: e.target.value })} placeholder="Spouse, parent…" /></label>
          </div>
          <button className="nsos-btn" type="submit">{remaining.length <= 1 ? 'Complete onboarding' : 'Save emergency contact'}</button>
        </form>
      )}
    </div>
  );
}
