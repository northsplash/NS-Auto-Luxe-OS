import {
  clockFromStamp, isTodayStamp, jobMatchesDay, jobOccupyMinutes, localYmd, parseClockMinutes, slotConflict,
} from '@/os/appointmentSlots';
import type { OsChat, OsEmployee, OsJob, OsLead } from '@/os/demoData';
import { isFollowUpDue } from '@/lib/fieldReview';
import { srStatus } from '@/lib/salesRabbitLeads';

export type InboxKind = 'conflict' | 'assign' | 'collect' | 'follow_up' | 'confirm' | 'message' | 'packet';
export type InboxTarget = 'job' | 'lead' | 'messages' | 'employees' | 'dispatch' | 'pipeline' | 'payments';

export type InboxItem = {
  id: string;
  kind: InboxKind;
  hot: boolean;
  title: string;
  sub: string;
  target: InboxTarget;
  recordId?: string;
};

const KIND_RANK: Record<InboxKind, number> = {
  conflict: 0,
  assign: 1,
  collect: 2,
  follow_up: 3,
  confirm: 4,
  message: 5,
  packet: 6,
};

export const INBOX_KIND_LABEL: Record<InboxKind, string> = {
  conflict: 'Conflict',
  assign: 'Assign',
  collect: 'Collect',
  follow_up: 'Callback',
  confirm: 'Confirm',
  message: 'Message',
  packet: 'Packet',
};

const CLOSED_LEAD = new Set(['sold', 'lost', 'not_interested', 'do_not_knock', 'cancelled', 'customer']);

function jobOpen(job: OsJob) {
  return job.status !== 'completed';
}

function jobUnassigned(job: OsJob) {
  return !job.detailer || job.detailer === 'Unassigned';
}

function inferDate(stamp?: string | null) {
  const value = String(stamp || '');
  const iso = value.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(`${iso[1]}T12:00:00`);
  const day = new Date();
  if (/tomorrow/i.test(value)) {
    day.setDate(day.getDate() + 1);
    return day;
  }
  if (/yesterday/i.test(value)) {
    day.setDate(day.getDate() - 1);
    return day;
  }
  return day;
}

export function jobsOverlap(a: OsJob, b: OsJob) {
  if (a.id === b.id || !a.detailer || a.detailer !== b.detailer) return false;
  if (!jobOpen(a) || !jobOpen(b)) return false;
  const date = inferDate(b.time);
  if (!jobMatchesDay(a, date) && !jobMatchesDay(b, inferDate(a.time))) return false;
  if (!jobMatchesDay(a, date)) return false;
  return slotConflict([a], b.detailer, date, clockFromStamp(b.time), b.id, jobOccupyMinutes(b));
}

export function buildOperatorInbox(input: {
  jobs: OsJob[];
  leads: OsLead[];
  employees: OsEmployee[];
  chats: OsChat[];
  now?: number;
  limit?: number;
}): InboxItem[] {
  const now = input.now ?? Date.now();
  const limit = input.limit ?? 10;
  const items: InboxItem[] = [];
  const open = input.jobs.filter(jobOpen);

  for (let i = 0; i < open.length; i += 1) {
    for (let j = i + 1; j < open.length; j += 1) {
      const a = open[i];
      const b = open[j];
      if (!jobsOverlap(a, b)) continue;
      items.push({
        id: `conflict-${a.id}-${b.id}`,
        kind: 'conflict',
        hot: true,
        title: `${a.detailer} double-booked`,
        sub: `${a.customer} and ${b.customer} overlap`,
        target: 'job',
        recordId: a.id,
      });
    }
  }

  open.filter(jobUnassigned).forEach((job) => {
    items.push({
      id: `assign-${job.id}`,
      kind: 'assign',
      hot: true,
      title: `Assign ${job.customer}`,
      sub: `${clockFromStamp(job.time) || job.time} · ${job.service}`,
      target: 'job',
      recordId: job.id,
    });
  });

  open.filter((job) => job.payment === 'due' && job.status !== 'scheduled').forEach((job) => {
    items.push({
      id: `collect-${job.id}`,
      kind: 'collect',
      hot: true,
      title: `Collect ${job.customer}`,
      sub: `${job.service} · still unpaid`,
      target: 'job',
      recordId: job.id,
    });
  });

  input.leads.filter((lead) => {
    const key = srStatus(lead.status).key;
    if (CLOSED_LEAD.has(key)) return false;
    return isFollowUpDue(lead.follow_up_at, now);
  }).forEach((lead) => {
    items.push({
      id: `follow-${lead.id}`,
      kind: 'follow_up',
      hot: true,
      title: `Callback · ${lead.name}`,
      sub: lead.follow_up_at ? `${lead.address} · ${lead.follow_up_at}` : lead.address,
      target: 'lead',
      recordId: lead.id,
    });
  });

  open.filter((job) => job.status === 'scheduled').forEach((job) => {
    items.push({
      id: `confirm-${job.id}`,
      kind: 'confirm',
      hot: isTodayStamp(job.time) || String(job.time || '').includes(localYmd(new Date())),
      title: `Confirm ${job.customer}`,
      sub: `${clockFromStamp(job.time) || job.time} · window not locked`,
      target: 'job',
      recordId: job.id,
    });
  });

  input.chats.filter((chat) => Number(chat.unread || 0) > 0).forEach((chat) => {
    items.push({
      id: `msg-${chat.id}`,
      kind: 'message',
      hot: Number(chat.unread) > 1,
      title: `${chat.name} · ${chat.unread} unread`,
      sub: chat.preview || 'Open the thread',
      target: 'messages',
      recordId: chat.id,
    });
  });

  input.employees.filter((person) => Number(person.onboarding || 0) < 100 && person.status !== 'inactive').forEach((person) => {
    items.push({
      id: `packet-${person.id}`,
      kind: 'packet',
      hot: Number(person.onboarding || 0) < 70,
      title: `${person.name} packet open`,
      sub: `${person.title} · ${person.onboarding}% complete`,
      target: 'employees',
      recordId: person.id,
    });
  });

  return items
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || Number(b.hot) - Number(a.hot))
    .slice(0, limit);
}

export function inboxSummary(items: InboxItem[]) {
  const hot = items.filter((item) => item.hot).length;
  const next = items[0] || null;
  return { total: items.length, hot, next };
}
