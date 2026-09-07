import { FormEvent, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { firstWord } from '@/lib/data';
import type { OnboardingPacket, OsEmployee } from './demoData';
import { emptyOnboarding, onboardingPercent } from './demoData';
import { last4, nextOnboardingStep, ONBOARDING_STEP_META, remainingStepLabels, type OnboardingStepId } from '@/lib/onboarding';
import { validateGustoStep } from '@/lib/gustoPayroll';
import { useOs } from './osStore';
import OnboardingPacketShell from '@/components/OnboardingPacketShell';
import OnboardingGustoForm, { GustoPayrollSummary } from '@/components/OnboardingGustoForm';

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
  const [step, setStep] = useState<OnboardingStepId>(() => nextOnboardingStep(employee.onboarding_packet)?.id || 'identity');
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

  const completeStep = (id: OnboardingStepId) => {
    setError('');
    const invalid = validateGustoStep(id, packet, { ssn: ssnDraft, routing: routingDraft, account: accountDraft }, { hasHeadshot: Boolean(packet.headshot) });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (id === 'tax') {
      patch({ ssn_last4: last4(ssnDraft) || packet.ssn_last4, ssn_on_file: true }, [id]);
      setSsnDraft('');
      setStep('pay');
      return;
    }
    if (id === 'pay') {
      if (packet.payment_method === 'direct_deposit') {
        patch({
          routing_last4: last4(routingDraft) || packet.routing_last4,
          account_last4: last4(accountDraft) || packet.account_last4,
        }, [id]);
      } else {
        patch({}, [id]);
      }
      setRoutingDraft('');
      setAccountDraft('');
      setStep('work');
      return;
    }
    patch({}, [id]);
    const order = ONBOARDING_STEP_META.map((s) => s.id);
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

  const remaining = useMemo(() => remainingStepLabels(packet), [packet.steps]);
  const nextMeta = nextOnboardingStep(packet);

  return (
    <OnboardingPacketShell
      audience="manager"
      hireName={firstWord(employee.name)}
      percent={percent}
      remaining={remaining}
      nextLabel={nextMeta?.label}
      steps={ONBOARDING_STEP_META.map((s) => ({ id: s.id, label: s.label, done: Boolean(packet.steps[s.id]) }))}
      activeStep={step}
      onSelectStep={(id) => setStep(id as OnboardingStepId)}
      error={error}
    >
      <OnboardingGustoForm
        packet={packet}
        step={step}
        ssnDraft={ssnDraft}
        routingDraft={routingDraft}
        accountDraft={accountDraft}
        onSsn={setSsnDraft}
        onRouting={setRoutingDraft}
        onAccount={setAccountDraft}
        onPatch={(partial) => patch(partial)}
        onSubmit={() => completeStep(step)}
        remainingCount={remaining.length}
        headshot={step === 'identity' ? (
          <label className="nsos-headshot">
            {packet.headshot ? <img src={packet.headshot} alt="" /> : <span><Camera size={18} />Add headshot</span>}
            <input type="file" accept="image/*" onChange={onPhoto} />
          </label>
        ) : null}
      />
      {percent >= 80 && <GustoPayrollSummary packet={packet} />}
    </OnboardingPacketShell>
  );
}
