import type { OsEmployee, OsJob, Weekday } from './demoData';

export type OpenSlot = {
  id: string;
  weekday: Weekday;
  dateLabel: string;
  time: string;
  window: string;
  tech: string;
};

const TIMES = ['9:00 AM', '11:00 AM', '1:00 PM', '3:30 PM'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function jobTakesSlot(job: OsJob, dayWord: string, weekday: Weekday, time: string) {
  if (job.status === 'completed') return false;
  const stamp = String(job.time || '').toLowerCase();
  const hour = time.replace(' AM', '').replace(' PM', '');
  const sameTime = stamp.includes(hour.toLowerCase()) || stamp.includes(time.toLowerCase());
  if (!sameTime) return false;
  return stamp.includes(dayWord.toLowerCase()) || stamp.includes(weekday.toLowerCase());
}

export function liveOpenSlots(jobs: OsJob[], employees: OsEmployee[], count = 10): OpenSlot[] {
  const techs = employees.filter((e) => e.status === 'active' && (e.role === 'detailer' || e.role === 'manager' || e.role === 'owner'));
  const out: OpenSlot[] = [];
  const start = new Date();
  for (let d = 0; d < 12 && out.length < count; d += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const weekday = DAY_NAMES[date.getDay()] as Weekday;
    if (weekday === 'Sun') continue;
    const available = techs.filter((e) => e.availability?.[weekday]);
    if (!available.length) continue;
    const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dayWord = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : weekday;
    for (const time of TIMES) {
      if (out.length >= count) break;
      const taken = jobs.some((j) => jobTakesSlot(j, dayWord, weekday, time));
      if (taken) continue;
      const tech = available[out.length % available.length];
      out.push({
        id: `${weekday}-${time}-${d}`,
        weekday,
        dateLabel,
        time,
        window: `${dayWord} · ${time}`,
        tech: tech.name,
      });
    }
  }
  return out;
}
