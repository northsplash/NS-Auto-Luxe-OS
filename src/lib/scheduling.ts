import type { Appointment, Employee } from '@/lib/supabase';
import {
  appointmentCoord,
  DEFAULT_TRAVEL_BUFFER_MINUTES,
  estimateDriveBuffer,
  type DriveEstimate,
} from '@/lib/driveTime';

export const SLOT_MINUTES = 30;
export const WORK_DAY_START_MINUTES = 7 * 60;
export const WORK_DAY_END_MINUTES = 20 * 60;
export const JOB_STATUSES = ['scheduled','confirmed','en_route','arrived','in_progress','completed','cancelled','no_show'] as const;
export const JOB_STATUS_LABELS: Record<string,string> = {
  pending:'Scheduled', scheduled:'Scheduled', confirmed:'Confirmed', en_route:'En Route', arrived:'Arrived', started:'In Progress', in_progress:'In Progress', finished:'Finished', completed:'Completed', cancelled:'Cancelled', no_show:'No Show'
};

export function roundToSlot(date: Date, step=SLOT_MINUTES){
  const next=new Date(date); next.setSeconds(0,0);
  const m=next.getMinutes();
  if (m % step === 0) return next;
  next.setMinutes(Math.ceil(m/step)*step);
  return next;
}
export function toLocalInput(value?:string|Date|null){
  const d=value instanceof Date?value:value?new Date(value):roundToSlot(new Date());
  const z=(n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
export function jobDurationMinutes(a:Appointment){
  return Math.max(SLOT_MINUTES, Number(a.estimated_duration_minutes || 120));
}
export function travelBufferMinutes(a:Appointment){
  const n = Number(a.travel_buffer_minutes);
  return Number.isFinite(n) ? Math.max(0, n) : DEFAULT_TRAVEL_BUFFER_MINUTES;
}
export function appointmentWorkEnd(a:Appointment){
  if(!a.scheduled_at)return null;
  return new Date(new Date(a.scheduled_at).getTime()+jobDurationMinutes(a)*60000);
}
export function appointmentBusyEnd(a:Appointment){
  if(!a.scheduled_at)return null;
  return new Date(new Date(a.scheduled_at).getTime()+(jobDurationMinutes(a)+travelBufferMinutes(a))*60000);
}
/** Occupied until the job finishes and the tech can reach the next stop. */
export function appointmentEnd(a:Appointment){
  return appointmentBusyEnd(a);
}
export function overlaps(a:Appointment,start:Date,durationMinutes:number,ignoreId?:string){
  if(a.id===ignoreId||!a.scheduled_at||['cancelled','no_show'].includes(a.status))return false;
  const aStart=new Date(a.scheduled_at); const aEnd=appointmentBusyEnd(a)!; const end=new Date(start.getTime()+durationMinutes*60000);
  return start<aEnd&&end>aStart;
}
export function employeeConflicts(appointments:Appointment[],employeeId:string,start:Date,durationMinutes:number,ignoreId?:string){
  return appointments.filter(a=>a.assigned_employee_id===employeeId&&overlaps(a,start,durationMinutes,ignoreId));
}
export function dayKey(v:string|Date){const d=v instanceof Date?v:new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function timeLabel(v:string|Date){return new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
export function dateLabel(v:string|Date){return new Date(v).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}
export function employeeLabel(employees:Employee[],id?:string|null){return employees.find(e=>e.id===id)?.name||'Unassigned'}
export function routeAppointments(appointments:Appointment[]){
  return appointments.filter(a=>a.scheduled_at&&!['cancelled','no_show'].includes(a.status)).sort((a,b)=>new Date(a.scheduled_at!).getTime()-new Date(b.scheduled_at!).getTime());
}

function atMinutes(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

export function activeJobsOnDay(appointments: Appointment[], day: Date, employeeId?: string | null, ignoreId?: string, shopLane = false) {
  const key = dayKey(day);
  return routeAppointments(appointments).filter((a) => {
    if (a.id === ignoreId) return false;
    if (!a.scheduled_at || dayKey(a.scheduled_at) !== key) return false;
    if (shopLane || !employeeId) return true;
    return a.assigned_employee_id === employeeId;
  });
}

export function windowsOverlap(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number) {
  const aEnd = aStart.getTime() + aMinutes * 60000;
  const bEnd = bStart.getTime() + bMinutes * 60000;
  return bStart.getTime() < aEnd && bEnd > aStart.getTime();
}

export function minuteWindowsOverlap(aStart: number, aMinutes: number, bStart: number, bMinutes: number) {
  return aStart < bStart + bMinutes && bStart < aStart + aMinutes;
}

export function previousJobBefore(jobs: Appointment[], start: Date, ignoreId?: string) {
  return jobs.filter((a) => a.id !== ignoreId && a.scheduled_at && new Date(a.scheduled_at) < start).at(-1) || null;
}

export function clockMinutesInZone(iso: string, timeZone = 'America/New_York') {
  if (!iso) return 0;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

export function occupyMinutes(job: Pick<Appointment, 'estimated_duration_minutes' | 'travel_buffer_minutes'> | Record<string, unknown>) {
  const duration = Math.max(SLOT_MINUTES, Number((job as Appointment).estimated_duration_minutes || 120));
  return duration + travelBufferMinutes(job as Appointment);
}

export type AppointmentPlan = {
  start: Date;
  travelBufferMinutes: number;
  inboundMinutes: number;
  drive: DriveEstimate;
  previous: Appointment | null;
  snapped: boolean;
  label: string;
};

export async function planAppointmentTiming(opts: {
  appointments: Appointment[];
  employeeId?: string | null;
  ignoreId?: string;
  durationMinutes: number;
  destination?: { lat?: number | null; lng?: number | null; address?: string | null } | null;
  requestedStart?: Date | null;
  shopLane?: boolean;
  now?: Date;
}): Promise<AppointmentPlan> {
  const duration = Math.max(SLOT_MINUTES, Number(opts.durationMinutes || 120));
  const now = opts.now || new Date();
  const requested = opts.requestedStart && !Number.isNaN(opts.requestedStart.getTime())
    ? roundToSlot(opts.requestedStart)
    : roundToSlot(now);
  const dest = opts.destination || null;
  let previous: Appointment | null = null;
  let drive: DriveEstimate = {
    minutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
    miles: 0,
    source: 'fallback',
    label: `${DEFAULT_TRAVEL_BUFFER_MINUTES} min default buffer`,
  };

  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(requested);
    day.setDate(requested.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    const jobs = activeJobsOnDay(opts.appointments, day, opts.employeeId, opts.ignoreId, Boolean(opts.shopLane || !opts.employeeId));
    let cursor = atMinutes(day, WORK_DAY_START_MINUTES);
    if (dayKey(day) === dayKey(now)) cursor = new Date(Math.max(cursor.getTime(), roundToSlot(now).getTime()));
    if (offset === 0) cursor = new Date(Math.max(cursor.getTime(), requested.getTime()));
    let steps = 0;

    while (cursor.getHours() * 60 + cursor.getMinutes() + duration <= WORK_DAY_END_MINUTES) {
      if (++steps > 48) break;
      previous = previousJobBefore(jobs, cursor, opts.ignoreId);
      if (previous) {
        drive = await estimateDriveBuffer({
          origin: appointmentCoord(previous) || { address: previous.service_address },
          destination: dest,
          departureAt: appointmentWorkEnd(previous) || cursor,
        });
        const ready = new Date(appointmentWorkEnd(previous)!.getTime() + drive.minutes * 60000);
        if (cursor < ready) {
          cursor = roundToSlot(ready);
          continue;
        }
      } else {
        drive = {
          minutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
          miles: 0,
          source: 'fallback',
          label: `${DEFAULT_TRAVEL_BUFFER_MINUTES} min first-job buffer`,
        };
      }

      const conflicts = jobs.filter((a) => overlaps(a, cursor, duration, opts.ignoreId));
      if (conflicts.length) {
        const blocker = conflicts[0];
        cursor = roundToSlot(appointmentBusyEnd(blocker) || new Date(cursor.getTime() + SLOT_MINUTES * 60000));
        continue;
      }

      const following = jobs.find((a) => a.scheduled_at && new Date(a.scheduled_at) >= cursor && a.id !== opts.ignoreId) || null;
      if (following?.scheduled_at) {
        const outbound = await estimateDriveBuffer({
          origin: dest,
          destination: appointmentCoord(following) || { address: following.service_address },
          departureAt: new Date(cursor.getTime() + duration * 60000),
        });
        const leaveBy = new Date(cursor.getTime() + (duration + outbound.minutes) * 60000);
        if (leaveBy > new Date(following.scheduled_at)) {
          cursor = roundToSlot(new Date(Math.max(leaveBy.getTime(), appointmentBusyEnd(following)?.getTime() || 0)));
          continue;
        }
      }

      const inbound = previous ? drive.minutes : DEFAULT_TRAVEL_BUFFER_MINUTES;
      const snapped = cursor.getTime() !== requested.getTime();
      const fromLabel = previous ? `after ${previous.customer_name || previous.service_name} at ${timeLabel(previous.scheduled_at!)}` : 'first job of the day';
      return {
        start: cursor,
        travelBufferMinutes: inbound,
        inboundMinutes: inbound,
        drive: previous ? drive : { minutes: inbound, miles: 0, source: 'fallback', label: `${inbound} min first-job buffer` },
        previous,
        snapped,
        label: previous
          ? `Next open ${timeLabel(cursor)} · ${drive.label} ${fromLabel}.`
          : `Next open ${timeLabel(cursor)} · ${fromLabel}.`,
      };
    }
  }

  return {
    start: requested,
    travelBufferMinutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
    inboundMinutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
    drive,
    previous,
    snapped: false,
    label: `${DEFAULT_TRAVEL_BUFFER_MINUTES} min travel buffer. No open window in the next two weeks.`,
  };
}

export function isOpenJob(a: Pick<Appointment, 'status' | 'archived'>) {
  return !a.archived && !['cancelled', 'completed'].includes(String(a.status || ''));
}

export function isUpcomingJob(a: Pick<Appointment, 'status' | 'archived' | 'scheduled_at'>) {
  if (!isOpenJob(a)) return false;
  if (!a.scheduled_at) return true;
  return new Date(a.scheduled_at).getTime() >= Date.now() - 6 * 3600000;
}

export function appointmentPartyName(
  a: Pick<Appointment, 'customer_name' | 'customer_phone' | 'customer_email' | 'service_address' | 'user_id'>,
  customers: Array<{ id: string; full_name?: string | null }> = [],
) {
  const named = String(a.customer_name || '').trim();
  if (named && !/^customer$/i.test(named)) return named;
  const fromProfile = customers.find((c) => c.id === a.user_id)?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const street = String(a.service_address || '').split(',')[0]?.trim();
  if (street) return street;
  if (a.customer_phone) return a.customer_phone;
  if (a.customer_email) return a.customer_email;
  return 'Guest booking';
}
