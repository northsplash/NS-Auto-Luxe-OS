import type { FormEvent, ReactNode } from 'react';
import type { OnboardingPacket, OnboardingStepId } from '@/lib/onboarding';
import { ONBOARDING_STEP_META } from '@/lib/onboarding';
import {
  GUSTO_FILING_STATUSES,
  GUSTO_I9_STATUSES,
  GUSTO_NC_FILING,
  GUSTO_PAYMENT_METHODS,
  gustoExportRows,
  gustoStepCopy,
} from '@/lib/gustoPayroll';
import { MARKET } from '@/lib/market';

function Field({
  label,
  gusto,
  children,
  className = '',
}: {
  label: string;
  gusto: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`nsos-field profile-field-v25 gusto-field ${className}`}>
      <span>
        {label}
        <em className="gusto-chip">Gusto · {gusto}</em>
      </span>
      {children}
    </label>
  );
}

export function GustoPayrollSummary({ packet }: { packet: OnboardingPacket }) {
  return (
    <section className="gusto-ready">
      <div>
        <span className="eyebrow">Ready for Gusto</span>
        <h4>Type this hire into Gusto payroll</h4>
        <p>North Splash never stores a full Social Security or bank account number. Open Gusto → People → Add employee and copy these fields.</p>
      </div>
      <dl>
        {gustoExportRows(packet).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Props = {
  packet: OnboardingPacket;
  step: OnboardingStepId;
  saving?: boolean;
  ssnDraft: string;
  routingDraft: string;
  accountDraft: string;
  onSsn: (value: string) => void;
  onRouting: (value: string) => void;
  onAccount: (value: string) => void;
  onPatch: (partial: Partial<OnboardingPacket>) => void;
  onSubmit: () => void;
  headshot?: ReactNode;
  remainingCount: number;
};

export default function OnboardingGustoForm({
  packet,
  step,
  saving,
  ssnDraft,
  routingDraft,
  accountDraft,
  onSsn,
  onRouting,
  onAccount,
  onPatch,
  onSubmit,
  headshot,
  remainingCount,
}: Props) {
  const meta = ONBOARDING_STEP_META.find((s) => s.id === step);
  const copy = gustoStepCopy(step);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  const busy = Boolean(saving);
  const saveLabel = busy
    ? 'Saving…'
    : step === 'emergency' && remainingCount <= 1
      ? 'Complete Gusto packet'
      : `Save ${copy.gusto}`;

  return (
    <form className="nsos-card nsos-onboard-card live-onboard-card" onSubmit={submit}>
      <div className="gusto-step-kicker">
        <span className="gusto-chip">Gusto payroll · {copy.gusto}</span>
        <small>{copy.enter}</small>
      </div>
      <p>{meta?.hint}</p>
      {headshot}

      {step === 'identity' && (
        <>
          <div className="form-row">
            <Field label="Legal first name" gusto="Legal first name">
              <input value={packet.legal_first} onChange={(e) => onPatch({ legal_first: e.target.value })} required />
            </Field>
            <Field label="Middle name" gusto="Middle name">
              <input value={packet.legal_middle} onChange={(e) => onPatch({ legal_middle: e.target.value })} />
            </Field>
            <Field label="Legal last name" gusto="Legal last name">
              <input value={packet.legal_last} onChange={(e) => onPatch({ legal_last: e.target.value })} required />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Preferred name" gusto="Preferred / chosen name">
              <input value={packet.preferred} onChange={(e) => onPatch({ preferred: e.target.value })} placeholder="What the crew and Gusto should use" />
            </Field>
            <Field label="Date of birth" gusto="Date of birth">
              <input type="date" value={packet.dob} onChange={(e) => onPatch({ dob: e.target.value })} required />
            </Field>
          </div>
          <Field label="Home address" gusto="Home address line 1">
            <input value={packet.street} onChange={(e) => onPatch({ street: e.target.value })} placeholder="Street" required />
          </Field>
          <div className="form-row">
            <Field label="Apt / suite" gusto="Address line 2">
              <input value={packet.apartment} onChange={(e) => onPatch({ apartment: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="City" gusto="City">
              <input value={packet.city} onChange={(e) => onPatch({ city: e.target.value })} placeholder="City" required />
            </Field>
            <Field label="State" gusto="State">
              <input value={packet.state} onChange={(e) => onPatch({ state: e.target.value })} placeholder="NC" maxLength={2} required />
            </Field>
            <Field label="ZIP" gusto="ZIP">
              <input value={packet.zip} onChange={(e) => onPatch({ zip: e.target.value })} placeholder="ZIP" required />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Personal phone" gusto="Phone number">
              <input type="tel" value={packet.personal_phone} onChange={(e) => onPatch({ personal_phone: e.target.value })} placeholder={MARKET.phonePlaceholder} required />
            </Field>
            <Field label="Personal email" gusto="Personal email">
              <input type="email" value={packet.personal_email} onChange={(e) => onPatch({ personal_email: e.target.value })} placeholder="name@email.com" />
            </Field>
          </div>
        </>
      )}

      {step === 'tax' && (
        <>
          <Field label="Social Security number" gusto="Social Security number">
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder={packet.ssn_on_file ? `On file · •••-••-${packet.ssn_last4}` : 'XXX-XX-XXXX'}
              value={ssnDraft}
              onChange={(e) => onSsn(e.target.value)}
            />
          </Field>
          <p className="gusto-note">OS stores the last four only. When you add this person in Gusto, paste the full SSN there.</p>
          <div className="form-row">
            <Field label="Federal filing status" gusto="W-4 Step 1c">
              <select value={packet.filing_status} onChange={(e) => onPatch({ filing_status: e.target.value })}>
                <option value="">Select</option>
                {GUSTO_FILING_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <label className="nsos-check live-onboard-check gusto-check">
              <input type="checkbox" checked={packet.two_jobs} onChange={(e) => onPatch({ two_jobs: e.target.checked })} />
              Two jobs, or spouse works (Gusto W-4 Step 2)
            </label>
          </div>
          <div className="form-row">
            <Field label="Dependents amount" gusto="W-4 Step 3">
              <input value={packet.allowances} onChange={(e) => onPatch({ allowances: e.target.value })} placeholder="$0" />
            </Field>
            <Field label="Other income" gusto="W-4 Step 4a">
              <input value={packet.other_income} onChange={(e) => onPatch({ other_income: e.target.value })} placeholder="$0" />
            </Field>
            <Field label="Deductions" gusto="W-4 Step 4b">
              <input value={packet.w4_deductions} onChange={(e) => onPatch({ w4_deductions: e.target.value })} placeholder="$0" />
            </Field>
            <Field label="Extra federal withholding" gusto="W-4 Step 4c">
              <input value={packet.extra_withholding} onChange={(e) => onPatch({ extra_withholding: e.target.value })} placeholder="$0" />
            </Field>
          </div>
          <div className="form-row">
            <Field label="NC-4 filing status" gusto="NC-4">
              <select value={packet.ohio_filing_status} onChange={(e) => onPatch({ ohio_filing_status: e.target.value })}>
                <option value="">Select</option>
                {GUSTO_NC_FILING.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="NC county" gusto="Work county">
              <input value={packet.ohio_school_district} onChange={(e) => onPatch({ ohio_school_district: e.target.value })} placeholder="Wake County" />
            </Field>
            <Field label="Extra NC withholding" gusto="NC extra withholding">
              <input value={packet.ohio_extra_withholding} onChange={(e) => onPatch({ ohio_extra_withholding: e.target.value })} placeholder="$0" />
            </Field>
          </div>
        </>
      )}

      {step === 'pay' && (
        <>
          <Field label="How should Gusto pay this hire?" gusto="Payment method">
            <select value={packet.payment_method} onChange={(e) => onPatch({ payment_method: e.target.value as OnboardingPacket['payment_method'] })}>
              <option value="">Select</option>
              {GUSTO_PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </Field>
          {packet.payment_method !== 'paper_check' && (
            <>
              <Field label="Bank name" gusto="Bank name">
                <input value={packet.bank_name} onChange={(e) => onPatch({ bank_name: e.target.value })} />
              </Field>
              <div className="form-row">
                <Field label="Routing number" gusto="Routing number">
                  <input inputMode="numeric" placeholder={packet.routing_last4 ? `••••${packet.routing_last4}` : '9 digits'} value={routingDraft} onChange={(e) => onRouting(e.target.value)} />
                </Field>
                <Field label="Account number" gusto="Account number">
                  <input inputMode="numeric" placeholder={packet.account_last4 ? `••••${packet.account_last4}` : 'Account'} value={accountDraft} onChange={(e) => onAccount(e.target.value)} />
                </Field>
                <Field label="Account type" gusto="Checking or savings">
                  <select value={packet.account_type} onChange={(e) => onPatch({ account_type: e.target.value as OnboardingPacket['account_type'] })}>
                    <option value="">Select</option>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </Field>
              </div>
              <p className="gusto-note">OS stores last-fours only. Enter the full routing and account numbers in Gusto → Payment method.</p>
            </>
          )}
        </>
      )}

      {step === 'work' && (
        <>
          <Field label="Citizenship / employment status" gusto="I-9 Section 1">
            <select value={packet.work_auth} onChange={(e) => onPatch({ work_auth: e.target.value })}>
              <option value="">Select</option>
              {GUSTO_I9_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </Field>
          {packet.work_auth === GUSTO_I9_STATUSES[2] && (
            <Field label="USCIS / A-Number" gusto="Permanent resident number">
              <input value={packet.i9_uscis} onChange={(e) => onPatch({ i9_uscis: e.target.value })} placeholder="A-number" />
            </Field>
          )}
          {packet.work_auth === GUSTO_I9_STATUSES[3] && (
            <div className="form-row">
              <Field label="Authorized until" gusto="Work-auth expiration">
                <input type="date" value={packet.i9_work_until} onChange={(e) => onPatch({ i9_work_until: e.target.value })} />
              </Field>
              <Field label="USCIS / I-94 / admission #" gusto="I-9 document number">
                <input value={packet.i9_uscis} onChange={(e) => onPatch({ i9_uscis: e.target.value })} />
              </Field>
            </div>
          )}
          <label className="nsos-check live-onboard-check">
            <input type="checkbox" checked={packet.i9_ack} onChange={(e) => onPatch({ i9_ack: e.target.checked })} />
            I attest under penalty of perjury that I am authorized to work in the United States (Gusto Form I-9, Section 1).
          </label>
          <label className="nsos-check live-onboard-check">
            <input type="checkbox" checked={packet.handbook_ack} onChange={(e) => onPatch({ handbook_ack: e.target.checked })} />
            I received the North Splash handbook and workplace policies.
          </label>
        </>
      )}

      {step === 'emergency' && (
        <div className="form-row">
          <Field label="Contact name" gusto="Emergency contact name">
            <input value={packet.emergency_name} onChange={(e) => onPatch({ emergency_name: e.target.value })} required />
          </Field>
          <Field label="Relationship" gusto="Relationship">
            <input value={packet.emergency_relation} onChange={(e) => onPatch({ emergency_relation: e.target.value })} placeholder="Spouse, parent…" />
          </Field>
          <Field label="Phone" gusto="Emergency phone">
            <input type="tel" value={packet.emergency_phone} onChange={(e) => onPatch({ emergency_phone: e.target.value })} required />
          </Field>
          <Field label="Email" gusto="Emergency email">
            <input type="email" value={packet.emergency_email} onChange={(e) => onPatch({ emergency_email: e.target.value })} placeholder="optional" />
          </Field>
        </div>
      )}

      <button className="btn-primary" type="submit" disabled={busy}>{saveLabel}</button>
    </form>
  );
}
