import { useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock3, MapPin,
  MoreHorizontal, Navigation, Route, ShieldAlert, Sparkles, UserCheck, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Appointment, Employee } from '@/lib/supabase';
import { money } from '@/lib/data';
import { dayKey, timeLabel } from '@/lib/scheduling';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import { employeeCanDetail } from '@/lib/workCapabilities';

type Props={employees:Employee[];appointments:Appointment[];setAppointments:React.Dispatch<React.SetStateAction<Appointment[]>>};
type BoardMode='people'|'status'|'timeline';
const ACTIVE=['pending','scheduled','confirmed','en_route','arrived','in_progress'];
const STATUS_COLUMNS=[
  ['unassigned','Unassigned'],['scheduled','Scheduled'],['en_route','En Route'],['arrived','Arrived'],['in_progress','In Progress'],['completed','Completed']
] as const;
const asDate=(v?:string|null)=>v?new Date(v):null;
const duration=(a:Appointment)=>Number(a.estimated_duration_minutes||120);
const buffer=(a:Appointment)=>Number(a.travel_buffer_minutes||30);
const isLive=(a:Appointment)=>['en_route','arrived','in_progress'].includes(a.field_status||a.status);
const jobStatus=(a:Appointment)=>a.status==='completed'?'completed':a.field_status||a.dispatch_status||a.status||'scheduled';
const statusLabel=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function dateInput(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function countScheduleConflicts(rows:Appointment[],employeeId:string){
  const es=rows.filter(j=>j.assigned_employee_id===employeeId&&j.scheduled_at).sort((a,b)=>+new Date(a.scheduled_at!)-+new Date(b.scheduled_at!));
  let c=0;for(let i=1;i<es.length;i++){const prev=es[i-1],cur=es[i];const end=+new Date(prev.scheduled_at!)+(duration(prev)+buffer(prev))*60000;if(end>+new Date(cur.scheduled_at!))c++}return c;
}

export default function DispatchCommandCenter({employees,appointments,setAppointments}:Props){
  const [date,setDate]=useState(dateInput());
  const [mode,setMode]=useState<BoardMode>('people');
  const [selected,setSelected]=useState<Appointment|null>(null);
  const [saving,setSaving]=useState('');
  const detailers=useMemo(()=>employees.filter(e=>e.status!=='inactive'&&employeeCanDetail(e)),[employees]);
  const jobs=useMemo(()=>appointments.filter(a=>a.scheduled_at&&dayKey(a.scheduled_at)===date&&!['cancelled','no_show'].includes(a.status)).sort((a,b)=>+new Date(a.scheduled_at!)-+new Date(b.scheduled_at!)),[appointments,date]);
  const activeJobs=jobs.filter(j=>ACTIVE.includes(j.status)||isLive(j));
  const unassigned=activeJobs.filter(j=>!j.assigned_employee_id);
  const live=jobs.filter(isLive);
  const late=activeJobs.filter(j=>j.scheduled_at&&+new Date(j.scheduled_at)<Date.now()-15*60000&&!['en_route','arrived','in_progress','completed'].includes(jobStatus(j)));
  const revenue=jobs.reduce((n,j)=>n+Number(j.price||0),0);
  const completed=jobs.filter(j=>j.status==='completed').length;
  const totalConflicts=detailers.reduce((n,e)=>n+countScheduleConflicts(jobs,e.id),0);

  const setJob=async(id:string,payload:Record<string,unknown>)=>{
    setSaving(id);
    const {data,error}=await supabase.from('appointments').update(payload).eq('id',id).select().single();
    setSaving('');
    if(error){alert(error.message);return}
    setAppointments(p=>p.map(a=>a.id===id?data:a));
    setSelected(s=>s?.id===id?data:s);
  };
  const assign=(id:string,employeeId:string|null)=>setJob(id,{assigned_employee_id:employeeId,dispatch_status:employeeId?'assigned':'unassigned'});
  const moveStatus=(id:string,status:string)=>{
    const payload:Record<string,unknown>={dispatch_status:status,field_status:status};
    if(status==='completed'){payload.status='completed';payload.completed_at=new Date().toISOString();payload.finished_at=new Date().toISOString()}
    else if(status==='in_progress'){payload.status='in_progress';payload.started_at=new Date().toISOString()}
    else if(status==='en_route')payload.en_route_at=new Date().toISOString();
    else if(status==='arrived')payload.arrived_at=new Date().toISOString();
    return setJob(id,payload);
  };
  const dropAssign=(e:React.DragEvent,employeeId:string|null)=>{e.preventDefault();const id=e.dataTransfer.getData('appointment');if(id)assign(id,employeeId)};
  const dropStatus=(e:React.DragEvent,status:string)=>{e.preventDefault();const id=e.dataTransfer.getData('appointment');if(id)moveStatus(id,status)};
  const dailyMinutes=(employeeId:string)=>jobs.filter(j=>j.assigned_employee_id===employeeId).reduce((n,j)=>n+duration(j)+buffer(j),0);
  const conflictCount=(employeeId:string)=>countScheduleConflicts(jobs,employeeId);
  const statusRows=(status:string)=>status==='unassigned'?jobs.filter(j=>!j.assigned_employee_id&&j.status!=='completed'):jobs.filter(j=>jobStatus(j)===status||(status==='scheduled'&&['pending','confirmed','assigned'].includes(jobStatus(j))));

  const JobCard=({job}:{job:Appointment})=><article draggable onDragStart={e=>e.dataTransfer.setData('appointment',job.id)} onClick={()=>setSelected(job)} className={`dispatch-v16-job ${isLive(job)?'live':''} ${saving===job.id?'saving':''}`}>
    <div className="dispatch-v16-job-top"><span>{timeLabel(job.scheduled_at||'')}</span><b>{money(Number(job.price||0))}</b></div>
    <strong>{job.customer_name||'Customer'}</strong>
    <small>{job.service_name||job.package_name||'Detailing service'}</small>
    <p><MapPin size={13}/>{job.service_address||'Address pending'}</p>
    <div className="dispatch-v16-job-foot"><span>{duration(job)}m + {buffer(job)}m travel</span><i className={`dispatch-state state-${jobStatus(job)}`}>{statusLabel(jobStatus(job))}</i></div>
  </article>;

  return <div className="tab-content dispatch-v16-page">
    <header className="dispatch-v16-header"><div><span className="eyebrow">LIVE OPERATIONS</span><h2>Dispatch Command Center</h2><p>Assign detailers, balance capacity, track job progress and catch problems before they become customer issues.</p></div><div className="dispatch-v16-header-tools"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><div className="dispatch-v16-switch">{(['people','status','timeline'] as BoardMode[]).map(x=><button className={mode===x?'active':''} onClick={()=>setMode(x)} key={x}>{x==='people'?'Team':x==='status'?'Status':'Timeline'}</button>)}</div></div></header>

    <div className="dispatch-v16-kpis">
      <div><CalendarDays/><span>Jobs</span><strong>{jobs.length}</strong><small>{completed} completed</small></div>
      <div className={unassigned.length?'warn':''}><UserCheck/><span>Unassigned</span><strong>{unassigned.length}</strong><small>need a detailer</small></div>
      <div className={live.length?'live':''}><Navigation/><span>Live Jobs</span><strong>{live.length}</strong><small>on the road / working</small></div>
      <div className={late.length?'danger':''}><AlertTriangle/><span>Needs Attention</span><strong>{late.length}</strong><small>late or not started</small></div>
      <div><Sparkles/><span>Scheduled Value</span><strong>{money(revenue)}</strong><small>{jobs.length?money(revenue/jobs.length):'$0'} avg ticket</small></div>
    </div>

    {(late.length>0||unassigned.length>0||totalConflicts>0)&&<div className="dispatch-v16-alertbar">
      <ShieldAlert/><strong>Dispatch attention:</strong>
      {unassigned.length>0&&<span>{unassigned.length} unassigned</span>}
      {late.length>0&&<span>{late.length} running late</span>}
      {totalConflicts>0&&<span>schedule conflicts detected</span>}
    </div>}

    {mode==='people'&&<div className="dispatch-v16-people-board">
      <section className="dispatch-v16-person unassigned" onDragOver={e=>e.preventDefault()} onDrop={e=>dropAssign(e,null)}><header><div><span className="dispatch-avatar">?</span><div><strong>Unassigned</strong><small>Jobs waiting for dispatch</small></div></div><b>{unassigned.length}</b></header><div>{unassigned.map(j=><JobCard job={j} key={j.id}/>)}{!unassigned.length&&<div className="dispatch-drop-empty"><CheckCircle2/><span>Everything is assigned</span></div>}</div></section>
      {detailers.map(emp=>{const empJobs=jobs.filter(j=>j.assigned_employee_id===emp.id);const mins=dailyMinutes(emp.id);const max=Number((emp as any).max_daily_hours||9)*60;const conflicts=conflictCount(emp.id);return <section key={emp.id} className={`dispatch-v16-person ${conflicts?'has-conflict':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>dropAssign(e,emp.id)}><header><div><EmployeeAvatar employee={emp} size="sm" className="dispatch-avatar v23-dispatch-avatar"/><div><strong>{emp.name}</strong><small>{emp.title||'Detailer'} · {Math.round(mins/60*10)/10}h / {Math.round(max/60)}h</small></div></div><b>{empJobs.length}</b></header><div className="dispatch-capacity"><i style={{width:`${Math.min(100,mins/max*100)}%`}}/><span>{Math.round(mins/max*100)||0}% capacity</span>{conflicts>0&&<em><ShieldAlert size={12}/>{conflicts} conflict{conflicts===1?'':'s'}</em>}</div><div>{empJobs.map(j=><JobCard job={j} key={j.id}/>)}{!empJobs.length&&<div className="dispatch-drop-empty"><Users/><span>Drop a job here</span></div>}</div></section>})}
    </div>}

    {mode==='status'&&<div className="dispatch-v16-status-board">{STATUS_COLUMNS.map(([id,label])=>{const rows=statusRows(id);return <section key={id} onDragOver={e=>e.preventDefault()} onDrop={e=>dropStatus(e,id)}><header><strong>{label}</strong><b>{rows.length}</b></header><div>{rows.map(j=><JobCard job={j} key={j.id}/>)}</div></section>})}</div>}

    {mode==='timeline'&&<div className="dispatch-v16-timeline"><div className="dispatch-v16-time-head"><span>Team</span>{Array.from({length:17},(_,i)=>i+6).map(h=><span key={h}>{new Date(`2026-01-01T${String(h).padStart(2,'0')}:00`).toLocaleTimeString([],{hour:'numeric'})}</span>)}</div>{detailers.map(emp=><div className="dispatch-v16-time-row" key={emp.id}><div><strong>{emp.name}</strong><small>{conflictCount(emp.id)?`${conflictCount(emp.id)} conflict`:'Clear'}</small></div><div className="dispatch-v16-time-track">{jobs.filter(j=>j.assigned_employee_id===emp.id&&j.scheduled_at).map(j=>{const d=asDate(j.scheduled_at)!;const start=((d.getHours()+d.getMinutes()/60)-6)/17*100;const width=Math.max(3,duration(j)/60/17*100);return <button key={j.id} onClick={()=>setSelected(j)} className={`timeline-job state-${jobStatus(j)}`} style={{left:`${Math.max(0,start)}%`,width:`${Math.min(100-Math.max(0,start),width)}%`}}><span>{timeLabel(j.scheduled_at!)}</span><b>{j.customer_name||j.service_name}</b></button>})}</div></div>)}</div>}

    {selected&&<div className="dispatch-v16-drawer-backdrop" onClick={()=>setSelected(null)}><aside className="dispatch-v16-drawer" onClick={e=>e.stopPropagation()}><div className="dispatch-v16-drawer-head"><div><span className="eyebrow">JOB CONTROL</span><h3>{selected.customer_name||'Customer'}</h3><p>{selected.service_name} · {money(Number(selected.price||0))}</p></div><button onClick={()=>setSelected(null)}>×</button></div><div className="dispatch-v16-detail-grid"><div><span>Scheduled</span><strong>{selected.scheduled_at?new Date(selected.scheduled_at).toLocaleString():'—'}</strong></div><div><span>Duration</span><strong>{duration(selected)} min</strong></div><div><span>Payment</span><strong>{statusLabel(selected.payment_status||'unpaid')}</strong></div><div><span>Status</span><strong>{statusLabel(jobStatus(selected))}</strong></div></div><div className="dispatch-v16-address"><MapPin/><div><strong>{selected.service_address||'Address pending'}</strong><small>{selected.vehicle_info||'Vehicle not listed'}</small></div></div><label className="dispatch-v16-field"><span>Assigned detailer</span><select value={selected.assigned_employee_id||''} onChange={e=>assign(selected.id,e.target.value||null)}><option value="">Unassigned</option>{detailers.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label className="dispatch-v16-field"><span>Operational status</span><select value={jobStatus(selected)} onChange={e=>moveStatus(selected.id,e.target.value)}><option value="scheduled">Scheduled</option><option value="en_route">En Route</option><option value="arrived">Arrived</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label>{selected.notes&&<div className="dispatch-v16-notes"><strong>Customer notes</strong><p>{selected.notes}</p></div>}{selected.internal_notes&&<div className="dispatch-v16-notes internal"><strong>Internal notes</strong><p>{selected.internal_notes}</p></div>}<div className="dispatch-v16-drawer-actions">{selected.service_address&&<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.service_address)}`}><Route/>Map</a>}<button onClick={()=>setSelected(null)}>Done<ChevronRight/></button></div></aside></div>}
  </div>
}
