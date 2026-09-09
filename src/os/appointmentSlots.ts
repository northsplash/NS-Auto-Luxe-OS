import { minutesForService } from '@/lib/detailCatalog';
import { DEFAULT_TRAVEL_BUFFER_MINUTES } from '@/lib/driveTime';
import type { OsEmployee, OsJob, Weekday } from './demoData';

export type OpenSlot = {
  id: string;
  weekday: Weekday;
  dateLabel: string;
  time: string;
  window: string;
  tech: string;
};

export const APPT_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:30 PM', '4:00 PM'] as const;
/** Featured pitch windows stay sparse. Booking uses the 30-minute field grid. */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatJobWindow(date: Date, time: string) {
  return `${localYmd(date)} · ${time}`;
}

export function clockFromStamp(stamp?: string | null) {
  const value = String(stamp || '');
  return value.includes('·') ? value.split('·')[1].trim() : value.trim();
}

export function dayPartFromStamp(stamp?: string | null) {
  const value = String(stamp || '');
  return value.includes('·') ? value.split('·')[0].trim() : '';
}

export function isTodayStamp(stamp?: string | null) {
  const value = String(stamp || '');
  if (!value) return false;
  if (/\btoday\b/i.test(value)) return true;
  return value.includes(localYmd(new Date()));
}

export function parseClockMinutes(time: string) {
  const raw = String(time || '').trim();
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2]);
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && hour !== 12) hour += 12;
    if (mer === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const military = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (military) return Number(military[1]) * 60 + Number(military[2]);
  return null;
}

export function jobMatchesDay(job: OsJob, date: Date) {
  const stamp = String(job.time || '');
  const iso = localYmd(date);
  if (stamp.includes(iso)) return true;
  const weekday = DAY_NAMES[date.getDay()];
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const aliases: string[] = [weekday];
  if (diff === 0) aliases.push('Today');
  if (diff === 1) aliases.push('Tomorrow');
  if (diff === -1) aliases.push('Yesterday');
  const dayPart = dayPartFromStamp(stamp);
  return aliases.some((alias) => dayPart === alias || dayPart.startsWith(alias));
}

export function jobOccupyMinutes(job: OsJob) {
  return minutesForService(job.service, 120) + DEFAULT_TRAVEL_BUFFER_MINUTES;
}

export function slotConflict(jobs: OsJob[], detailer: string, date: Date, time: string, exceptId?: string, occupyNew = 120 + DEFAULT_TRAVEL_BUFFER_MINUTES) {
  if (!detailer) return false;
  const slotStart = parseClockMinutes(time);
  return jobs.some((job) => {
    if (job.id === exceptId || job.status === 'completed' || job.detailer !== detailer) return false;
    if (!jobMatchesDay(job, date)) return false;
    if (slotStart == null) return clockFromStamp(job.time) === time;
    const jobStart = parseClockMinutes(clockFromStamp(job.time));
    if (jobStart == null) return clockFromStamp(job.time) === time;
    const occupy = jobOccupyMinutes(job);
    return slotStart < jobStart + occupy && slotStart + occupyNew > jobStart;
  });
}

export function liveOpenSlots(jobs: OsJob[], employees: OsEmployee[], count = 10): OpenSlot[] {
  const techs = employees.filter((e) => e.status === 'active' && (e.role === 'detailer' || e.role === 'manager' || e.role === 'owner'));
  const out: OpenSlot[] = [];
  const start = startOfDay(new Date());
  for (let d = 0; d < 14 && out.length < count; d += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const weekday = DAY_NAMES[date.getDay()] as Weekday;
    if (weekday === 'Sun') continue;
    const available = techs.filter((e) => e.availability?.[weekday]);
    if (!available.length) continue;
    const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    for (const time of APPT_SLOTS) {
      if (out.length >= count) break;
      const tech = available.find((e) => !slotConflict(jobs, e.name, date, time));
      if (!tech) continue;
      out.push({
        id: `${localYmd(date)}-${time}`,
        weekday,
        dateLabel,
        time,
        window: formatJobWindow(date, time),
        tech: tech.name,
      });
    }
  }
  return out;
}
