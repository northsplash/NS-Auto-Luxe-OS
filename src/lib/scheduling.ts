import type { Appointment, Employee } from '@/lib/supabase';

export const SLOT_MINUTES = 30;
export const JOB_STATUSES = ['scheduled','confirmed','en_route','arrived','in_progress','completed','cancelled','no_show'] as const;
export const JOB_STATUS_LABELS: Record<string,string> = {
  pending:'Scheduled', scheduled:'Scheduled', confirmed:'Confirmed', en_route:'En Route', arrived:'Arrived', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show'
};

export function roundToSlot(date: Date, step=SLOT_MINUTES){
  const next=new Date(date); next.setSeconds(0,0);
  const m=next.getMinutes(); next.setMinutes(Math.ceil(m/step)*step);
  return next;
}
export function toLocalInput(value?:string|Date|null){
  const d=value instanceof Date?value:value?new Date(value):roundToSlot(new Date());
  const z=(n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
export function appointmentEnd(a:Appointment){
  if(!a.scheduled_at)return null;
  return new Date(new Date(a.scheduled_at).getTime()+Math.max(SLOT_MINUTES,Number(a.estimated_duration_minutes||120))*60000);
}
export function overlaps(a:Appointment,start:Date,durationMinutes:number,ignoreId?:string){
  if(a.id===ignoreId||!a.scheduled_at||['cancelled','no_show'].includes(a.status))return false;
  const aStart=new Date(a.scheduled_at); const aEnd=appointmentEnd(a)!; const end=new Date(start.getTime()+durationMinutes*60000);
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
