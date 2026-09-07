import type { ReactNode } from 'react';
import { Check, CheckCircle2, GraduationCap } from 'lucide-react';

type Step = {
  id: string;
  label: string;
  done: boolean;
};

type Props = {
  audience?: 'self' | 'manager';
  hireName: string;
  percent: number;
  remaining: string[];
  nextLabel?: string | null;
  steps: Step[];
  activeStep: string;
  onSelectStep: (id: string) => void;
  academyLabel?: string;
  onOpenTraining?: () => void;
  error?: string;
  children: ReactNode;
};

export default function OnboardingPacketShell({
  audience = 'manager',
  hireName,
  percent,
  remaining,
  nextLabel,
  steps,
  activeStep,
  onSelectStep,
  academyLabel,
  onOpenTraining,
  error,
  children,
}: Props) {
  const complete = percent >= 100;
  const left = remaining.length;
  const self = audience === 'self';

  return (
    <div className="nsos-onboard-flow live-onboard-v37">
      <div className={`nsos-onboard-hero ${complete ? 'complete' : ''}`}>
        <div>
          <span className="nsos-eyebrow eyebrow">{self ? 'Your Gusto payroll packet' : 'Gusto payroll packet'}</span>
          <h3>{complete ? (self ? 'You are ready for Gusto' : `${hireName} finished the Gusto packet`) : self ? 'Finish your Gusto hire packet' : `Finish Gusto hiring for ${hireName}`}</h3>
          <p>
            {complete
              ? (self ? `Next is ${academyLabel || 'new-hire academy'}. Full SSN and bank numbers go in Gusto — this OS only keeps last-fours.` : 'Copy the Gusto summary into People → Add employee, then send them into academy.')
              : self
                ? `These questions match Gusto payroll: personal details, W-4, payment method, I-9, and emergency contact. ${left} step${left === 1 ? '' : 's'} left${nextLabel ? ` · next: ${nextLabel}` : ''}.`
                : `Same fields Gusto asks. ${left} step${left === 1 ? '' : 's'} left${nextLabel ? ` · next: ${nextLabel}` : ''}.`}
          </p>
        </div>
        <div className="nsos-onboard-meter">
          <strong>{percent}%</strong>
          <i className="nsos-onboard" aria-hidden><b style={{ width: `${percent}%` }} /></i>
          <small>{complete ? 'Complete' : `${5 - left} of 5`}</small>
        </div>
      </div>

      {complete && (
        <div className="nsos-onboard-done">
          <CheckCircle2 size={22} />
          <div>
            <strong>{self ? 'Packet complete' : 'Ready for Gusto'}</strong>
            <p>{self ? `Open ${academyLabel || 'training'} before you run a live route.` : `Add ${hireName} in Gusto People, then they can open ${academyLabel || 'new-hire academy'} from their portal.`}</p>
          </div>
          {onOpenTraining && <button type="button" className="btn-primary" onClick={onOpenTraining}><GraduationCap size={15} />{academyLabel || 'Open academy'}</button>}
        </div>
      )}

      <ol className="nsos-onboard-steps">
        {steps.map((s) => (
          <li key={s.id}>
            <button type="button" className={`${activeStep === s.id ? 'active' : ''} ${s.done ? 'done' : ''}`} onClick={() => onSelectStep(s.id)}>
              {s.done ? <Check size={14} /> : <span className="nsos-onboard-index">{steps.findIndex((x) => x.id === s.id) + 1}</span>}
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      {error && <div className="nsos-onboard-error" role="alert">{error}</div>}
      {children}
    </div>
  );
}
