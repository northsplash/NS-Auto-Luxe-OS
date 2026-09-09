import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CommunicationTemplate } from '@/lib/communicationCatalog';
import { channelLabel, fillTemplate } from '@/lib/communicationCatalog';
import type { EmployeeDraft } from '@/lib/rolePresets';
import { firstWord, money, prettyLabel } from '@/lib/data';
import {
  clockNow, defaultTemplates, initialsOf, normalizeActivity, normalizeChat, normalizeEmployee, normalizeJob, normalizeLead,
  seedActivity, seedCandidates, seedChats, seedCustomers, seedEmployees, seedJobs, seedLeads,
  seedPayments, seedSettings, seedShifts, seedTimeOff, uid, emptyOnboarding,
  normalizeCandidate, normalizeCustomer, jobPartyName,
  type JobDraft, type JobStatus, type LeadStatus, type OsActivity, type OsCandidate, type OsChat,
  type OsCustomer, type OsEmployee, type OsJob, type OsLead, type OsPayment, type OsSettings,
  type OsShift, type OsTimeOff, type Weekday,
} from './demoData';
import { liveOpenSlots, localYmd } from './appointmentSlots';
import { srStatus, srTemp } from '@/lib/salesRabbitLeads';

function list<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

const KEY = 'ns-os-v10';

export type Toast = { id: string; title: string; body: string };

export type OsSnapshot = {
  employees: OsEmployee[];
  jobs: OsJob[];
  leads: OsLead[];
  chats: OsChat[];
  payments: OsPayment[];
  candidates: OsCandidate[];
  templates: CommunicationTemplate[];
  shifts: OsShift[];
  timeOff: OsTimeOff[];
  activity: OsActivity[];
  customers: OsCustomer[];
  settings: OsSettings;
};

function seed(): OsSnapshot {
  return {
    employees: seedEmployees,
    jobs: seedJobs.map((j) => normalizeJob(j)),
    leads: seedLeads.map((l) => normalizeLead(l)),
    chats: seedChats,
    payments: seedPayments,
    candidates: seedCandidates,
    templates: defaultTemplates,
    shifts: seedShifts,
    timeOff: seedTimeOff,
    activity: seedActivity,
    customers: seedCustomers,
    settings: seedSettings,
  };
}

function migrate(data: Partial<OsSnapshot>): OsSnapshot {
  const base = seed();
  return {
    ...base,
    ...data,
    employees: (data.employees?.length ? data.employees : base.employees).map((e) => {
      const next = normalizeEmployee(e);
      if (!next.onboarding_packet) {
        const seeded = base.employees.find((s) => s.id === next.id);
        if (seeded?.onboarding_packet) next.onboarding_packet = seeded.onboarding_packet;
      }
      return next;
    }),
    jobs: (data.jobs?.length ? data.jobs : base.jobs).map((j) => normalizeJob(j)),
    leads: (data.leads?.length ? data.leads : base.leads).map((l) => normalizeLead(l)),
    chats: (data.chats?.length ? data.chats : base.chats).map((c) => normalizeChat(c)),
    payments: data.payments?.length ? data.payments : base.payments,
    templates: defaultTemplates.map((t) => {
      const saved = (data.templates || []).find((x) => x.id === t.id);
      return saved ? { ...t, ...saved } : t;
    }),
    shifts: data.shifts?.length ? data.shifts : base.shifts,
    timeOff: data.timeOff?.length ? data.timeOff : base.timeOff,
    activity: (data.activity?.length ? data.activity : base.activity).map((a) => normalizeActivity(a)),
    customers: (data.customers?.length ? data.customers : base.customers).map((c) => normalizeCustomer(c)),
    candidates: (data.candidates?.length ? data.candidates : base.candidates).map((c) => {
      const next = normalizeCandidate(c);
      const seeded = base.candidates.find((s) => s.id === next.id);
      if (seeded && /\/apply|northsplash\.com\/apply/i.test(next.notes || '')) next.notes = seeded.notes;
      return next;
    }),
    settings: { ...base.settings, ...(data.settings || {}) },
  };
}

function slimForStorage(state: OsSnapshot): OsSnapshot {
  return {
    ...state,
    employees: state.employees.map((e) => ({
      ...e,
      photo: e.photo?.startsWith('data:') ? undefined : e.photo,
      onboarding_packet: e.onboarding_packet
        ? { ...e.onboarding_packet, headshot: e.onboarding_packet.headshot?.startsWith('data:') ? undefined : e.onboarding_packet.headshot }
        : e.onboarding_packet,
    })),
  };
}

function persist(state: OsSnapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 3, data: state }));
  } catch {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 3, data: slimForStorage(state) }));
    } catch {
      /* Demo photos can overflow storage; keep the session in memory. */
    }
  }
}

function load(): OsSnapshot {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('ns-os-v9') || localStorage.getItem('ns-os-v7') || localStorage.getItem('ns-os-v6') || localStorage.getItem('ns-os-v2');
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as { v?: number; data?: Partial<OsSnapshot> };
    return migrate(parsed?.data || (parsed as Partial<OsSnapshot>));
  } catch {
    return seed();
  }
}

function jobVars(job: OsJob) {
  return {
    customer_first_name: firstWord(jobPartyName(job), 'Guest'),
    customer_name: jobPartyName(job),
    detailer_name: job.detailer || 'Your North Splash detailer',
    employee_name: job.detailer || '',
    vehicle: job.vehicle || '',
    vehicle_info: job.vehicle || '',
    service: job.service || '',
    service_name: job.service || '',
    appointment_time: job.time || '',
    appointment_date: job.time || '',
    price: money(job.price),
    amount: money(job.price),
    eta: job.eta || 'about 15 minutes',
    address: job.address || '',
    service_address: job.address || '',
    portal_link: 'https://ns-auto-luxe-os.vercel.app/portal',
  };
}

function statusToStep(status: JobStatus): CommunicationTemplate['status_step'] {
  if (status === 'scheduled') return 'booked';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'en_route' || status === 'arrived') return 'en_route';
  if (status === 'in_progress') return 'in_progress';
  return 'complete';
}

const PRIMARY_TEMPLATE: Partial<Record<JobStatus, string>> = {
  scheduled: 'confirmation_request',
  confirmed: 'booking_confirmed',
  en_route: 'detailer_en_route',
  arrived: 'detailer_arrived',
  in_progress: 'job_started',
  completed: 'job_completed',
};

const HUES = ['#7c6a4a', '#3d5a4c', '#5c3d5a', '#3d4a5c', '#6a4a3d', '#c8a96a'];

type OsApi = OsSnapshot & {
  toast: Toast | null;
  dismissToast: () => void;
  resetDemo: () => void;
  hireEmployee: (draft: EmployeeDraft) => OsEmployee;
  updateEmployee: (id: string, patch: Partial<OsEmployee>) => void;
  toggleDocument: (employeeId: string, docId: string) => void;
  sendChat: (chatId: string, body: string) => void;
  markChatRead: (chatId: string) => void;
  createChat: (name: string, kind: 'dm' | 'space', memberNames?: string[]) => string;
  setJobStatus: (id: string, status: JobStatus) => void;
  assignJob: (jobId: string, detailer: string) => void;
  addJobNote: (id: string, body: string) => void;
  addJobPhoto: (id: string, kind: 'before' | 'after') => void;
  toggleJobChecklist: (jobId: string, stepId: string) => void;
  setJobNotes: (id: string, internal_notes: string) => void;
  collectJob: (id: string) => void;
  refundPayment: (id: string) => void;
  retryPayment: (id: string) => void;
  setLeadStatus: (id: string, status: LeadStatus) => void;
  assignLead: (id: string, rep: string) => void;
  addLeadNote: (id: string, body: string) => void;
  convertLead: (id: string, opts?: { time?: string; service?: string; price?: number; detailer?: string }) => string | null;
  patchLead: (id: string, patch: Partial<OsLead>) => void;
  ensureCustomer: (incoming: Partial<OsCustomer> & { name: string }) => string;
  addCustomerNote: (id: string, body: string) => void;
  moveShift: (shiftId: string, day: Weekday) => void;
  addShift: (employeeId: string, day: Weekday) => void;
  removeShift: (shiftId: string) => void;
  setAvailability: (employeeId: string, day: Weekday, on: boolean) => void;
  setTimeOffStatus: (id: string, status: OsTimeOff['status']) => void;
  requestTimeOff: (employeeId: string, reason: string) => void;
  toggleChecklist: (candidateId: string, itemId: string) => void;
  patchTemplate: (id: string, partial: Partial<CommunicationTemplate>) => void;
  sendTestComm: (templateId: string, jobId?: string) => void;
  saveSettings: (patch: Partial<OsSettings>) => void;
  renameChat: (id: string, name: string) => void;
  shareToChat: (chatId: string, body: string) => void;
  createJob: (draft: JobDraft) => string;
  addLead: (name: string, address: string, extra?: Partial<OsLead>) => string;
  toggleMember: (customerId: string) => void;
  rescheduleJob: (id: string, time: string) => void;
};

const OsContext = createContext<OsApi | null>(null);

export function OsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OsSnapshot>(load);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    persist(state);
  }, [state]);

  const flash = useCallback((title: string, body: string) => {
    const id = uid();
    setToast({ id, title, body });
    window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 4200);
  }, []);

  const fireComms = useCallback((job: OsJob, status: JobStatus, templates: CommunicationTemplate[], templateId?: string) => {
    const step = statusToStep(status);
    const vars = jobVars({ ...job, status });
    const primary = templateId || PRIMARY_TEMPLATE[status];
    const hits = templates.filter((t) => {
      if (!t.is_enabled || !(t.sms_enabled || t.email_enabled)) return false;
      if (primary) return t.id === primary || t.event_key === primary;
      return t.status_step === step;
    });
    return hits.slice(0, 2).flatMap((t) => {
      const rows: OsJob['comms'] = [];
      if (t.sms_enabled) {
        rows.push({
          id: `${job.id}_${t.id}_sms`,
          channel: 'sms' as const,
          name: t.name,
          preview: fillTemplate(t.sms_body, vars),
          at: clockNow(),
        });
      }
      if (t.email_enabled) {
        rows.push({
          id: `${job.id}_${t.id}_email`,
          channel: 'email' as const,
          name: t.name,
          preview: fillTemplate(t.subject, vars),
          at: clockNow(),
        });
      }
      return rows;
    });
  }, []);

  const api = useMemo<OsApi>(() => ({
    ...state,
    toast,
    dismissToast: () => setToast(null),
    resetDemo: () => {
      localStorage.removeItem(KEY);
      localStorage.removeItem('ns-os-v9');
      localStorage.removeItem('ns-os-v7');
      localStorage.removeItem('ns-os-v6');
      localStorage.removeItem('ns-os-v2');
      setState(seed());
      flash('Demo reset', 'North Splash OS restored to seed data.');
    },
    hireEmployee: (draft) => {
      const emp: OsEmployee = {
        id: `e_${Date.now()}`,
        name: draft.name,
        title: draft.title,
        role: draft.role,
        department: draft.department,
        status: 'active',
        email: draft.email,
        phone: draft.phone,
        initials: initialsOf(draft.name),
        hue: HUES[Math.floor(Math.random() * HUES.length)],
        pay_type: draft.pay_type,
        hourly_rate: draft.hourly_rate,
        annual_salary: draft.annual_salary,
        weekly_base: draft.weekly_base,
        commission_rate: draft.commission_rate,
        per_job_rate: draft.per_job_rate,
        pay_schedule: draft.pay_schedule,
        hours_week: 0,
        onboarding: 8,
        location: draft.work_location,
        onboarding_packet: { ...emptyOnboarding(), legal_first: firstWord(draft.name), legal_last: String(draft.name || '').trim().split(/\s+/).slice(1).join(' '), preferred: firstWord(draft.name) },
        documents: [
          { id: uid(), name: 'Offer letter', status: 'review' },
          { id: uid(), name: 'I-9', status: 'missing' },
          { id: uid(), name: 'W-4', status: 'missing' },
          { id: uid(), name: 'Handbook', status: 'missing' },
          { id: uid(), name: 'Direct deposit', status: 'missing' },
          { id: uid(), name: 'Headshot', status: 'missing' },
        ],
        availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
        custom_compensation: draft.custom_compensation,
      };
      setState((s) => ({
        ...s,
        employees: [emp, ...s.employees],
        chats: [{
          id: `c_${emp.id}`, name: emp.name, kind: 'dm', preview: 'Added to North Splash.', at: clockNow(), unread: 0,
          initials: emp.initials, hue: emp.hue,
          messages: [{ id: uid(), from: 'You', mine: true, body: `Welcome to North Splash, ${firstWord(emp.name, 'there')}.`, at: clockNow() }],
        }, ...s.chats],
        activity: [{ id: uid(), at: clockNow(), text: `Hired ${emp.name} as ${emp.title}.`, kind: 'hire' }, ...s.activity],
      }));
      flash('Employee added', `${emp.name} · ${emp.title}`);
      return emp;
    },
    updateEmployee: (id, patch) => setState((s) => ({
      ...s,
      employees: s.employees.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        if (typeof patch.name === 'string' && patch.name.trim()) next.initials = initialsOf(next.name);
        return next;
      }),
    })),
    toggleDocument: (employeeId, docId) => setState((s) => ({
      ...s,
      employees: s.employees.map((e) => {
        if (e.id !== employeeId) return e;
        const documents = (e.documents || []).map((d) => {
          if (d.id !== docId) return d;
          const status: OsEmployee['documents'][number]['status'] = d.status === 'complete' ? 'missing' : d.status === 'review' ? 'complete' : 'review';
          return { ...d, status };
        });
        const onboarding = documents.length
          ? Math.round((documents.filter((d) => d.status === 'complete').length / documents.length) * 100)
          : 0;
        return { ...e, documents, onboarding };
      }),
    })),
    sendChat: (chatId, body) => setState((s) => {
      const at = clockNow();
      return {
        ...s,
        chats: s.chats.map((c) => c.id !== chatId ? c : {
          ...c, preview: body, at, unread: 0,
          messages: [...(Array.isArray(c.messages) ? c.messages : []), { id: uid(), from: 'You', mine: true, body, at }],
        }),
      };
    }),
    markChatRead: (chatId) => setState((s) => ({
      ...s,
      chats: s.chats.map((c) => c.id === chatId ? { ...c, unread: 0 } : c),
    })),
    createChat: (name, kind, memberNames) => {
      const id = `c_${Date.now()}`;
      const members = (memberNames || []).map((n) => String(n || '').trim()).filter(Boolean);
      const chat: OsChat = {
        id, name, kind, channel_type: kind === 'space' ? 'custom' : 'dm',
        description: kind === 'space'
          ? (members.length ? `Team · ${members.join(', ')}` : 'Private team group')
          : undefined,
        preview: kind === 'space' ? 'Space created' : 'New chat', at: clockNow(), unread: 0,
        initials: initialsOf(name), hue: HUES[0], topic: kind === 'space' ? 'New space' : undefined,
        members,
        messages: [],
      };
      setState((s) => ({ ...s, chats: [chat, ...s.chats] }));
      return id;
    },
    setJobStatus: (id, status) => {
      let sent: OsJob['comms'][number] | undefined;
      setState((s) => {
        const job = s.jobs.find((j) => j.id === id);
        if (!job || job.status === status) return s;
        const extra = fireComms(job, status, s.templates);
        const comms = list(job.comms);
        const have = new Set(comms.map((c) => c.id));
        const fresh = extra.filter((c) => !have.has(c.id));
        sent = fresh[0];
        const next: OsJob = {
          ...job,
          status,
          eta: status === 'en_route' ? job.eta || '15 min' : job.eta,
          comms: [...fresh, ...comms],
        };
        const crew = s.chats.find((c) => c.channel_type === 'crew' || (c.kind === 'space' && String(c.name || '').toLowerCase().includes('crew')));
        const actId = `act_${job.id}_${status}`;
        const statusLabel = prettyLabel(status);
        const activity = s.activity.some((a) => a.id === actId)
          ? s.activity
          : [{
              id: actId, at: clockNow(), kind: 'comms' as const,
              text: `${firstWord(job.detailer, 'Detailer')} moved ${firstWord(jobPartyName(job), 'Guest')}’s job to ${statusLabel}${fresh[0] ? ` · ${fresh[0].channel.toUpperCase()} sent` : ''}.`,
            }, ...s.activity];
        return {
          ...s,
          jobs: s.jobs.map((j) => j.id === id ? next : j),
          activity,
          chats: crew ? s.chats.map((c) => c.id !== crew.id ? c : {
            ...c, preview: `${job.service} → ${statusLabel}`, at: clockNow(),
            messages: (c.messages || []).some((m) => m.id === `m_${job.id}_${status}`)
              ? (c.messages || [])
              : [...(c.messages || []), { id: `m_${job.id}_${status}`, from: 'OS', body: `${job.customer} · ${job.service} is now ${statusLabel}.`, at: clockNow() }],
          }) : s.chats,
        };
      });
      if (sent) flash(sent.channel === 'sms' ? 'SMS sent' : 'Email sent', `${sent.name} · customer notified`);
    },
    assignJob: (jobId, detailer) => setState((s) => {
      const job = s.jobs.find((j) => j.id === jobId);
      if (!job) return s;
      const next = { ...job, detailer };
      const extra = job.detailer === detailer ? [] : fireComms({ ...next, status: 'confirmed' }, 'confirmed', s.templates, 'detailer_assigned');
      return {
        ...s,
        jobs: s.jobs.map((j) => j.id === jobId ? { ...next, comms: [...extra, ...list(j.comms)] } : j),
        activity: [{ id: uid(), at: clockNow(), kind: 'ops', text: `${job.service} reassigned to ${detailer}.` }, ...s.activity],
      };
    }),
    addJobNote: (id, body) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id !== id ? j : {
        ...j, notes: [{ id: uid(), at: clockNow(), author: 'You', body }, ...list(j.notes)],
      }),
    })),
    addJobPhoto: (id, kind) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id !== id ? j : {
        ...j,
        photos: [...list(j.photos), {
          id: uid(),
          label: kind === 'before' ? `Before · ${list(j.photos).length + 1}` : `After · ${list(j.photos).length + 1}`,
          kind,
          src: kind === 'before'
            ? 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&h=420&w=640'
            : 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640',
        }],
      }),
    })),
    toggleJobChecklist: (jobId, stepId) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id !== jobId ? j : {
        ...j,
        checklist: list(j.checklist).map((step) => step.id === stepId ? { ...step, done: !step.done } : step),
      }),
    })),
    setJobNotes: (id, internal_notes) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id === id ? { ...j, internal_notes } : j),
    })),
    collectJob: (id) => {
      setState((s) => {
        const job = s.jobs.find((j) => j.id === id);
        if (!job || job.payment === 'paid') return s;
        const pay: OsPayment = { id: `pay_${id}`, jobId: id, customer: job.customer, amount: job.price, method: 'Card on file', status: 'succeeded', at: clockNow() };
        const extra = fireComms({ ...job, payment: 'paid' }, 'completed', s.templates, 'payment_received');
        const have = new Set(list(job.comms).map((c) => c.id));
        const fresh = extra.filter((c) => !have.has(c.id));
        return {
          ...s,
          jobs: s.jobs.map((j) => j.id === id ? { ...j, payment: 'paid' as const, comms: [...fresh, ...list(j.comms)] } : j),
          payments: s.payments.map((p) => p.jobId === id && p.status === 'pending' ? { ...p, status: 'succeeded' as const, at: clockNow(), method: 'Card on file' } : p).concat(
            s.payments.some((p) => p.jobId === id) ? [] : [pay],
          ),
          activity: [{ id: `act_pay_${id}`, at: clockNow(), kind: 'pay', text: `Collected ${money(job.price)} from ${job.customer}. Receipt sent.` }, ...s.activity.filter((a) => a.id !== `act_pay_${id}`)],
        };
      });
      flash('Payment collected', 'Receipt SMS/email sent if that template is on.');
    },
    refundPayment: (id) => {
      setState((s) => {
        const pay = s.payments.find((p) => p.id === id);
        if (!pay || pay.status === 'refunded') return s;
        const job = s.jobs.find((j) => j.id === pay.jobId);
        const extra = job ? fireComms(job, 'completed', s.templates, 'refund_issued') : [];
        return {
          ...s,
          payments: s.payments.map((p) => p.id === id ? { ...p, status: 'refunded' as const } : p),
          jobs: s.jobs.map((j) => {
            if (j.id !== pay.jobId) return j;
            const comms = list(j.comms);
            return { ...j, payment: 'refunded' as const, comms: [...extra.filter((c) => !comms.some((x) => x.id === c.id)), ...comms] };
          }),
          activity: [{ id: `act_ref_${id}`, at: clockNow(), kind: 'pay', text: `Refunded ${money(pay.amount)} to ${pay.customer}.` }, ...s.activity],
        };
      });
      flash('Refunded', 'Refund notice sent if that template is on.');
    },
    retryPayment: (id) => setState((s) => ({
      ...s,
      payments: s.payments.map((p) => p.id === id ? { ...p, status: 'succeeded', at: clockNow() } : p),
    })),
    setLeadStatus: (id, status) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id !== id ? l : {
        ...l, status, temp: srTemp(status),
        activity: [{ id: uid(), at: clockNow(), author: l.rep, body: `Moved to ${srStatus(status).name}.` }, ...list(l.activity)],
      }),
      activity: [{ id: uid(), at: clockNow(), kind: 'sales', text: `Lead ${s.leads.find((l) => l.id === id)?.name} → ${srStatus(status).name}.` }, ...s.activity],
    })),
    assignLead: (id, rep) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id === id ? { ...l, rep } : l),
    })),
    addLeadNote: (id, body) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id !== id ? l : {
        ...l, notes: body, activity: [{ id: uid(), at: clockNow(), author: 'You', body }, ...list(l.activity)],
      }),
    })),
    patchLead: (id, patch) => {
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) => l.id !== id ? l : {
          ...l,
          ...patch,
          activity: [{ id: uid(), at: clockNow(), author: 'You', body: patch.notes || `Updated ${l.name}.` }, ...list(l.activity)],
        }),
      }));
      flash('Lead updated', 'Household and offer are on this door.');
    },
    ensureCustomer: (incoming) => {
      const email = incoming.email?.trim().toLowerCase();
      const existing = state.customers.find((c) => c.id === incoming.id)
        || (email ? state.customers.find((c) => c.email.toLowerCase() === email) : undefined);
      if (existing) {
        setState((s) => ({
          ...s,
          customers: s.customers.map((c) => c.id === existing.id ? normalizeCustomer({ ...c, ...incoming, id: existing.id }) : c),
        }));
        flash('Customer account ready', `${incoming.email || incoming.name} can sign in at /login`);
        return existing.id;
      }
      const id = incoming.id || `cu_${Date.now()}`;
      const next = normalizeCustomer({ ...incoming, id });
      setState((s) => ({
        ...s,
        customers: [next, ...s.customers],
        activity: [{ id: uid(), at: clockNow(), kind: 'sales', text: `Customer account opened: ${next.name}${next.email ? ` · ${next.email}` : ''}.` }, ...s.activity],
      }));
      flash('Customer account ready', `${incoming.email || incoming.name} can sign in at /login`);
      return id;
    },
    convertLead: (id, opts) => {
      const jobId = `j_${id}`;
      setState((s) => {
        const lead = s.leads.find((l) => l.id === id);
        if (!lead) return s;
        if (s.jobs.some((j) => j.id === jobId)) {
          if (opts?.time) {
            return {
              ...s,
              jobs: s.jobs.map((j) => j.id === jobId ? {
                ...j,
                time: opts.time || j.time,
                service: opts.service || j.service,
                price: opts.price ?? j.price,
                detailer: opts.detailer || j.detailer,
              } : j),
            };
          }
          return s;
        }
        const job: OsJob = normalizeJob({
          id: jobId,
          customer: lead.name,
          email: lead.email || '',
          phone: lead.phone,
          service: opts?.service || lead.service || (lead.value >= 500 ? 'Luxe Ceramic Coating' : 'Luxe Signature'),
          vehicle: lead.vehicle || 'Vehicle TBD',
          address: lead.address,
          time: opts?.time || liveOpenSlots(s.jobs, s.employees, 1)[0]?.window || `${localYmd(new Date(Date.now() + 86400000))} · 10:00 AM`,
          status: 'scheduled',
          detailer: opts?.detailer || 'Marcus Hale',
          price: opts?.price || lead.value || 275,
          payment: 'due',
          internal_notes: `Converted from D2D lead (${lead.rep}). ${lead.notes}`.trim(),
        });
        const extra = fireComms(job, 'scheduled', s.templates);
        const customer: OsCustomer = {
          id: `cu_${id}`, name: lead.name, email: lead.email || '', phone: lead.phone, vehicle: lead.vehicle || 'Vehicle TBD', address: lead.address, member: false, notes: [],
        };
        return {
          ...s,
          jobs: [{ ...job, comms: extra }, ...s.jobs],
          leads: s.leads.map((l) => l.id === id ? { ...l, status: 'sold', temp: 'hot' } : l),
          customers: s.customers.some((c) => c.name === lead.name) ? s.customers : [customer, ...s.customers],
          activity: [{ id: `act_book_${id}`, at: clockNow(), kind: 'sales', text: `Booked ${lead.name} from D2D · ${money(job.price)}.` }, ...s.activity],
        };
      });
      flash('Lead booked', 'Confirmation request sent. The door is on the appointment board.');
      return jobId;
    },
    addCustomerNote: (id, body) => setState((s) => ({
      ...s,
      customers: s.customers.map((c) => c.id !== id ? c : {
        ...c, notes: [{ id: uid(), at: clockNow(), author: 'You', body }, ...list(c.notes)],
      }),
    })),
    moveShift: (shiftId, day) => setState((s) => ({
      ...s,
      shifts: s.shifts.map((sh) => sh.id === shiftId ? { ...sh, day } : sh),
    })),
    addShift: (employeeId, day) => setState((s) => {
      if (s.shifts.some((sh) => sh.employeeId === employeeId && sh.day === day)) return s;
      const emp = s.employees.find((e) => e.id === employeeId);
      return {
        ...s,
        shifts: [...s.shifts, { id: uid(), employeeId, day, start: day === 'Sat' ? '9:00a' : '8:30a', end: day === 'Sat' ? '2:00p' : '5:00p' }],
        activity: [{ id: uid(), at: clockNow(), kind: 'ops', text: `Scheduled ${emp?.name || 'teammate'} on ${day}.` }, ...s.activity],
      };
    }),
    removeShift: (shiftId) => setState((s) => ({ ...s, shifts: s.shifts.filter((sh) => sh.id !== shiftId) })),
    setAvailability: (employeeId, day, on) => setState((s) => ({
      ...s,
      employees: s.employees.map((e) => e.id === employeeId ? { ...e, availability: { ...e.availability, [day]: on } } : e),
    })),
    setTimeOffStatus: (id, status) => setState((s) => ({
      ...s,
      timeOff: s.timeOff.map((t) => t.id === id ? { ...t, status } : t),
    })),
    requestTimeOff: (employeeId, reason) => setState((s) => ({
      ...s,
      timeOff: [{ id: uid(), employeeId, from: 'Sat', to: 'Sun', reason, status: 'pending' }, ...s.timeOff],
    })),
    toggleChecklist: (candidateId, itemId) => setState((s) => ({
      ...s,
      candidates: s.candidates.map((c) => {
        if (c.id !== candidateId) return c;
        const checklist = list(c.checklist).map((i) => i.id === itemId ? { ...i, done: !i.done } : i);
        const progress = checklist.length
          ? Math.round((checklist.filter((i) => i.done).length / checklist.length) * 100)
          : 0;
        const nextOpen = checklist.find((i) => !i.done);
        return { ...c, checklist, progress, stage: nextOpen ? nextOpen.label : 'Ready to start' };
      }),
    })),
    patchTemplate: (id, partial) => setState((s) => ({
      ...s,
      templates: s.templates.map((t) => t.id === id ? { ...t, ...partial } : t),
    })),
    sendTestComm: (templateId, jobId) => {
      const job = state.jobs.find((j) => j.id === jobId) || state.jobs[0];
      const template = state.templates.find((t) => t.id === templateId);
      if (!job || !template) {
        flash('Nothing to send', 'Add a job first, then send a test.');
        return;
      }
      const extra = fireComms(job, job.status, state.templates, template.id).map((row) => ({
        ...row,
        id: `${row.id}_${Date.now()}`,
        name: `Test · ${row.name}`,
      }));
      if (!extra.length) {
        flash('Template is off', 'Enable email or SMS on this template first.');
        return;
      }
      setState((s) => ({
        ...s,
        jobs: s.jobs.map((j) => j.id !== job.id ? j : { ...j, comms: [...extra, ...list(j.comms)] }),
        activity: [{ id: uid(), at: clockNow(), text: `Test ${channelLabel(template)} sent to ${job.customer}: ${template.name}.`, kind: 'comms' }, ...s.activity],
      }));
      flash(`Test ${extra[0].channel.toUpperCase()} sent`, `${job.email || job.customer} · ${extra[0].preview}`);
    },
    saveSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    renameChat: (id, name) => setState((s) => ({
      ...s,
      chats: s.chats.map((c) => c.id === id ? { ...c, name, initials: initialsOf(name) } : c),
    })),
    shareToChat: (chatId, body) => setState((s) => {
      const at = clockNow();
      return {
        ...s,
        chats: s.chats.map((c) => c.id !== chatId ? c : {
          ...c, preview: body, at, unread: 0,
          messages: [...(Array.isArray(c.messages) ? c.messages : []), { id: uid(), from: 'You', mine: true, body, at }],
        }),
      };
    }),
    createJob: (draft) => {
      const id = `j_${Date.now()}`;
      const status = draft.confirm ? 'confirmed' : 'scheduled';
      const job = normalizeJob({
        id,
        customer: draft.customer,
        service: draft.service,
        vehicle: draft.vehicle,
        address: draft.address,
        time: draft.time,
        price: draft.price,
        detailer: draft.detailer,
        phone: draft.phone || '',
        email: draft.email || '',
        status,
        payment: 'due',
      });
      setState((s) => {
        const customer = s.customers.some((c) => c.name === draft.customer) ? null : {
          id: uid(), name: draft.customer, email: draft.email || '', phone: draft.phone || '', vehicle: draft.vehicle,
          address: draft.address, member: false, notes: [],
        };
        const extra = fireComms(job, status, s.templates);
        return {
          ...s,
          jobs: [{ ...job, comms: extra }, ...s.jobs],
          customers: customer ? [customer, ...s.customers] : s.customers,
          activity: [{ id: uid(), at: clockNow(), kind: 'ops', text: `${draft.confirm ? 'Confirmed' : 'Booked'} ${draft.customer} · ${draft.service}.` }, ...s.activity],
        };
      });
      flash(draft.confirm ? 'Appointment confirmed' : 'Confirmation requested', draft.confirm
        ? `${draft.customer} · booking confirmation sent`
        : `${draft.customer} · ask them to confirm ${draft.time}`);
      return id;
    },
    addLead: (name, address, extra) => {
      const id = `l_${Date.now()}`;
      const lead = normalizeLead({ id, name, address, ...extra, status: extra?.status || 'unworked', rep: extra?.rep || 'Unassigned', value: extra?.value ?? 275, phone: extra?.phone || '' });
      setState((s) => ({
        ...s,
        leads: [lead, ...s.leads],
        activity: [{ id: uid(), at: clockNow(), kind: 'sales', text: `New door logged: ${lead.name} · ${lead.address}.` }, ...s.activity],
      }));
      flash('Door added', `${lead.name} is on the pipeline`);
      return id;
    },
    toggleMember: (customerId) => setState((s) => ({
      ...s,
      customers: s.customers.map((c) => c.id === customerId ? { ...c, member: !c.member } : c),
    })),
    rescheduleJob: (id, time) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id === id ? { ...j, time } : j),
    })),
  }), [state, toast, fireComms, flash]);

  return <OsContext.Provider value={api}>{children}</OsContext.Provider>;
}

export function useOs() {
  const ctx = useContext(OsContext);
  if (!ctx) throw new Error('useOs must be inside OsProvider');
  return ctx;
}
