import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CommunicationTemplate } from '@/lib/communicationCatalog';
import { fillTemplate } from '@/lib/communicationCatalog';
import type { EmployeeDraft } from '@/lib/rolePresets';
import { money } from '@/lib/data';
import {
  clockNow, defaultTemplates, initialsOf, seedActivity, seedCandidates, seedChats, seedCustomers,
  seedEmployees, seedJobs, seedLeads, seedPayments, seedSettings, seedShifts, seedTimeOff, uid,
  type JobStatus, type LeadStatus, type OsActivity, type OsCandidate, type OsChat, type OsCustomer,
  type OsEmployee, type OsJob, type OsLead, type OsPayment, type OsSettings, type OsShift,
  type OsTimeOff, type Weekday,
} from './demoData';

const KEY = 'ns-os-v2';

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
    jobs: seedJobs,
    leads: seedLeads,
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

function load(): OsSnapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as { v?: number; data?: Partial<OsSnapshot> };
    if (parsed?.v !== 2 || !parsed.data) return seed();
    return { ...seed(), ...parsed.data };
  } catch {
    return seed();
  }
}

function jobVars(job: OsJob) {
  return {
    customer_first_name: job.customer.split(' ')[0],
    detailer_name: job.detailer.split(' ')[0],
    vehicle: job.vehicle,
    service: job.service,
    appointment_time: job.time,
    price: money(job.price),
    eta: job.eta || 'about 15 minutes',
    portal_link: 'northsplash.com/appointment',
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
  createChat: (name: string, kind: 'dm' | 'space') => string;
  setJobStatus: (id: string, status: JobStatus) => void;
  assignJob: (jobId: string, detailer: string) => void;
  addJobNote: (id: string, body: string) => void;
  addJobPhoto: (id: string, kind: 'before' | 'after') => void;
  setJobNotes: (id: string, internal_notes: string) => void;
  collectJob: (id: string) => void;
  refundPayment: (id: string) => void;
  retryPayment: (id: string) => void;
  setLeadStatus: (id: string, status: LeadStatus) => void;
  assignLead: (id: string, rep: string) => void;
  addLeadNote: (id: string, body: string) => void;
  convertLead: (id: string) => string | null;
  addCustomerNote: (id: string, body: string) => void;
  moveShift: (shiftId: string, day: Weekday) => void;
  addShift: (employeeId: string, day: Weekday) => void;
  removeShift: (shiftId: string) => void;
  setAvailability: (employeeId: string, day: Weekday, on: boolean) => void;
  setTimeOffStatus: (id: string, status: OsTimeOff['status']) => void;
  requestTimeOff: (employeeId: string, reason: string) => void;
  toggleChecklist: (candidateId: string, itemId: string) => void;
  patchTemplate: (id: string, partial: Partial<CommunicationTemplate>) => void;
  saveSettings: (patch: Partial<OsSettings>) => void;
};

const OsContext = createContext<OsApi | null>(null);

export function OsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OsSnapshot>(load);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ v: 2, data: state }));
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
        onboarding: 20,
        location: draft.work_location,
        documents: [
          { id: uid(), name: 'Offer letter', status: 'review' },
          { id: uid(), name: 'I-9', status: 'missing' },
          { id: uid(), name: 'W-4', status: 'missing' },
          { id: uid(), name: 'Handbook', status: 'missing' },
          { id: uid(), name: 'Direct deposit', status: 'missing' },
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
          messages: [{ id: uid(), from: 'You', mine: true, body: `Welcome to North Splash, ${emp.name.split(' ')[0]}.`, at: clockNow() }],
        }, ...s.chats],
        activity: [{ id: uid(), at: clockNow(), text: `Hired ${emp.name} as ${emp.title}.`, kind: 'hire' }, ...s.activity],
      }));
      flash('Employee added', `${emp.name} · ${emp.title}`);
      return emp;
    },
    updateEmployee: (id, patch) => setState((s) => ({
      ...s,
      employees: s.employees.map((e) => e.id === id ? { ...e, ...patch } : e),
    })),
    toggleDocument: (employeeId, docId) => setState((s) => ({
      ...s,
      employees: s.employees.map((e) => {
        if (e.id !== employeeId) return e;
        const documents = e.documents.map((d) => {
          if (d.id !== docId) return d;
          const status: OsEmployee['documents'][number]['status'] = d.status === 'complete' ? 'missing' : d.status === 'review' ? 'complete' : 'review';
          return { ...d, status };
        });
        const onboarding = Math.round((documents.filter((d) => d.status === 'complete').length / documents.length) * 100);
        return { ...e, documents, onboarding };
      }),
    })),
    sendChat: (chatId, body) => setState((s) => ({
      ...s,
      chats: s.chats.map((c) => c.id !== chatId ? c : {
        ...c, preview: body, at: 'Now', unread: 0,
        messages: [...c.messages, { id: uid(), from: 'You', mine: true, body, at: clockNow() }],
      }),
    })),
    markChatRead: (chatId) => setState((s) => ({
      ...s,
      chats: s.chats.map((c) => c.id === chatId ? { ...c, unread: 0 } : c),
    })),
    createChat: (name, kind) => {
      const id = `c_${Date.now()}`;
      const chat: OsChat = {
        id, name, kind, preview: kind === 'space' ? 'Space created' : 'New chat', at: clockNow(), unread: 0,
        initials: initialsOf(name), hue: HUES[0], topic: kind === 'space' ? 'New space' : undefined,
        messages: [{ id: uid(), from: 'You', mine: true, body: kind === 'space' ? `${name} is open.` : 'Started a chat.', at: clockNow() }],
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
        const have = new Set(job.comms.map((c) => c.id));
        const fresh = extra.filter((c) => !have.has(c.id));
        sent = fresh[0];
        const next: OsJob = {
          ...job,
          status,
          eta: status === 'en_route' ? job.eta || '15 min' : job.eta,
          comms: [...fresh, ...job.comms],
        };
        const crew = s.chats.find((c) => c.kind === 'space' && c.name.includes('Crew'));
        const actId = `act_${job.id}_${status}`;
        const activity = s.activity.some((a) => a.id === actId)
          ? s.activity
          : [{
              id: actId, at: clockNow(), kind: 'comms' as const,
              text: `${job.detailer.split(' ')[0]} moved ${job.customer.split(' ')[0]}’s job to ${status.replaceAll('_', ' ')}${fresh[0] ? ` · ${fresh[0].channel.toUpperCase()} sent` : ''}.`,
            }, ...s.activity];
        return {
          ...s,
          jobs: s.jobs.map((j) => j.id === id ? next : j),
          activity,
          chats: crew ? s.chats.map((c) => c.id !== crew.id ? c : {
            ...c, preview: `${job.service} → ${status.replaceAll('_', ' ')}`, at: clockNow(),
            messages: c.messages.some((m) => m.id === `m_${job.id}_${status}`)
              ? c.messages
              : [...c.messages, { id: `m_${job.id}_${status}`, from: 'OS', body: `${job.customer} · ${job.service} is now ${status.replaceAll('_', ' ')}.`, at: clockNow() }],
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
        jobs: s.jobs.map((j) => j.id === jobId ? { ...next, comms: [...extra, ...j.comms] } : j),
        activity: [{ id: uid(), at: clockNow(), kind: 'ops', text: `${job.service} reassigned to ${detailer}.` }, ...s.activity],
      };
    }),
    addJobNote: (id, body) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id !== id ? j : {
        ...j, notes: [{ id: uid(), at: clockNow(), author: 'You', body }, ...j.notes],
      }),
    })),
    addJobPhoto: (id, kind) => setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => j.id !== id ? j : {
        ...j,
        photos: [...j.photos, {
          id: uid(),
          label: kind === 'before' ? `Before · ${j.photos.length + 1}` : `After · ${j.photos.length + 1}`,
          kind,
          src: kind === 'before'
            ? 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&h=420&w=640'
            : 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640',
        }],
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
        return {
          ...s,
          jobs: s.jobs.map((j) => j.id === id ? { ...j, payment: 'paid' as const } : j),
          payments: s.payments.map((p) => p.jobId === id && p.status === 'pending' ? { ...p, status: 'succeeded' as const, at: clockNow(), method: 'Card on file' } : p).concat(
            s.payments.some((p) => p.jobId === id) ? [] : [pay],
          ),
          activity: [{ id: `act_pay_${id}`, at: clockNow(), kind: 'pay', text: `Collected ${money(job.price)} from ${job.customer}.` }, ...s.activity.filter((a) => a.id !== `act_pay_${id}`)],
        };
      });
      flash('Payment collected', 'Card on file captured.');
    },
    refundPayment: (id) => {
      setState((s) => {
        const pay = s.payments.find((p) => p.id === id);
        if (!pay || pay.status === 'refunded') return s;
        return {
          ...s,
          payments: s.payments.map((p) => p.id === id ? { ...p, status: 'refunded' as const } : p),
          jobs: s.jobs.map((j) => j.id === pay.jobId ? { ...j, payment: 'refunded' as const } : j),
          activity: [{ id: `act_ref_${id}`, at: clockNow(), kind: 'pay', text: `Refunded ${money(pay.amount)} to ${pay.customer}.` }, ...s.activity],
        };
      });
      flash('Refunded', 'The transaction was reversed in the ledger.');
    },
    retryPayment: (id) => setState((s) => ({
      ...s,
      payments: s.payments.map((p) => p.id === id ? { ...p, status: 'succeeded', at: clockNow() } : p),
    })),
    setLeadStatus: (id, status) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id !== id ? l : {
        ...l, status, temp: status === 'sold' || status === 'appointment' ? 'hot' : status === 'dnk' ? 'cold' : l.temp,
        activity: [{ id: uid(), at: clockNow(), author: l.rep, body: `Moved to ${status}.` }, ...l.activity],
      }),
      activity: [{ id: uid(), at: clockNow(), kind: 'sales', text: `Lead ${s.leads.find((l) => l.id === id)?.name} → ${status}.` }, ...s.activity],
    })),
    assignLead: (id, rep) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id === id ? { ...l, rep } : l),
    })),
    addLeadNote: (id, body) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => l.id !== id ? l : {
        ...l, notes: body, activity: [{ id: uid(), at: clockNow(), author: 'You', body }, ...l.activity],
      }),
    })),
    convertLead: (id) => {
      const jobId = `j_${id}`;
      setState((s) => {
        const lead = s.leads.find((l) => l.id === id);
        if (!lead) return s;
        if (s.jobs.some((j) => j.id === jobId)) return s;
        const job: OsJob = {
          id: jobId,
          customer: lead.name,
          email: '',
          phone: lead.phone,
          service: lead.value >= 500 ? 'Luxe Ceramic Coating' : 'Luxe Signature Detail',
          vehicle: 'Vehicle TBD',
          address: lead.address,
          time: 'Fri · 11:00 AM',
          status: 'scheduled',
          detailer: 'Marcus Hale',
          price: lead.value || 275,
          payment: 'due',
          internal_notes: `Converted from D2D lead (${lead.rep}). ${lead.notes}`.trim(),
          notes: [],
          photos: [],
          comms: [],
        };
        const customer: OsCustomer = {
          id: `cu_${id}`, name: lead.name, email: '', phone: lead.phone, vehicle: 'Vehicle TBD', address: lead.address, member: false, notes: [],
        };
        return {
          ...s,
          jobs: [job, ...s.jobs],
          leads: s.leads.map((l) => l.id === id ? { ...l, status: 'sold' as const, temp: 'hot' as const } : l),
          customers: s.customers.some((c) => c.name === lead.name) ? s.customers : [customer, ...s.customers],
          activity: [{ id: `act_book_${id}`, at: clockNow(), kind: 'sales', text: `Booked ${lead.name} from D2D · ${money(job.price)}.` }, ...s.activity],
        };
      });
      flash('Lead booked', 'The door is now on the appointment board.');
      return jobId;
    },
    addCustomerNote: (id, body) => setState((s) => ({
      ...s,
      customers: s.customers.map((c) => c.id !== id ? c : {
        ...c, notes: [{ id: uid(), at: clockNow(), author: 'You', body }, ...c.notes],
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
        const checklist = c.checklist.map((i) => i.id === itemId ? { ...i, done: !i.done } : i);
        const progress = Math.round((checklist.filter((i) => i.done).length / checklist.length) * 100);
        const nextOpen = checklist.find((i) => !i.done);
        return { ...c, checklist, progress, stage: nextOpen ? nextOpen.label : 'Ready to start' };
      }),
    })),
    patchTemplate: (id, partial) => setState((s) => ({
      ...s,
      templates: s.templates.map((t) => t.id === id ? { ...t, ...partial } : t),
    })),
    saveSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
  }), [state, toast, fireComms, flash]);

  return <OsContext.Provider value={api}>{children}</OsContext.Provider>;
}

export function useOs() {
  const ctx = useContext(OsContext);
  if (!ctx) throw new Error('useOs must be inside OsProvider');
  return ctx;
}
