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
          <span className="nsos-eyebrow eyebrow">{self ? 'Your hire packet' : 'Onboarding packet'}</span>
          <h3>{complete ? (self ? 'You are on the roster' : `${hireName} finished the packet`) : self ? 'Finish your hire packet' : `Finish hiring ${hireName}`}</h3>
          <p>
            {complete
              ? (self ? `Next is ${academyLabel || 'new-hire academy'}. Last-four identifiers stay last-four — never a full Social or account number.` : 'Packet fields are on file. Send them into academy before a live route.')
              : self
                ? `North Splash stores last-four identifiers only. ${left} step${left === 1 ? '' : 's'} left${nextLabel ? ` · next: ${nextLabel}` : ''}.`
                : `The hire fills this in. ${left} step${left === 1 ? '' : 's'} left${nextLabel ? ` · next: ${nextLabel}` : ''}.`}
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
            <strong>{self ? 'Packet complete' : 'Ready for academy'}</strong>
            <p>{self ? `Open ${academyLabel || 'training'} before you run a live route.` : `${hireName} can open ${academyLabel || 'new-hire academy'} from their portal.`}</p>
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
