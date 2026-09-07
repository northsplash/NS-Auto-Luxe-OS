import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import { loadOnboardingSummaries, isOnboardingOpen, type OnboardingSummary } from '@/lib/onboarding';
import { prettyLabel } from '@/lib/data';
import type { Employee } from '@/lib/supabase';

type Props = {
  employees: Employee[];
  onOpen: (employee: Employee) => void;
};

export default function OwnerOnboardingQueue({ employees, onOpen }: Props) {
  const open = employees.filter((e) => isOnboardingOpen(e.onboarding_status));
  const [summaries, setSummaries] = useState<OnboardingSummary[]>([]);

  useEffect(() => {
    let live = true;
    if (!open.length) { setSummaries([]); return; }
    loadOnboardingSummaries(open.map((e) => e.id)).then((rows) => { if (live) setSummaries(rows); });
    return () => { live = false; };
  }, [open.map((e) => `${e.id}:${e.onboarding_status}`).join('|')]);

  if (!open.length) return null;
  const byId = new Map(summaries.map((s) => [s.employeeId, s]));

  return (
    <section className="owner-onboard-queue">
      <div className="owner-onboard-queue-head">
        <ClipboardCheck size={16} />
        <div>
          <span className="eyebrow">Open packets</span>
          <h3>{open.length} hire{open.length === 1 ? '' : 's'} still onboarding</h3>
          <p>Gusto payroll packet — personal, W-4, payment, I-9, emergency.</p>
        </div>
      </div>
      <div className="owner-onboard-queue-grid">
        {open.map((e) => {
          const summary = byId.get(e.id);
          const percent = summary?.percent ?? (e.onboarding_status === 'in_progress' ? 40 : 0);
          return (
            <button type="button" key={e.id} className="owner-onboard-queue-card" onClick={() => onOpen(e)}>
              <EmployeeAvatar employee={e} size="md" />
              <div>
                <strong>{e.name}</strong>
                <small>{e.title || prettyLabel(e.role)} · next {summary?.nextLabel || 'Identity'}</small>
                <i className="nsos-onboard"><b style={{ width: `${percent}%` }} /></i>
              </div>
              <em>{percent}%</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
