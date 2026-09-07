import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { firstWord, prettyLabel } from '@/lib/data';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import OnboardingPacketShell from '@/components/OnboardingPacketShell';
import OnboardingGustoForm, { GustoPayrollSummary } from '@/components/OnboardingGustoForm';
import { validateGustoStep } from '@/lib/gustoPayroll';
import {
  academyNextLabel,
  emptyOnboarding,
  last4,
  loadOnboardingPacket,
  loadOnboardingTasks,
  nextOnboardingStep,
  ONBOARDING_STEP_META,
  onboardingPercent,
  remainingStepLabels,
  saveOnboardingPacket,
  type OnboardingPacket,
  type OnboardingStepId,
  type OnboardingTask,
} from '@/lib/onboarding';
import type { Employee } from '@/lib/supabase';

type Props = {
  employee: Employee;
  onUpdated: (employee: Employee) => void;
  audience?: 'self' | 'manager';
  onOpenTraining?: () => void;
};

export default function EmployeeOnboardingTab({ employee, onUpdated, audience = 'manager', onOpenTraining }: Props) {
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
          personal_phone: next.personal_phone || employee.phone || '',
          personal_email: next.personal_email || employee.email || '',
        });
        setTasks(nextTasks);
        setStep((nextOnboardingStep(next)?.id || 'identity') as OnboardingStepId);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [employee.id]);

  const percent = onboardingPercent(packet);
  const remaining = useMemo(() => remainingStepLabels(packet), [packet.steps]);
  const nextMeta = nextOnboardingStep(packet);
  const packetTasks = tasks.filter((t) => !['d2d', 'detailer'].includes(t.category));
  const academyTasks = tasks.filter((t) => ['d2d', 'detailer'].includes(t.category));

  const persist = async (next: OnboardingPacket) => {
    setSaving(true);
    setError('');
    try {
      const updated = await saveOnboardingPacket(employee, next);
      setPacket(next);
      onUpdated(updated);
      setTasks(await loadOnboardingTasks(employee.id));
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
    const invalid = validateGustoStep(id, next, { ssn: ssnDraft, routing: routingDraft, account: accountDraft }, { hasHeadshot: Boolean(employee.avatar_url) });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (id === 'tax') {
      next = { ...next, ssn_last4: last4(ssnDraft) || next.ssn_last4, ssn_on_file: true };
      setSsnDraft('');
    }
    if (id === 'pay' && next.payment_method === 'direct_deposit') {
      next = { ...next, routing_last4: last4(routingDraft) || next.routing_last4, account_last4: last4(accountDraft) || next.account_last4 };
      setRoutingDraft('');
      setAccountDraft('');
    }
    next.steps = { ...next.steps, [id]: true };
    await persist(next);
    const order = ONBOARDING_STEP_META.map((s) => s.id);
    setStep(order[Math.min(order.indexOf(id) + 1, order.length - 1)]);
  };

  if (loading) return <div className="ns-empty compact">Loading Gusto payroll packet…</div>;

  return (
    <OnboardingPacketShell
      audience={audience}
      hireName={firstWord(employee.name)}
      percent={percent}
      remaining={remaining}
      nextLabel={nextMeta?.label}
      steps={ONBOARDING_STEP_META.map((s) => ({ id: s.id, label: s.label, done: Boolean(packet.steps[s.id]) }))}
      activeStep={step}
      onSelectStep={(id) => setStep(id as OnboardingStepId)}
      academyLabel={academyNextLabel(employee)}
      onOpenTraining={onOpenTraining}
      error={error}
    >
      <OnboardingGustoForm
        packet={packet}
        step={step}
        saving={saving}
        ssnDraft={ssnDraft}
        routingDraft={routingDraft}
        accountDraft={accountDraft}
        onSsn={setSsnDraft}
        onRouting={setRoutingDraft}
        onAccount={setAccountDraft}
        onPatch={patch}
        onSubmit={() => void completeStep(step)}
        remainingCount={remaining.length}
        headshot={step === 'identity' ? (
          <div className="live-onboard-headshot">
            <EmployeeAvatar employee={employee} size="xl" editable onUploaded={(url) => onUpdated({ ...employee, avatar_url: url })} />
            <span><Camera size={14} /> Roster headshot (North Splash, not Gusto)</span>
          </div>
        ) : null}
      />
      {percent >= 100 && audience === 'manager' && <GustoPayrollSummary packet={packet} />}
      {packetTasks.length > 0 && (
        <div className="live-onboard-tasks">
          <span className="eyebrow">Gusto packet checklist</span>
          {packetTasks.map((t) => (
            <div key={t.id} className={t.status === 'completed' ? 'done' : ''}>
              <strong>{t.title}</strong>
              <small>{t.description || t.category}</small>
              <em>{prettyLabel(t.status)}</em>
            </div>
          ))}
        </div>
      )}
      {academyTasks.length > 0 && (
        <div className="live-onboard-tasks academy">
          <span className="eyebrow">After Gusto</span>
          {academyTasks.map((t) => (
            <div key={t.id} className={t.status === 'completed' ? 'done' : ''}>
              <strong>{t.title}</strong>
              <small>{t.description || t.category}</small>
              <em>{prettyLabel(t.status)}</em>
            </div>
          ))}
        </div>
      )}
    </OnboardingPacketShell>
  );
}
