import { useEffect, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, Bell, BookOpen, CalendarClock, CheckCircle2, ChevronRight, Clock3, Copy, DollarSign,
  GraduationCap, MapPinned, Mail, MapPin, Pause, Pencil, Play, Plus, Route,
  Save, Search, ShieldAlert, Target, Trash2, UserCheck, Users, XCircle,
  Eye, Smartphone, Send, Receipt, RefreshCw, MessageSquare, UserRound
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { firstWord, isSettledPayment, money, prettyLabel, trendLabel } from '@/lib/data';
import { localDateKey, percent, sameLocalDay } from '@/lib/fieldOps';
import { fetchTerritoryHouses, parseBbox, pointInPolygon } from '@/lib/territoryHouses';
import type { Appointment, Employee, LeadTerritory, Profile, TerritoryDoor } from '@/lib/supabase';
import OwnerLeadPipeline from '@/components/OwnerLeadPipeline';
import WorkspaceHero from '@/components/WorkspaceHero';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import { applyNewHireAcademy, ACADEMY_COURSES } from '@/lib/trainingAcademy';
import { canCollectJob } from '@/lib/collectPayment';
import { hiredCrew } from '@/lib/ownerFieldMode';
import { leadAssignableEmployees, leadRepLabel, selfEmployeeForUser } from '@/lib/workCapabilities';
import { useAuth } from '@/hooks/useAuth';
import { appointmentPartyName } from '@/lib/scheduling';
import { setOwnerBoardFilter, setOwnerFocusJob } from '@/lib/ownerJump';
import { isHirePacketOpen } from '@/lib/onboarding';
import { BRAND_LOCKUP } from '@/lib/brand';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';
import TerritoryStreetView from '@/components/TerritoryStreetView';
import DispatchCommandCenter from '@/components/DispatchCommandCenter';
import FieldContactBar from '@/components/FieldContactBar';
import ClientPhotosSection from '@/components/ClientPhotosSection';

type Section = 'command_center'|'crm'|'dispatch'|'crews'|'leads'|'territories'|'training'|'communications'|'automations';
type Props = {
  section: Section;
  employees: Employee[];
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  customers: Profile[];
  payments: any[];
  onNavigate?: (view: string) => void;
  ownerName?: string;
};

type TerritoryForm = { id?:string; name:string; assigned_employee_id:string; status:string; notes:string; color:string; points:[number,number][] };
const emptyTerritory = ():TerritoryForm => ({ name:'',assigned_employee_id:'',status:'active',notes:'',color:'#9d7651',points:[] });
const dateKey = (d: Date | string = new Date()) => localDateKey(d) || localDateKey();
const humanStatus=(s?:string|null)=>prettyLabel(s).replace(/\b\w/g,c=>c.toUpperCase());
const time=(v?:string|null)=>v?new Date(v).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'—';
const when=(v?:string|null)=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';

function Header({tab, action}:{tab:string;action?:React.ReactNode}){
  return <WorkspaceHero tab={tab} actions={action} />;
}
function KPI({label,value,detail,onOpen}:{label:string;value:string;detail?:string;onOpen?:()=>void}){
  const body=<><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</>;
  if(!onOpen) return <div className="phase-kpi">{body}</div>;
  return <button type="button" className="phase-kpi nsos-kpi-link" onClick={onOpen}>{body}</button>;
}

export default function Phase300Suite({section,employees,appointments,setAppointments,customers,payments,onNavigate,ownerName}:Props){
  if(section==='territories') return <TerritoryCenter employees={employees}/>;
  if(section==='leads') return <OwnerLeadPipeline employees={employees} setAppointments={setAppointments} onNavigate={onNavigate}/>;
  if(section==='training') return <TrainingCenter employees={employees}/>;
  if(section==='communications') return <CommunicationsCenter/>;
  if(section==='automations') return <AutomationCenter/>;
  if(section==='crm') return <CRMCenter customers={customers} appointments={appointments}/>;
  if(section==='dispatch') return <DispatchCenter employees={employees} appointments={appointments} setAppointments={setAppointments}/>;
  if(section==='crews') return <CrewCommandCenter employees={employees} appointments={appointments}/>;
  return <CommandCenter employees={employees} appointments={appointments} customers={customers} payments={payments} onNavigate={onNavigate} ownerName={ownerName}/>;
}


function CrewCommandCenter({employees,appointments}:{employees:Employee[];appointments:Appointment[]}){
  const [crews,setCrews]=useState<any[]>([]),[history,setHistory]=useState<any[]>([]),[doorHistory,setDoorHistory]=useState<any[]>([]),[sales,setSales]=useState<any[]>([]),[locations,setLocations]=useState<any[]>([]),[timeEntries,setTimeEntries]=useState<any[]>([]),[alerts,setAlerts]=useState<any[]>([]),[closeouts,setCloseouts]=useState<any[]>([]);
  const [selected,setSelected]=useState<string>(''),[detail,setDetail]=useState<string>(''),[range,setRange]=useState<'today'|'week'|'month'>('today');
  const [newCrew,setNewCrew]=useState({name:'',crew_type:'d2d',manager_employee_id:''});
  const [coach,setCoach]=useState('');
  const managers=employees.filter(e=>e.status==='active'&&e.role==='manager');
  const load=async()=>{const [c,h,d,s,l,t,a,cl]=await Promise.all([
    supabase.from('crew_groups').select('*').order('name'),supabase.from('crew_membership_history').select('*').order('started_at',{ascending:false}).limit(1000),supabase.from('territory_door_history').select('*').order('created_at',{ascending:false}).limit(15000),supabase.from('sales_records').select('*').order('sold_at',{ascending:false}).limit(3000),supabase.from('rep_locations').select('*').order('captured_at',{ascending:false}).limit(3000),supabase.from('time_entries').select('*').order('clock_in',{ascending:false}).limit(3000),supabase.from('crew_alerts').select('*').eq('status','open').order('created_at',{ascending:false}).limit(300),supabase.from('crew_daily_closeouts').select('*').order('work_date',{ascending:false}).limit(300)
  ]);setCrews(c.data??[]);setHistory(h.data??[]);setDoorHistory(d.data??[]);setSales(s.data??[]);setLocations(l.data??[]);setTimeEntries(t.data??[]);setAlerts(a.data??[]);setCloseouts(cl.data??[])};
  useEffect(()=>{load()},[]);
  const activeMembers=(crew:any)=>employees.filter(e=>e.status==='active'&&(e.department||'')===`crew:${crew.id}`);
  const since=()=>{const d=new Date();if(range==='today')d.setHours(0,0,0,0);if(range==='week')d.setDate(d.getDate()-7);if(range==='month')d.setDate(d.getDate()-30);return d.getTime()};
  const createCrew=async(e:React.FormEvent)=>{e.preventDefault();const {error}=await supabase.from('crew_groups').insert({...newCrew,manager_employee_id:newCrew.manager_employee_id||null});if(error)return alert(error.message);setNewCrew({name:'',crew_type:'d2d',manager_employee_id:''});load()};
  const assign=async(employeeId:string,crew:any)=>{const emp=employees.find(e=>e.id===employeeId);if(!emp)return;const dept=emp.department||'';const oldCrew=dept.startsWith('crew:')?dept.slice(5):null;const {error}=await supabase.from('employees').update({department:`crew:${crew.id}`,manager_employee_id:crew.manager_employee_id||null}).eq('id',employeeId);if(error)return alert(error.message);await supabase.from('crew_membership_history').insert({crew_id:crew.id,employee_id:employeeId,manager_employee_id:crew.manager_employee_id||null,previous_crew_id:oldCrew,change_type:oldCrew?'transfer':'assigned'});await load()};
  const removeMember=async(emp:Employee,crew:any)=>{await supabase.from('employees').update({department:null,manager_employee_id:null}).eq('id',emp.id);await supabase.from('crew_membership_history').insert({crew_id:crew.id,employee_id:emp.id,manager_employee_id:crew.manager_employee_id||null,change_type:'removed',ended_at:new Date().toISOString()});await load()};
  const currentStatus=(emp:Employee)=>{const open=timeEntries.find(t=>t.employee_id===emp.id&&!t.clock_out);if(!open)return'Offline';const last=locations.find(l=>l.employee_id===emp.id);if(last&&Date.now()-new Date(last.captured_at).getTime()<10*60000)return'Working';return'Clocked In'};
  const d2dStats=(emp:Employee)=>{const all=doorHistory.filter(h=>h.employee_id===emp.id&&new Date(h.created_at).getTime()>=since());const today=doorHistory.filter(h=>h.employee_id===emp.id&&sameLocalDay(h.created_at));const sorted=[...today].sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at));const gaps=sorted.slice(1).map((x,i)=>(+new Date(x.created_at)-+new Date(sorted[i].created_at))/60000).filter(n=>n>=0&&n<180);const avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:0;const contacts=all.filter(h=>['contacted','interested','follow_up','estimate','appointment_set','sold','customer'].includes(h.new_status)).length;const appts=all.filter(h=>h.new_status==='appointment_set').length;const sold=all.filter(h=>['sold','customer'].includes(h.new_status)).length;const repSales=sales.filter(x=>x.employee_id===emp.id&&new Date(x.sold_at).getTime()>=since()&&x.status==='completed');const revenue=repSales.reduce((n,x)=>n+Number(x.sale_amount||0),0);const last=sorted.at(-1)?.created_at||doorHistory.find(h=>h.employee_id===emp.id)?.created_at;return{doors:all.length,today:today.length,last,avg,contacts,appts,sold,revenue,contactRate:percent(contacts,all.length),apptRate:percent(appts,contacts),revenuePerDoor:all.length?revenue/all.length:0}};
  const detailerStats=(emp:Employee)=>{const jobs=appointments.filter(a=>a.assigned_employee_id===emp.id);const period=jobs.filter(a=>new Date(a.scheduled_at||a.created_at).getTime()>=since());const completed=period.filter(a=>a.status==='completed'||a.finished_at);const today=jobs.filter(a=>sameLocalDay(a.scheduled_at));const lastStart=[...jobs].filter(a=>a.started_at).sort((a,b)=>+new Date(b.started_at!)-+new Date(a.started_at!))[0]?.started_at;const lastFinish=[...jobs].filter(a=>a.finished_at).sort((a,b)=>+new Date(b.finished_at!)-+new Date(a.finished_at!))[0]?.finished_at;const durations=completed.filter(a=>a.started_at&&a.finished_at).map(a=>(+new Date(a.finished_at!)-+new Date(a.started_at!))/60000).filter(n=>n>0&&n<900);const revenue=completed.reduce((n,a)=>n+Number(a.price||0),0);const qcPassed=completed.filter(a=>a.qc_status==='passed').length,reworks=period.filter(a=>a.qc_status==='rework'||a.field_status==='rework').length;const arrived=period.filter(a=>a.arrived_at&&a.scheduled_at);const onTime=arrived.filter(a=>+new Date(a.arrived_at!)<=+new Date(a.scheduled_at!)+10*60000).length;return{total:completed.length,today:today.length,lastStart,lastFinish,avg:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0,revenue,qcPassed,reworks,onTime:percent(onTime,arrived.length),jobs:period.length}};
  const chosen=crews.find(c=>c.id===selected);const member=employees.find(e=>e.id===detail);
  const chosenMembers=chosen?activeMembers(chosen):[];
  const crewAlerts=chosen?alerts.filter(a=>a.crew_id===chosen.id||chosenMembers.some(m=>m.id===a.employee_id)):alerts;
  const saveGoals=async(crew:any,patch:any)=>{const {error}=await supabase.from('crew_groups').update(patch).eq('id',crew.id);if(error)return alert(error.message);setCrews(p=>p.map(c=>c.id===crew.id?{...c,...patch}:c))};
  const addCoach=async()=>{if(!member||!coach.trim())return;const {error}=await supabase.from('crew_coaching_notes').insert({employee_id:member.id,manager_employee_id:chosen?.manager_employee_id||null,note:coach.trim()});if(error)return alert(error.message);setCoach('');alert('Coaching note saved.')};
  const deleteCrew=async(crew:any)=>{if(!confirm(`Permanently delete ${crew.name}? Members will be unassigned first.`))return;const members=activeMembers(crew);if(members.length)await supabase.from('employees').update({department:null,manager_employee_id:null}).in('id',members.map(m=>m.id));const {error}=await supabase.from('crew_groups').delete().eq('id',crew.id);if(error)return alert(error.message);setSelected('');setDetail('');await load()};
  const saveCloseout=async()=>{if(!chosen)return;const {error}=await supabase.from('crew_daily_closeouts').upsert({crew_id:chosen.id,manager_employee_id:chosen.manager_employee_id||null,work_date:dateKey(),attendance_reviewed:true,performance_reviewed:true,tomorrow_reviewed:true,notes:'Daily closeout completed in Crew Command.'},{onConflict:'crew_id,work_date'});if(error)return alert(error.message);await load();alert('Daily crew closeout saved.')};
  return <div className="tab-content phase300 v2-page"><Header tab="crews" action={<div className="segmented-control"><button className={range==='today'?'active':''} onClick={()=>setRange('today')}>Today</button><button className={range==='week'?'active':''} onClick={()=>setRange('week')}>7 Days</button><button className={range==='month'?'active':''} onClick={()=>setRange('month')}>30 Days</button></div>}/>
    <div className="phase-kpi-row"><KPI label="Active Crews" value={String(crews.filter(c=>c.status!=='inactive').length)}/><KPI label="Managers" value={String(managers.length)}/><KPI label="D2D Reps" value={String(employees.filter(e=>e.status==='active'&&e.role==='d2d_agent').length)}/><KPI label="Detailers" value={String(employees.filter(e=>e.status==='active'&&e.role==='detailer').length)}/><KPI label="Open Alerts" value={String(alerts.length)}/></div>
    <div className="crew-command-grid"><form className="phase-panel caramel" onSubmit={createCrew}><span className="eyebrow">CREW SETUP</span><h3>Create Crew</h3><input required placeholder="Crew name" value={newCrew.name} onChange={e=>setNewCrew(p=>({...p,name:e.target.value}))}/><label>Type<select value={newCrew.crew_type} onChange={e=>setNewCrew(p=>({...p,crew_type:e.target.value}))}><option value="d2d">D2D Sales</option><option value="detail">Detailing</option><option value="mixed">Mixed</option></select></label><label>Manager<select value={newCrew.manager_employee_id} onChange={e=>setNewCrew(p=>({...p,manager_employee_id:e.target.value}))}><option value="">Unassigned</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><button className="btn-primary"><Plus size={15}/>Create Crew</button></form>
    <section className="crew-list">{crews.map(c=>{const members=activeMembers(c),open=alerts.filter(a=>a.crew_id===c.id||members.some(m=>m.id===a.employee_id)).length;return <button key={c.id} className={`crew-card ${selected===c.id?'selected':''}`} onClick={()=>{setSelected(c.id);setDetail('')}}><div><span className="eyebrow">{humanStatus(c.crew_type||'crew')}</span><h3>{c.name}</h3><p>{managers.find(m=>m.id===c.manager_employee_id)?.name||'No manager'} · {members.length} members</p></div><div className="crew-card-count"><strong>{members.length}</strong>{open>0&&<small>{open} alert{open===1?'':'s'}</small>}</div></button>})}</section></div>
    {chosen&&<><section className="phase-panel crew-roster"><div className="phase-panel-head"><div><span className="eyebrow">{chosen.name}</span><h3>Roster & Live Performance</h3></div><div className="crew-roster-actions"><select defaultValue="" onChange={e=>{if(e.target.value)assign(e.target.value,chosen);e.currentTarget.value=''}}><option value="">+ Assign employee</option>{employees.filter(e=>e.status==='active'&&!activeMembers(chosen).some(m=>m.id===e.id)&&(['mixed',e.role==='d2d_agent'?'d2d':e.role==='detailer'?'detail':'other'].includes(chosen.crew_type))).map(e=><option value={e.id} key={e.id}>{e.name} · {humanStatus(e.role)}</option>)}</select><button className="btn-outline" onClick={saveCloseout}>Daily Closeout</button><button className="danger-button" onClick={()=>deleteCrew(chosen)}><Trash2 size={14}/>Delete Crew</button></div></div>
      <div className="crew-goal-strip"><label>Doors Goal<input type="number" value={chosen.daily_door_goal||0} onChange={e=>saveGoals(chosen,{daily_door_goal:Number(e.target.value)})}/></label><label>Appointments Goal<input type="number" value={chosen.daily_appointment_goal||0} onChange={e=>saveGoals(chosen,{daily_appointment_goal:Number(e.target.value)})}/></label><label>Revenue Goal<input type="number" value={chosen.daily_revenue_goal||0} onChange={e=>saveGoals(chosen,{daily_revenue_goal:Number(e.target.value)})}/></label><label>Jobs Goal<input type="number" value={chosen.daily_job_goal||0} onChange={e=>saveGoals(chosen,{daily_job_goal:Number(e.target.value)})}/></label></div>
      <div className="crew-member-grid">{chosenMembers.map(emp=>{const d=emp.role==='d2d_agent'?d2dStats(emp):null;const j=emp.role==='detailer'?detailerStats(emp):null;return <article className="crew-member-card" key={emp.id} onClick={()=>setDetail(emp.id)}><div className="crew-member-head"><EmployeeAvatar employee={emp} size="lg"/><div><strong>{emp.name}</strong><small>{humanStatus(emp.role)} · L{emp.employment_level||1}</small></div><span className={`status-lozenge status-${currentStatus(emp).toLowerCase().replace(' ','-')}`}>{currentStatus(emp)}</span></div>{d&&<div className="crew-metrics"><span><b>{d.doors}</b> doors</span><span><b>{time(d.last)}</b> last knock</span><span><b>{Math.round(d.avg)}m</b> avg gap</span><span><b>{d.contactRate}%</b> contact</span><span><b>{d.apptRate}%</b> appt</span><span><b>{money(d.revenue)}</b> revenue</span></div>}{j&&<div className="crew-metrics"><span><b>{j.total}</b> completed</span><span><b>{time(j.lastStart)}</b> last start</span><span><b>{time(j.lastFinish)}</b> last finish</span><span><b>{Math.round(j.avg)}m</b> avg job</span><span><b>{j.onTime}%</b> on time</span><span><b>{money(j.revenue)}</b> revenue</span></div>}<button className="btn-sm btn-outline" onClick={e=>{e.stopPropagation();removeMember(emp,chosen)}}>Remove</button></article>})}</div></section>
      {crewAlerts.length>0&&<section className="phase-panel"><div className="phase-panel-head"><div><span className="eyebrow">MANAGER ATTENTION</span><h3>Open Crew Alerts</h3></div><strong>{crewAlerts.length}</strong></div>{crewAlerts.slice(0,12).map(a=><div className="comm-log-row" key={a.id}><span className={a.severity==='critical'?'warning':''}>{humanStatus(a.severity||'info')}</span><strong>{a.title}</strong><span>{a.message||'Needs review'}</span><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('crew_alerts').update({status:'resolved',resolved_at:new Date().toISOString()}).eq('id',a.id);load()}}>Resolve</button></div>)}</section>}</>}
    {member&&<section className="phase-panel crew-drilldown"><div className="phase-panel-head"><div><span className="eyebrow">EMPLOYEE DRILL-DOWN</span><h3>{member.name}</h3><p>{humanStatus(member.role)} · {currentStatus(member)}</p></div><button className="icon-btn" onClick={()=>setDetail('')}><XCircle size={18}/></button></div>{member.role==='d2d_agent'?<D2DDrill stats={d2dStats(member)} history={doorHistory.filter(h=>h.employee_id===member.id).slice(0,30)}/>:<DetailerDrill stats={detailerStats(member)} jobs={appointments.filter(a=>a.assigned_employee_id===member.id).slice(0,30)}/>}<div className="coaching-box"><textarea placeholder="Private manager coaching note…" value={coach} onChange={e=>setCoach(e.target.value)}/><button className="btn-primary" onClick={addCoach}>Save Coaching Note</button></div></section>}
  </div>;
}
function D2DDrill({stats,history}:{stats:any;history:any[]}){return <><div className="phase-kpi-row"><KPI label="Doors" value={String(stats.doors)}/><KPI label="Last Knock" value={time(stats.last)}/><KPI label="Avg Between" value={`${Math.round(stats.avg)} min`}/><KPI label="Contact Rate" value={`${stats.contactRate}%`}/><KPI label="Appointment Rate" value={`${stats.apptRate}%`}/><KPI label="Revenue / Door" value={money(stats.revenuePerDoor)}/></div><h4>Recent knock activity</h4>{history.map(h=><div className="comm-log-row" key={h.id}><span>{humanStatus(h.new_status||'')}</span><strong>{when(h.created_at)}</strong><span>{h.notes||'Door update'}</span></div>)}</>}
function DetailerDrill({stats,jobs}:{stats:any;jobs:Appointment[]}){return <><div className="phase-kpi-row"><KPI label="Completed" value={String(stats.total)}/><KPI label="Last Start" value={time(stats.lastStart)}/><KPI label="Last Finish" value={time(stats.lastFinish)}/><KPI label="Avg Detail" value={`${Math.round(stats.avg)} min`}/><KPI label="On Time" value={`${stats.onTime}%`}/><KPI label="Revenue" value={money(stats.revenue)}/></div><div className="phase-kpi-row compact-kpis"><KPI label="QC Passed" value={String(stats.qcPassed)}/><KPI label="Reworks" value={String(stats.reworks)}/><KPI label="Jobs in Range" value={String(stats.jobs)}/></div><h4>Recent details</h4>{jobs.map(j=><div className="comm-log-row" key={j.id}><span>{humanStatus(j.field_status||j.status)}</span><strong>{j.service_name}</strong><span>{appointmentPartyName(j)}</span><small>{when(j.scheduled_at)}</small></div>)}</>}


async function fetchTerritoryHouseData(bbox:string,points?:[number,number][]){
  return fetchTerritoryHouses({...parseBbox(bbox),points});
}

function TerritoryCenter({employees}:{employees:Employee[]}){
  const {user,profile}=useAuth();
  const self=selfEmployeeForUser(employees,user?.id,user?.email||profile?.email);
  const reps=leadAssignableEmployees(employees);
  const [territories,setTerritories]=useState<LeadTerritory[]>([]);
  const [doors,setDoors]=useState<TerritoryDoor[]>([]);
  const [form,setForm]=useState<TerritoryForm>(emptyTerritory());
  const [selected,setSelected]=useState<string>('');
  const [busy,setBusy]=useState(false);
  const [query,setQuery]=useState('');
  const [preview,setPreview]=useState<{houses:number;streets:number;streetNames:string[];properties:{address:string|null;latitude:number;longitude:number;status:string;source:string}[]}|null>(null);
  const [streetViewHouse,setStreetViewHouse]=useState<any>(null);
  const [previewBusy,setPreviewBusy]=useState(false);
  const [loadError,setLoadError]=useState('');

  const load=async()=>{
    try {
      const [t,d]=await Promise.all([
        supabase.from('lead_territories').select('*').order('priority',{ascending:false}).order('name'),
        supabase.from('territory_doors').select('*').order('created_at',{ascending:false}).limit(10000),
      ]);
      if(t.error) throw t.error;
      if(d.error) throw d.error;
      setTerritories((t.data??[]) as LeadTerritory[]);
      setDoors((d.data??[]) as TerritoryDoor[]);
      setLoadError('');
    } catch (err:any) {
      setLoadError(err?.message || 'Unable to load territories.');
    }
  };
  useEffect(()=>{load()},[]);
  const selectedTerritory=territories.find(t=>t.id===selected);
  const selectedTerritoryDoors=selected?doors.filter(d=>d.territory_id===selected):[];
  const stats=(tid:string)=>{
    const ds=doors.filter(d=>d.territory_id===tid);
    const worked=ds.filter(d=>!['unworked','new'].includes(d.status)).length;
    const remaining=Math.max(0,ds.length-worked);
    const contacted=ds.filter(d=>['contacted','interested','follow_up','estimate','appointment_set','sold','customer','not_interested'].includes(d.status)).length;
    const interested=ds.filter(d=>d.status==='interested').length;
    const followUps=ds.filter(d=>['follow_up','revisit'].includes(d.status)).length;
    const estimates=ds.filter(d=>d.status==='estimate').length;
    const appointments=ds.filter(d=>d.status==='appointment_set').length;
    const sold=ds.filter(d=>['sold','customer','existing_customer'].includes(d.status)).length;
    return{total:ds.length,worked,remaining,contacted,interested,followUps,estimates,appointments,sold,pct:percent(worked,ds.length),conversion:percent(sold,Math.max(contacted,1))};
  };
  const beginNew=()=>{setSelected('');setForm(emptyTerritory());setPreview(null);setStreetViewHouse(null)};
  const editTerritory=(t:LeadTerritory)=>{setSelected(t.id);setPreview(null);setStreetViewHouse(null);const poly=(t.polygon_geojson as any)?.coordinates?.[0]??[];setForm({id:t.id,name:t.name,assigned_employee_id:t.assigned_employee_id||'',status:t.status||'active',notes:t.notes||'',color:(t as any).color||'#9d7651',points:poly.map((p:number[])=>[Number(p[1]),Number(p[0])])})};
  const polygonsOverlap=(candidate:[number,number][])=>{
    if(candidate.length<3)return false;
    return territories.some(t=>{
      if(t.id===form.id||t.status==='inactive')return false;
      const poly=(t.polygon_geojson as any)?.coordinates?.[0]??[];
      if(poly.length<3)return false;
      const other=poly.map((p:number[])=>[Number(p[1]),Number(p[0])] as [number,number]);
      return polygonOverlap(candidate,other);
    });
  };
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(form.points.length<3)return alert('Draw at least 3 boundary points.');if(polygonsOverlap(form.points)&&!confirm('This territory may overlap another territory. Save anyway?'))return;setBusy(true);const lats=form.points.map(p=>p[0]),lngs=form.points.map(p=>p[1]);const payload:any={name:form.name,assigned_employee_id:form.assigned_employee_id||null,status:form.status,notes:form.notes||null,color:form.color,center_lat:lats.reduce((a,b)=>a+b,0)/lats.length,center_lng:lngs.reduce((a,b)=>a+b,0)/lngs.length,polygon_geojson:{type:'Polygon',coordinates:[[...form.points.map(([lat,lng])=>[lng,lat]),[form.points[0][1],form.points[0][0]]]]}};const q=form.id?supabase.from('lead_territories').update(payload).eq('id',form.id):supabase.from('lead_territories').insert(payload);const {data,error}=await q.select().single();setBusy(false);if(error)return alert(error.message);await supabase.from('audit_logs').insert({action:form.id?'territory.updated':'territory.created',entity_type:'lead_territory',entity_id:data.id,details:{name:data.name}});await load();editTerritory(data as LeadTerritory)};
  const remove=async(t:LeadTerritory)=>{if(!confirm(`Archive ${t.name}? Houses and history will remain.`))return;await supabase.from('lead_territories').update({status:'inactive'}).eq('id',t.id);await load();if(selected===t.id)beginNew()};
  const loadHouses=async(t:LeadTerritory)=>{const poly=(t.polygon_geojson as any)?.coordinates?.[0];if(!poly?.length)return alert('This territory does not have a polygon.');setBusy(true);try{const lats=poly.map((p:number[])=>p[1]),lngs=poly.map((p:number[])=>p[0]);const bbox=`${Math.min(...lats)},${Math.min(...lngs)},${Math.max(...lats)},${Math.max(...lngs)}`;const elements=await fetchTerritoryHouseData(bbox,poly.map((p:number[])=>[Number(p[1]),Number(p[0])] as [number,number]));const isInside=(lat:number,lng:number)=>pointInPolygon(lat,lng,poly.map((p:number[])=>[p[1],p[0]]));const found=(elements??[]).map((e:any)=>{const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon);const tags=e.tags??{};return{lat,lng,address:[tags['addr:housenumber'],tags['addr:street']].filter(Boolean).join(' ')||null,source:`osm:${e.type}:${e.id}`}}).filter((x:any)=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&isInside(x.lat,x.lng));const existing=doors.filter(d=>d.territory_id===t.id);const inserts=found.filter((x:any)=>!existing.some(d=>Math.abs(Number(d.latitude)-x.lat)<.000015&&Math.abs(Number(d.longitude)-x.lng)<.000015)).map((x:any)=>({territory_id:t.id,latitude:x.lat,longitude:x.lng,address:x.address,status:'unworked',source:x.source}));if(inserts.length){const chunks=[];for(let i=0;i<inserts.length;i+=300)chunks.push(inserts.slice(i,i+300));for(const chunk of chunks){const {error}=await supabase.from('territory_doors').insert(chunk);if(error)throw error;}}await supabase.from('lead_territories').update({houses_imported_at:new Date().toISOString()}).eq('id',t.id);await load();alert(`${inserts.length} new houses loaded. ${found.length} buildings/address points found in the boundary.`)}catch(err:any){alert(err.message||'Unable to load houses.')}finally{setBusy(false)}};
  const drawnMappedDoors=form.points.length>=3?doors.filter(d=>pointInPolygon(Number(d.latitude),Number(d.longitude),form.points)): [];
  const mapDoors = preview?.properties?.length
    ? preview.properties.map((p, i) => ({
        id: `preview-${i}`,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        status: p.status || 'unworked',
        source: p.source,
      }))
    : (selected ? selectedTerritoryDoors : drawnMappedDoors);
  const mapStreets=new Set(mapDoors.map((d:any)=>d.street_name||String(d.address||'').replace(/^\s*\d+[A-Za-z-]*\s+/,'').trim()).filter(Boolean));
  const previewHouses=async()=>{
    if(form.points.length<3)return alert('Draw at least 3 boundary points first.');
    setPreviewBusy(true);
    try{
      const lats=form.points.map(p=>p[0]),lngs=form.points.map(p=>p[1]);
      const bbox=`${Math.min(...lats)},${Math.min(...lngs)},${Math.max(...lats)},${Math.max(...lngs)}`;
      const elements=await fetchTerritoryHouseData(bbox);
      const found=(elements??[]).map((e:any)=>{const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon),tags=e.tags??{};return{lat,lng,street:tags['addr:street']||'',address:[tags['addr:housenumber'],tags['addr:street']].filter(Boolean).join(' ')}}).filter((x:any)=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&pointInPolygon(x.lat,x.lng,form.points));
      const streets=[...new Set(found.map((x:any)=>x.street).filter(Boolean))] as string[];
      setPreview({houses:found.length,streets:streets.length,streetNames:streets.sort().slice(0,18),properties:found.map((x:any,i:number)=>({address:x.address||null,latitude:x.lat,longitude:x.lng,status:'preview',source:`preview:${i}`}))});
    }catch(err:any){alert(err.message||'Unable to preview houses.')}finally{setPreviewBusy(false)}
  };
  const visible=territories.filter(t=>!query||String(t.name||'').toLowerCase().includes(query.toLowerCase())||reps.find(e=>e.id===t.assigned_employee_id)?.name?.toLowerCase().includes(query.toLowerCase()));
  const streetViewHouses=(preview?.properties?.length?preview.properties:mapDoors.map((d:any)=>({id:d.id,address:d.address,latitude:Number(d.latitude),longitude:Number(d.longitude),status:d.status,source:d.source}))).filter(h=>Number.isFinite(h.latitude)&&Number.isFinite(h.longitude));
  const currentHouseCount=preview?.houses??mapDoors.length;
  const currentStreetCount=preview?.streets??mapStreets.size;
  return <div className="tab-content phase300 territory-command-page territory-command-v13">
    <Header
      tab="territories"
      action={<button className="btn-primary territory-new-btn" onClick={beginNew}><Plus size={16}/>New Territory</button>}
    />
    {loadError && <div className="d2d-house-discovery error">{loadError}<button type="button" onClick={()=>load()}>Try again</button></div>}

    <div className="territory-workspace-summary territory-summary-v13">
      <div><span>Selected area</span><strong>{currentHouseCount}</strong><small>{preview?'houses discovered':'mapped houses inside boundary'}</small></div>
      <div><span>Street coverage</span><strong>{currentStreetCount}</strong><small>{currentStreetCount===1?'street':'streets'} inside boundary</small></div>
      <div><span>Boundary</span><strong>{form.points.length}</strong><small>editable map points</small></div>
      <div><span>Assignment</span><strong>{form.assigned_employee_id?reps.find(r=>r.id===form.assigned_employee_id)?.name?.split(' ')[0]||'Assigned':'Open'}</strong><small>{form.assigned_employee_id?'rep selected':'needs a D2D rep'}</small></div>
    </div>

    <div className="territory-command-toolbar-v13">
      <div className="search-control territory-filter-v13"><Search size={16}/><input placeholder="Filter saved territories or reps" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div className="territory-toolbar-status-v13">
        <span className="live-dot"/>
        <strong>{selectedTerritory?.name || (form.points.length ? 'New territory draft' : 'Ready to draw')}</strong>
        <span>{currentHouseCount} houses · {currentStreetCount} streets</span>
      </div>
    </div>

    <div className="territory-command-layout territory-command-layout-v13">
      <section className="territory-command-map territory-command-map-v13">
        <div className="territory-map-stage territory-map-stage-v13">
          <FieldTerritoryMap
            territories={visible}
            doors={mapDoors as TerritoryDoor[]}
            editable
            initialPolygon={form.points}
            selectedTerritoryId={selected||undefined}
            onPolygonChange={points=>{setForm(p=>({...p,points}));setPreview(null)}}
            onTerritoryClick={editTerritory}
            onDoorClick={door=>setStreetViewHouse({id:door.id,address:door.address,latitude:Number(door.latitude),longitude:Number(door.longitude),status:door.status,source:door.source})}
            showDoorLabels={false}
            className="territory-admin-map"
          />
          <div className="territory-map-counter territory-map-counter-v13"><strong>{currentHouseCount}</strong><span>{preview?'houses found':'houses in area'}</span><i/><strong>{currentStreetCount}</strong><span>streets</span></div>
        </div>
        <div className="territory-map-help-v13">
          <span><b>1.</b> Search an address or neighborhood</span>
          <span><b>2.</b> Click the map to draw the boundary</span>
          <span><b>3.</b> Preview houses, assign a rep and save</span>
        </div>
      </section>

      <aside className="territory-command-panel territory-command-panel-v13">
        <form onSubmit={save} className="phase-panel caramel territory-setup-card-v13">
          <div className="phase-panel-head territory-panel-head-v13">
            <div><span className="eyebrow">{form.id?'EDIT TERRITORY':'NEW TERRITORY'}</span><h3>{form.name||'Territory setup'}</h3><small>{form.id?'Update this saved territory':'Draw the area, then finish setup here'}</small></div>
            {form.id&&<button type="button" className="icon-btn" onClick={beginNew} aria-label="Close territory"><XCircle size={18}/></button>}
          </div>

          <div className="territory-form-section-v13">
            <label>Name<input required placeholder="Example: North Hills West" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></label>
            <label>Assigned D2D rep
              <div className="owner-lead-assign">
                <select value={form.assigned_employee_id} onChange={e=>setForm(p=>({...p,assigned_employee_id:e.target.value}))}>
                  <option value="">Unassigned</option>
                  {reps.map(r=><option key={r.id} value={r.id}>{leadRepLabel(r)} · L{r.employment_level||1}</option>)}
                </select>
                <button type="button" className="btn-outline" disabled={!self||form.assigned_employee_id===self?.id} onClick={()=>self&&setForm(p=>({...p,assigned_employee_id:self.id}))}>
                  {form.assigned_employee_id===self?.id?'Assigned to you':'Assign to me'}
                </button>
              </div>
            </label>
            <div className="two-fields territory-two-fields-v13">
              <label>Status<select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="active">Active</option><option value="paused">Paused</option><option value="complete">Complete</option><option value="inactive">Archived</option></select></label>
              <label>Map color<input type="color" value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))}/></label>
            </div>
          </div>

          <div className="territory-selection-summary territory-selection-summary-v13">
            <div><strong>{form.points.length}</strong><span>boundary points</span></div>
            <div><strong>{currentHouseCount}</strong><span>{preview?'discovered':'mapped'} houses</span></div>
            <div><strong>{currentStreetCount}</strong><span>streets</span></div>
          </div>

          <label className="territory-notes-v13">Manager notes<textarea placeholder="Access notes, neighborhood details, rep instructions…" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></label>
          {preview?.streetNames?.length?<div className="street-preview-list">{preview.streetNames.map(x=><span key={x}>{x}</span>)}</div>:null}

          <div className="territory-primary-actions-v13">
            <button type="button" className="btn-outline territory-preview-btn" disabled={previewBusy||form.points.length<3} onClick={previewHouses}><Eye size={15}/>{previewBusy?'Counting houses…':'Preview Houses / Streets'}</button>
            <button className="btn-primary" disabled={busy}><Save size={16}/>{busy?'Saving…':form.id?'Save Changes':'Save Territory'}</button>
          </div>

          {selectedTerritory&&<div className="territory-action-stack territory-secondary-actions-v13">
            <button type="button" className="btn-outline" onClick={()=>loadHouses(selectedTerritory)} disabled={busy}><MapPin size={15}/>Load / Refresh Houses</button>
            <button type="button" className="btn-outline" onClick={()=>remove(selectedTerritory)}><Trash2 size={15}/>Archive Territory</button>
          </div>}
        </form>
      </aside>
    </div>

    <TerritoryStreetView houses={streetViewHouses} activeHouse={streetViewHouse} onActiveHouseChange={setStreetViewHouse}/>

    <div className="territory-card-grid territory-card-grid-v13">
      {visible.map(t=>{const s=stats(t.id);return <button className={`territory-analytics-card ${selected===t.id?'selected':''}`} key={t.id} onClick={()=>editTerritory(t)}>
        <div className="territory-card-top"><span className="territory-dot" style={{background:(t as any).color||'#9d7651'}}/><div><strong>{t.name}</strong><small>{reps.find(e=>e.id===t.assigned_employee_id)?.name||'Unassigned'} · {humanStatus(t.status)}</small></div><Pencil size={15}/></div>
        <div className="territory-mini-kpis"><span><b>{s.total}</b> houses</span><span><b>{s.worked}</b> worked</span><span><b>{s.remaining}</b> remaining</span><span><b>{s.pct}%</b></span><span><b>{s.interested}</b> interested</span><span><b>{s.followUps}</b> follow-ups</span><span><b>{s.estimates}</b> estimates</span><span><b>{s.appointments}</b> appts</span><span><b>{s.sold}</b> sold</span><span><b>{s.conversion}%</b> conv.</span></div>
        <div className="mini-progress"><i style={{width:`${s.pct}%`}}/></div>
      </button>})}
      {!visible.length && !loadError && <div className="empty-text">No territories yet. Draw a neighborhood on the map to start.</div>}
    </div>
  </div>;
}

function DispatchCenter({employees,appointments,setAppointments}:{employees:Employee[];appointments:Appointment[];setAppointments:React.Dispatch<React.SetStateAction<Appointment[]>>}){
 return <DispatchCommandCenter employees={employees} appointments={appointments} setAppointments={setAppointments}/>;
}

function CRMCenter({customers,appointments}:{customers:Profile[];appointments:Appointment[]}){
 const [query,setQuery]=useState('');const [selected,setSelected]=useState<Profile|null>(null);const [notes,setNotes]=useState<any[]>([]);const [vehicles,setVehicles]=useState<any[]>([]);const filtered=customers.filter(c=>!query||[c.full_name,c.email,c.phone].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{if(!selected){setNotes([]);setVehicles([]);return;}Promise.all([supabase.from('crm_notes').select('*').eq('customer_id',selected.id).order('created_at',{ascending:false}),supabase.from('customer_vehicles').select('*').eq('user_id',selected.id).order('created_at',{ascending:false})]).then(([n,v])=>{setNotes(n.data??[]);setVehicles(v.data??[])})},[selected?.id]);
 return <div className="tab-content phase300"><Header tab="crm"/><div className="crm-command"><aside className="crm-customer-list"><div className="search-control"><Search size={16}/><input placeholder="Search customers" value={query} onChange={e=>setQuery(e.target.value)}/></div>{filtered.slice(0,300).map(c=>{const ca=appointments.filter(a=>a.user_id===c.id);const spend=ca.filter(a=>a.status==='completed').reduce((s,a)=>s+Number(a.price||0),0);return <button key={c.id} onClick={()=>setSelected(c)} className={selected?.id===c.id?'selected':''}><span className="crm-avatar">{(c.full_name||c.email||'C')[0].toUpperCase()}</span><span><strong>{c.full_name||'Customer'}</strong><small>{c.email||c.phone||'No contact'} · {money(spend)}</small></span></button>})}</aside><main className="crm-customer-detail">{selected?(()=>{const ca=appointments.filter(a=>a.user_id===selected.id).sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at));const spend=ca.filter(a=>a.status==='completed').reduce((s,a)=>s+Number(a.price||0),0);return <><div className="crm-detail-hero"><div className="crm-large-avatar">{(selected.full_name||selected.email||'C')[0].toUpperCase()}</div><div><span className="eyebrow">CUSTOMER</span><h2>{selected.full_name||selected.email||selected.phone||'Guest'}</h2><p>{selected.email||'No email'} · {selected.phone||'No phone'}</p><FieldContactBar phone={selected.phone} name={selected.full_name||selected.email}/></div><div className="crm-value"><span>Lifetime service value</span><strong>{money(spend)}</strong></div></div><div className="phase-kpi-row"><KPI label="Bookings" value={String(ca.length)}/><KPI label="Completed" value={String(ca.filter(a=>a.status==='completed').length)}/><KPI label="Vehicles" value={String(vehicles.length|| (selected.vehicle_info?1:0))}/><KPI label="Last Service" value={ca.find(a=>a.status==='completed')?.scheduled_at?new Date(ca.find(a=>a.status==='completed')!.scheduled_at!).toLocaleDateString():'—'}/></div><div className="crm-detail-grid"><section className="phase-panel"><h3>Vehicles</h3>{vehicles.map(v=><div className="crm-line" key={v.id}><strong>{[v.year,v.make,v.model].filter(Boolean).join(' ')||v.nickname||'Vehicle'}</strong><span>{v.color||''} {v.size_class?`· ${v.size_class}`:''}</span></div>)}{!vehicles.length&&<div className="crm-line"><strong>{selected.vehicle_info||'No saved vehicle yet'}</strong></div>}</section><section className="phase-panel"><h3>CRM Notes</h3>{notes.slice(0,8).map(n=><div className="crm-line" key={n.id}><strong>{n.note_type||'Note'}</strong><span>{n.body||n.note} · {when(n.created_at)}</span></div>)}{!notes.length&&<p>No CRM notes yet.</p>}</section></div><section className="phase-panel"><h3>Service Timeline</h3>{ca.slice(0,20).map(a=><div className="timeline-row" key={a.id}><span className="timeline-dot"/><div><strong>{a.service_name}</strong><small>{when(a.scheduled_at||a.created_at)} · {humanStatus(a.status)} · {money(Number(a.price||0))}</small></div></div>)}</section><ClientPhotosSection customers={customers} appointments={appointments} compactCustomer={selected}/></>})():<div className="empty-inspector"><img className="message-empty-lockup" src={BRAND_LOCKUP} alt="NS Auto Luxe Premium Detailing"/><h3>Select a customer</h3><p>Open their complete North Splash relationship from one place.</p></div>}</main></div></div>;
}

function TrainingCenter({employees}:{employees:Employee[]}){
 const [courses,setCourses]=useState<any[]>([]),[assignments,setAssignments]=useState<any[]>([]),[lessons,setLessons]=useState<any[]>([]),[questions,setQuestions]=useState<any[]>([]),[options,setOptions]=useState<any[]>([]);const [selected,setSelected]=useState<string>(ACADEMY_COURSES[0].id);const [applying,setApplying]=useState(false);const [form,setForm]=useState({title:'',description:'',category:'operations',required_role:'detailer',passing_score:'80',duration_minutes:'30',manager_signoff_required:false});const [lesson,setLesson]=useState({title:'',lesson_type:'text',content:'',media_url:''});const [quiz,setQuiz]=useState({prompt:'',correct:'',wrong1:'',wrong2:'',wrong3:''});
 const load=async()=>{const [c,a,l,q,o]=await Promise.all([supabase.from('training_courses').select('*').order('created_at',{ascending:false}),supabase.from('training_assignments').select('*'),supabase.from('training_lessons').select('*').order('sort_order'),supabase.from('training_questions').select('*').order('sort_order'),supabase.from('training_question_options').select('*').order('sort_order')]);setCourses(c.data??[]);setAssignments(a.data??[]);setLessons(l.data??[]);setQuestions(q.data??[]);setOptions(o.data??[])};
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!employees.length)return;let live=true;(async()=>{await applyNewHireAcademy(employees);if(live)await load()})();return()=>{live=false}},[employees.length]);
 const applyAcademy=async()=>{setApplying(true);const errs=await applyNewHireAcademy(employees);await load();setApplying(false);alert(errs.length?`Academy saved with a warning: ${errs[0]}`:`Door-to-door and detailing field academies are live and assigned to matching team members.`)};
 const course=courses.find(c=>c.id===selected);const saveCourse=async(e:React.FormEvent)=>{e.preventDefault();const {data,error}=await supabase.from('training_courses').insert({...form,passing_score:Number(form.passing_score),duration_minutes:Number(form.duration_minutes),status:'active'}).select().single();if(error)return alert(error.message);await load();setSelected(data.id);setForm({title:'',description:'',category:'operations',required_role:'detailer',passing_score:'80',duration_minutes:'30',manager_signoff_required:false})};
 const addLesson=async(e:React.FormEvent)=>{e.preventDefault();if(!course)return;const count=lessons.filter(l=>l.course_id===course.id).length;const {error}=await supabase.from('training_lessons').insert({course_id:course.id,...lesson,sort_order:count+1,required:true});if(error)return alert(error.message);setLesson({title:'',lesson_type:'text',content:'',media_url:''});load()};
 const addQuestion=async(e:React.FormEvent)=>{e.preventDefault();if(!course||!quiz.prompt||!quiz.correct)return;const count=questions.filter(q=>q.course_id===course.id).length;const {data:q,error}=await supabase.from('training_questions').insert({course_id:course.id,prompt:quiz.prompt,question_type:'multiple_choice',sort_order:count+1,points:1}).select().single();if(error)return alert(error.message);const vals=[quiz.correct,quiz.wrong1,quiz.wrong2,quiz.wrong3].filter(Boolean);await supabase.from('training_question_options').insert(vals.map((label,i)=>({question_id:q.id,label,is_correct:i===0,sort_order:i+1})));setQuiz({prompt:'',correct:'',wrong1:'',wrong2:'',wrong3:''});load()};
 const assignRole=async()=>{if(!course)return;const matches=employees.filter(e=>e.status==='active'&&(!course.required_role||course.required_role==='all'||e.role===course.required_role|| (course.required_role==='employee'&&e.role==='detailer')));const existing=new Set(assignments.filter(a=>a.course_id===course.id).map(a=>a.employee_id));const rows=matches.filter(e=>!existing.has(e.id)).map(e=>({course_id:course.id,employee_id:e.id,status:'assigned',assigned_at:new Date().toISOString()}));if(rows.length)await supabase.from('training_assignments').insert(rows);await load();alert(`${rows.length} employees assigned.`)};
 const completed=assignments.filter(a=>a.status==='completed').length;return <div className="tab-content phase300"><Header tab="training" action={<div className="training-admin-actions"><button className="btn-primary" type="button" onClick={applyAcademy} disabled={applying}>{applying?"Applying…":"Apply field academies"}</button><button className="btn-outline" onClick={assignRole} disabled={!course}><UserCheck size={15}/>Assign Selected Course</button></div>}/><div className="phase-kpi-row"><KPI label="Courses" value={String(courses.length)}/><KPI label="Assignments" value={String(assignments.length)}/><KPI label="Completed" value={String(completed)}/><KPI label="Completion" value={`${percent(completed,assignments.length)}%`}/></div><div className="training-admin-layout"><aside className="training-admin-list"><form onSubmit={saveCourse} className="phase-panel caramel"><span className="eyebrow">NEW COURSE</span><input required placeholder="Course title" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/><textarea placeholder="Description" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/><div className="two-fields"><select value={form.required_role} onChange={e=>setForm(p=>({...p,required_role:e.target.value}))}><option value="detailer">Detailers</option><option value="d2d_agent">D2D Sales</option><option value="manager">Managers</option><option value="all">Everyone</option></select><input type="number" min="1" value={form.duration_minutes} onChange={e=>setForm(p=>({...p,duration_minutes:e.target.value}))}/></div><div className="two-fields"><label>Passing %<input type="number" min="0" max="100" value={form.passing_score} onChange={e=>setForm(p=>({...p,passing_score:e.target.value}))}/></label><label className="checkbox-line"><input type="checkbox" checked={form.manager_signoff_required} onChange={e=>setForm(p=>({...p,manager_signoff_required:e.target.checked}))}/>Hands-on sign-off</label></div><button className="btn-primary"><Plus size={15}/>Create Course</button></form><div className="course-admin-nav">{courses.map(c=><button className={selected===c.id?'selected':''} key={c.id} onClick={()=>setSelected(c.id)}><GraduationCap size={17}/><span><strong>{c.title}</strong><small>{c.required_role||'all'} · {c.passing_score??80}% pass</small></span></button>)}</div></aside><main className="training-admin-detail">{course?<><div className="training-admin-hero"><div><span className="eyebrow">{course.category||'TRAINING'}</span><h2>{course.title}</h2><p>{course.description||'No description yet.'}</p></div><div><strong>{assignments.filter(a=>a.course_id===course.id).length}</strong><span>assigned</span></div></div><div className="training-builder-grid"><form className="phase-panel" onSubmit={addLesson}><h3><BookOpen size={18}/>Add Lesson</h3><input required placeholder="Lesson title" value={lesson.title} onChange={e=>setLesson(p=>({...p,title:e.target.value}))}/><select value={lesson.lesson_type} onChange={e=>setLesson(p=>({...p,lesson_type:e.target.value}))}><option value="text">Procedure / Text</option><option value="video">Video</option><option value="pdf">PDF / Document</option></select><input placeholder="Video/PDF URL" value={lesson.media_url} onChange={e=>setLesson(p=>({...p,media_url:e.target.value}))}/><textarea placeholder="Lesson content / procedure" value={lesson.content} onChange={e=>setLesson(p=>({...p,content:e.target.value}))}/><button className="btn-primary">Add Lesson</button></form><form className="phase-panel" onSubmit={addQuestion}><h3><CheckCircle2 size={18}/>Add Quiz Question</h3><input required placeholder="Question" value={quiz.prompt} onChange={e=>setQuiz(p=>({...p,prompt:e.target.value}))}/><input required placeholder="Correct answer" value={quiz.correct} onChange={e=>setQuiz(p=>({...p,correct:e.target.value}))}/><input placeholder="Wrong answer" value={quiz.wrong1} onChange={e=>setQuiz(p=>({...p,wrong1:e.target.value}))}/><input placeholder="Wrong answer" value={quiz.wrong2} onChange={e=>setQuiz(p=>({...p,wrong2:e.target.value}))}/><input placeholder="Wrong answer" value={quiz.wrong3} onChange={e=>setQuiz(p=>({...p,wrong3:e.target.value}))}/><button className="btn-primary">Add Question</button></form></div><div className="training-content-list"><h3>Course Content</h3>{lessons.filter(l=>l.course_id===course.id).map((l,i)=><div className="training-content-item" key={l.id}><span>{i+1}</span><div><strong>{l.title}</strong><small>{humanStatus(l.lesson_type)}</small></div></div>)}{questions.filter(q=>q.course_id===course.id).map(q=><div className="training-content-item quiz" key={q.id}><span>Q</span><div><strong>{q.prompt}</strong><small>{options.filter(o=>o.question_id===q.id).length} choices</small></div></div>)}</div></>:<div className="empty-inspector"><GraduationCap size={42}/><h3>New-hire academy is ready</h3><p>Open Door-to-door academy or Detailing academy in the list. Apply new-hire academy assigns them to matching roles.</p></div>}</main></div></div>;
}

function CommunicationsCenter(){
 const [templates,setTemplates]=useState<any[]>([]),[logs,setLogs]=useState<any[]>([]),[selected,setSelected]=useState<any|null>(null),[testEmail,setTestEmail]=useState(''),[preview,setPreview]=useState<'email'|'sms'|'none'>('none'),[filter,setFilter]=useState('all');
 const load=async()=>{const [t,l]=await Promise.all([supabase.from('communication_templates').select('*').order('category').order('send_delay_minutes'),supabase.from('communication_logs').select('*').order('created_at',{ascending:false}).limit(200)]);setTemplates(t.data??[]);setLogs(l.data??[]);if(!selected&&t.data?.length)setSelected({...t.data[0]})};useEffect(()=>{load()},[]);
 const save=async()=>{if(!selected)return;const payload={subject:selected.subject,body:selected.body,sms_body:selected.sms_body||'',is_enabled:selected.is_enabled,email_enabled:selected.email_enabled!==false,sms_enabled:Boolean(selected.sms_enabled),from_email:selected.from_email,send_delay_minutes:Number(selected.send_delay_minutes||0),category:selected.category||'appointments',timing_label:selected.timing_label||''};const{error}=await supabase.from('communication_templates').update(payload).eq('id',selected.id);if(error)return alert(error.message);await load();alert('Automation saved.')};
 const test=async()=>{if(!selected||!testEmail)return;const{data,error}=await supabase.functions.invoke('send-communication',{body:{event_key:selected.event_key,recipient_email:testEmail,variables:{customer_first_name:'Matthew',customer_name:'Matthew',detailer_name:'Jordan M.',employee_name:'Jordan M.',detailer_photo:'',service_name:'Luxe Signature',vehicle:'2022 BMW 330i',vehicle_info:'2022 BMW 330i',appointment_time:new Date(Date.now()+86400000).toLocaleString(),address:'Raleigh, NC',price:'$275.00',amount:'$275.00',eta:'10:42 AM',portal_link:'https://ns-auto-luxe-os.vercel.app/portal'}}});if(error)return alert(error.message);alert(data?.success?'Test email sent.':data?.error||'Unable to send test.')};
 const groups=[['appointments','Appointment Notifications'],['field','Day-of-Service Updates'],['payments','Payments'],['retention','Customer Retention'],['other','Other']];
 const filtered=filter==='all'?templates:templates.filter(t=>(t.category||'other')===filter);
 const vars=['{customer_first_name}','{detailer_name}','{vehicle}','{service}','{appointment_time}','{price}','{eta}','{portal_link}'];
 const sample=(text:string)=>String(text||'').replace(/{{?customer_first_name}?}/g,'Matthew').replace(/{{?customer_name}?}/g,'Matthew').replace(/{{?detailer_name}?}/g,'Jordan M.').replace(/{{?employee_name}?}/g,'Jordan M.').replace(/{{?vehicle(_info)?}?}/g,'2022 BMW 330i').replace(/{{?service(_name)?}?}/g,'Luxe Signature').replace(/{{?appointment_time}?}/g,'Saturday, September 12 · 10:30 AM').replace(/{{?price}?}|{{?amount}?}/g,'$275.00').replace(/{{?eta}?}/g,'10:42 AM').replace(/{{?portal_link}?}/g,'northsplash.com/appointment');
 return <div className="tab-content phase300 communications-v25"><Header tab="communications" action={<div className="comm-provider-status"><span className="on"><CheckCircle2 size={14}/>SendGrid Email</span><span><Smartphone size={14}/>SMS ready for provider</span></div>}/>
   <div className="comm-lifecycle-v25">{['Booked','Confirmed','Reminder','Assigned','En Route','Arrived','In Progress','Complete','Paid','Review'].map((x,i)=><div key={x}><span>{i+1}</span><small>{x}</small></div>)}</div>
   <div className="comm-filter-v25"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All</button>{groups.slice(0,-1).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
   <div className="comm-layout comm-layout-v25"><aside className="comm-template-list comm-template-list-v25">{groups.map(([gid,title])=>{const rows=filtered.filter(t=>(t.category||'other')===gid);if(!rows.length)return null;return <section key={gid}><div className="comm-group-title">{title}<span>{rows.length}</span></div>{rows.map(t=><button className={selected?.id===t.id?'selected':''} key={t.id} onClick={()=>setSelected({...t})}><span className={`comm-dot ${t.is_enabled?'on':''}`}/><span><strong>{t.name||humanStatus(t.event_key)}</strong><small>{t.timing_label||`${Number(t.send_delay_minutes||0)} min`} · {t.email_enabled!==false?'Email':''}{t.email_enabled!==false&&t.sms_enabled?' + ':''}{t.sms_enabled?'SMS':''}</small></span><ChevronRight size={14}/></button>)}</section>})}</aside>
   <main className="comm-editor comm-editor-v25">{selected?<div className="phase-panel"><div className="phase-panel-head"><div><span className="eyebrow">{selected.category||'AUTOMATION'} / {selected.event_key}</span><h3>{selected.name||humanStatus(selected.event_key)}</h3></div><label className="toggle-line"><input type="checkbox" checked={Boolean(selected.is_enabled)} onChange={e=>setSelected((p:any)=>({...p,is_enabled:e.target.checked}))}/>Enabled</label></div>
     <div className="comm-channel-switches"><label><input type="checkbox" checked={selected.email_enabled!==false} onChange={e=>setSelected((p:any)=>({...p,email_enabled:e.target.checked}))}/><Mail size={15}/>Email</label><label><input type="checkbox" checked={Boolean(selected.sms_enabled)} onChange={e=>setSelected((p:any)=>({...p,sms_enabled:e.target.checked}))}/><Smartphone size={15}/>SMS</label></div>
     <div className="form-row"><label>Timing label<input value={selected.timing_label||''} onChange={e=>setSelected((p:any)=>({...p,timing_label:e.target.value}))} placeholder="24 hours before"/></label><label>Delay / offset minutes<input type="number" value={Number(selected.send_delay_minutes||0)} onChange={e=>setSelected((p:any)=>({...p,send_delay_minutes:Number(e.target.value)}))}/></label></div>
     <label>From<input value={selected.from_email||'appointments@northsplash.com'} onChange={e=>setSelected((p:any)=>({...p,from_email:e.target.value}))}/></label>
     <label>Email Subject<input value={selected.subject||''} onChange={e=>setSelected((p:any)=>({...p,subject:e.target.value}))}/></label>
     <label>Email Message<textarea rows={9} value={selected.body||''} onChange={e=>setSelected((p:any)=>({...p,body:e.target.value}))}/></label>
     <label>SMS Message<textarea rows={4} maxLength={500} value={selected.sms_body||''} onChange={e=>setSelected((p:any)=>({...p,sms_body:e.target.value}))} placeholder="North Splash: Your detailer is on the way. ETA {{eta}}. {{portal_link}}"/><small>{String(selected.sms_body||'').length}/500</small></label>
     <div className="comm-variable-bank"><span>Variables</span>{vars.map(v=><button type="button" key={v} onClick={()=>navigator.clipboard?.writeText(v)}>{v}</button>)}</div>
     <div className="comm-actions comm-actions-v25"><button className="btn-primary" onClick={save}><Save size={15}/>Save Automation</button><button className="btn-outline" onClick={()=>setPreview('email')}><Eye size={15}/>Preview Email</button><button className="btn-outline" onClick={()=>setPreview('sms')}><Smartphone size={15}/>Preview SMS</button><input type="email" placeholder="Test recipient email" value={testEmail} onChange={e=>setTestEmail(e.target.value)}/><button className="btn-outline" onClick={test}><Send size={15}/>Send Test</button></div>
   </div>:<div className="empty-inspector"><Mail size={40}/><h3>Select an automation</h3></div>}</main></div>
   <section className="phase-panel comm-log comm-log-v25"><div className="phase-panel-head"><div><span className="eyebrow">DELIVERY HEALTH</span><h3>Recent Communication Activity</h3></div><span>{logs.filter(l=>l.status==='sent').length} sent · {logs.filter(l=>l.status==='failed').length} failed</span></div>{logs.slice(0,100).map(l=><div className="comm-log-row" key={l.id}><span className={l.status==='sent'?'success':l.status==='failed'?'danger':'warning'}>{l.status}</span><strong>{l.event_key||l.template_key}</strong><span>{l.recipient_email||'—'}</span><small>{when(l.created_at)}</small></div>)}</section>
   {preview!=='none'&&selected&&<div className="comm-preview-backdrop" onClick={()=>setPreview('none')}><div className={`comm-preview-modal ${preview}`} onClick={e=>e.stopPropagation()}><header><div><span className="eyebrow">PREVIEW</span><h3>{preview==='email'?'Customer Email':'Customer SMS'}</h3></div><button onClick={()=>setPreview('none')}><XCircle size={18}/></button></header>{preview==='email'?<div className="email-preview-v25"><div className="email-brand-v25"><strong>NORTH SPLASH</strong><small>AUTO LUXE</small></div><div className="email-body-v25"><span className="eyebrow">APPOINTMENT UPDATE</span><h2>{sample(selected.subject||'Your North Splash appointment')}</h2><div className="email-detail-card"><strong>{sample('{{service_name}}')}</strong><span>{sample('{{vehicle_info}}')}</span><span>{sample('{{appointment_time}}')}</span><b>{sample('{{amount}}')}</b></div><p>{sample(selected.body||'')}</p><button type="button" disabled>View appointment</button><div className="email-status-v25"><span className="done">Appointment</span><span className="done">Confirmed</span><span>En Route</span><span>In Progress</span><span>Complete</span></div></div></div>:<div className="sms-phone-v25"><div className="sms-notch"/><div className="sms-thread-title">North Splash Auto Luxe</div><div className="sms-bubble">{sample(selected.sms_body||'North Splash: Your appointment update is ready. {{portal_link}}')}</div></div>}</div></div>}
 </div>;
}


function AutomationCenter(){
 const [rules,setRules]=useState<any[]>([]),[events,setEvents]=useState<any[]>([]);const [form,setForm]=useState({name:'',trigger_event:'appointment.completed',action_type:'notification',delay_minutes:'0',is_enabled:true});const load=async()=>{const [r,e]=await Promise.all([supabase.from('automation_rules').select('*').order('created_at',{ascending:false}),supabase.from('automation_events').select('*').order('created_at',{ascending:false}).limit(100)]);setRules(r.data??[]);setEvents(e.data??[])};useEffect(()=>{load()},[]);
 const add=async(e:React.FormEvent)=>{e.preventDefault();const {error}=await supabase.from('automation_rules').insert({...form,delay_minutes:Number(form.delay_minutes),status:form.is_enabled?'active':'paused'});if(error)return alert(error.message);setForm({name:'',trigger_event:'appointment.completed',action_type:'notification',delay_minutes:'0',is_enabled:true});load()};const run=async()=>{const {data,error}=await supabase.functions.invoke('automation-worker',{body:{limit:100}});if(error)return alert(error.message);alert(`Processed ${data?.processed??0} events.`);load()};
 return <div className="tab-content phase300"><Header tab="automations" action={<button className="btn-primary" onClick={run}><Play size={15}/>Run Pending Now</button>}/><div className="automation-layout"><form className="phase-panel caramel" onSubmit={add}><span className="eyebrow">NEW AUTOMATION</span><h3>When this happens → do this</h3><input required placeholder="Rule name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/><label>Trigger<select value={form.trigger_event} onChange={e=>setForm(p=>({...p,trigger_event:e.target.value}))}><option value="appointment.reminder_due">Appointment reminder due</option><option value="job.review_due">Review request due</option><option value="lead.follow_up_due">Lead follow-up due</option><option value="employee.d2d_inactive">D2D inactivity</option><option value="employee.late">Employee late</option><option value="inventory.low">Inventory low</option><option value="payment.failed">Payment failed</option><option value="training.due">Training due</option></select></label><label>Action<select value={form.action_type} onChange={e=>setForm(p=>({...p,action_type:e.target.value}))}><option value="notification">Create notification</option><option value="email">Send email</option><option value="task">Create task</option></select></label><label>Delay (minutes)<input type="number" min="0" value={form.delay_minutes} onChange={e=>setForm(p=>({...p,delay_minutes:e.target.value}))}/></label><button className="btn-primary"><Plus size={15}/>Create Rule</button></form><section className="automation-rules"><h3>Rules</h3>{rules.map(r=><div className="automation-rule" key={r.id}><span className={`comm-dot ${r.status==='active'||r.is_enabled?'on':''}`}/><div><strong>{r.name}</strong><small>{humanStatus(r.trigger_event||'')} → {humanStatus(r.action_type||'')} · {r.delay_minutes||0}m delay</small></div><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('automation_rules').update({status:r.status==='active'?'paused':'active'}).eq('id',r.id);load()}}>{r.status==='active'?<Pause size={13}/>:<Play size={13}/>}</button></div>)}</section></div><section className="phase-panel"><h3>Recent Automation Events</h3>{events.slice(0,30).map(e=><div className="comm-log-row" key={e.id}><span>{e.status}</span><strong>{humanStatus(e.event_key||e.trigger_event||'event')}</strong><span>{e.entity_type||'system'}</span><small>{when(e.created_at)}</small></div>)}</section></div>;
}


function OwnerRevenueChart({days}:{days:{label:string;rev:number}[]}){
 const width=620,height=230,pad=28,max=Math.max(1,...days.map(d=>d.rev));
 const pts=days.map((d,i)=>{const x=pad+i*(width-pad*2)/Math.max(1,days.length-1);const y=height-pad-(d.rev/max)*(height-pad*2);return [x,y] as const});
 const line=pts.map(([x,y],i)=>`${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
 const area=`${line} L ${pts.at(-1)?.[0]??pad} ${height-pad} L ${pts[0]?.[0]??pad} ${height-pad} Z`;
 return <div className="v20-owner-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue trend for the last seven days">
  <defs><linearGradient id="ownerRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9ad4a" stopOpacity=".32"/><stop offset="100%" stopColor="#d9ad4a" stopOpacity="0"/></linearGradient></defs>
  {[.25,.5,.75,1].map(n=><line key={n} x1={pad} x2={width-pad} y1={height-pad-(height-pad*2)*n} y2={height-pad-(height-pad*2)*n} className="v20-chart-grid"/>)}
  <path d={area} className="v20-chart-area"/><path d={line} className="v20-chart-line"/>
  {pts.map(([x,y],i)=><circle key={days[i].label} cx={x} cy={y} r="4" className="v20-chart-point"><title>{days[i].label}: {money(days[i].rev)}</title></circle>)}
 </svg><div className="v20-chart-labels">{days.map(d=><span key={d.label}><b>{d.label}</b><small>{money(d.rev)}</small></span>)}</div></div>
}
function MiniAvatar({name}:{name:string}){const initials=String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'NS';return <span className="v20-mini-avatar">{initials}</span>}

function CommandCenter({employees,appointments,customers,payments,onNavigate,ownerName}:{employees:Employee[];appointments:Appointment[];customers:Profile[];payments:any[];onNavigate?:(view:string)=>void;ownerName?:string}){
 const [leadSnap,setLeadSnap]=useState({hot:0,neu:0,open:0,knocked:0});
 useEffect(()=>{let live=true;supabase.from('leads').select('id,status,last_contacted_at').limit(2500).then(({data})=>{if(!live)return;const rows=data??[];const closed=new Set(['sold','lost','not_interested','do_not_knock','existing_customer']);setLeadSnap({hot:rows.filter(l=>['interested','estimate','estimate_sent','appointment_set','follow_up'].includes(String(l.status||''))).length,neu:rows.filter(l=>l.status==='new'||l.status==='unworked').length,open:rows.filter(l=>!closed.has(String(l.status||''))).length,knocked:rows.filter(l=>sameLocalDay((l as {last_contacted_at?:string}).last_contacted_at)).length})});return()=>{live=false}},[]);
 const now=Date.now();
 const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 const jobs=appointments.filter(a=>sameLocalDay(a.scheduled_at)&&a.status!=='cancelled').sort((a,b)=>+new Date(a.scheduled_at||0)-+new Date(b.scheduled_at||0));
 const collected=payments.filter(p=>isSettledPayment(p.status)).reduce((s,p)=>s+Number(p.amount||0),0);
 const todayCollected=payments.filter(p=>isSettledPayment(p.status)&&sameLocalDay(p.created_at)).reduce((s,p)=>s+Number(p.amount||0),0);
 const earlierCollected=payments.filter(p=>isSettledPayment(p.status)&&sameLocalDay(p.created_at,yesterday)).reduce((s,p)=>s+Number(p.amount||0),0);
 const scheduled=jobs.reduce((s,j)=>s+Number(j.price||0),0);
 const completed=appointments.filter(a=>a.status==='completed');
 const completedToday=completed.filter(a=>sameLocalDay(a.completed_at||a.finished_at||a.scheduled_at));
 const avgTicket=completed.length?completed.reduce((n,a)=>n+Number(a.price||0),0)/completed.length:0;
 const activeTeam=employees.filter(e=>e.status==='active');
 const crew=hiredCrew(employees);
 const packetOpen=(e:Employee)=>isHirePacketOpen(e);
 const unassigned=appointments.filter(a=>!a.assigned_employee_id&&!['completed','cancelled'].includes(a.status)).length;
 const pending=appointments.filter(a=>a.status==='pending'||a.status==='scheduled').length;
 const qc=appointments.filter(a=>a.qc_status==='pending'||a.qc_status==='qc').length;
 const unpaid=appointments.filter(a=>canCollectJob(a));
 const packets=employees.filter(packetOpen).length;
 const inField=appointments.filter(a=>{
  const field=String(a.field_status||'').toLowerCase();
  const status=String(a.status||'').toLowerCase();
  const live=['en_route','arrived','started','in_progress','in_field','on_site'];
  return live.includes(field)||live.includes(status);
 }).length;
 const assigned=appointments.filter(a=>a.assigned_employee_id&&!['completed','cancelled'].includes(a.status)).length;
 const d2d=appointments.filter(a=>a.source_channel==='d2d').length;
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(6-i));const k=localDateKey(d);const rev=payments.filter(p=>isSettledPayment(p.status)&&localDateKey(p.created_at)===k).reduce((n,p)=>n+Number(p.amount||0),0);return{label:d.toLocaleDateString('en-US',{weekday:'short'}),rev}});
 const next=jobs.find(j=>new Date(j.scheduled_at||0).getTime()>=now)||jobs[0];
 const go=(view:string,filter?:'unassigned'|'run'|'collect',jobId?:string)=>{if(filter)setOwnerBoardFilter(filter);if(jobId)setOwnerFocusJob(jobId);if(onNavigate){onNavigate(view);return;}const u=new URL(window.location.href);u.searchParams.set('view',view);window.history.pushState({},'',u.toString())};
 const hour=new Date().getHours(),greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
 const name=firstWord(ownerName,'there');
 const exceptions=[
  unassigned?{n:unassigned,title:'Unassigned jobs',sub:'Need a technician',view:'dispatch',hot:true}:null,
  unpaid.length?{n:unpaid.length,title:'Unpaid finished jobs',sub:'Collect before the van leaves',view:'dispatch',hot:true}:null,
  leadSnap.hot?{n:leadSnap.hot,title:'Hot leads',sub:'Ready to book from the map',view:'leads',hot:true}:null,
  packets?{n:packets,title:'Open Gusto packets',sub:'Personal, W-4, payment, or I-9 still open',view:'employees',hot:true}:null,
  pending?{n:pending,title:'Pending bookings',sub:'Awaiting confirmation',view:'appointments',hot:false}:null,
  qc?{n:qc,title:'QC queue',sub:'Jobs waiting for quality review',view:'dispatch',hot:false}:null,
 ].filter(Boolean) as {n:number;title:string;sub:string;view:string;hot:boolean}[];
 const fieldLoop=[
  {key:'knock',n:leadSnap.knocked,label:'Knock',sub:'Contacted today',view:'leads' as const,filter:undefined as undefined|'unassigned'|'run'|'collect'},
  {key:'book',n:pending,label:'Book',sub:'Waiting confirm',view:'appointments' as const,filter:undefined},
  {key:'assign',n:unassigned,label:'Assign',sub:'Need a tech',view:'dispatch' as const,filter:'unassigned' as const},
  {key:'run',n:inField,label:'Run',sub:'On the road',view:'dispatch' as const,filter:'run' as const},
  {key:'collect',n:unpaid.length,label:'Collect',sub:'Still unpaid',view:'dispatch' as const,filter:'collect' as const},
 ];
 const nextMoves=[
  !crew.length?{view:'employees',title:'Invite a technician',sub:'No hired crew yet. The Owner field profile is not a technician.'}:null,
  !appointments.length?{view:'appointments',title:'Book the first job',sub:'Nothing on the calendar. Book here or send a customer to the portal.'}:null,
  {view:'leads',title:'Open D2D field',sub:'Knock, book, and the job lands on Dispatch.'},
  {view:'dispatch',title:unassigned?`Assign ${unassigned} job${unassigned===1?'':'s'}`:'Assign work',sub:unassigned?'Booked and waiting on a tech.':'Put a technician on the next stop.',filter:'unassigned' as const},
  unpaid.length?{view:'dispatch',title:`Collect ${unpaid.length}`,sub:'Finished work still unpaid.',filter:'collect' as const}:null,
 ].filter(Boolean) as {view:string;title:string;sub:string;filter?:'unassigned'|'run'|'collect'}[];
 const teamRows=[...crew].sort((a,b)=>{
  const ao=packetOpen(a)?0:1;
  const bo=packetOpen(b)?0:1;
  return ao-bo;
 }).slice(0,6);
 return <div className="tab-content phase300 v2-page owner-command-v17">
   <a className="skip-to-workspace in-page" href="#owner-schedule">Skip to today’s schedule</a>
   <div className="owner-command-head">
     <div>
       <img className="owner-command-lockup" src={BRAND_LOCKUP} alt="NS Auto Luxe Premium Detailing"/>
       <span className="eyebrow">OWNER / COMMAND CENTER</span>
       <h2>{greeting}, <em>{name}</em></h2>
       <p>Knock, book, assign, run, collect — then the numbers.</p>
     </div>
     <div className="nsos-quick">
       <button type="button" onClick={()=>{try{sessionStorage.setItem('ns-compose-lead','1')}catch{} go('leads')}}><Target size={16}/>New Lead</button>
       <button type="button" onClick={()=>go('appointments')}><Plus size={16}/>Book</button>
       <button type="button" onClick={()=>go('dispatch')}><CalendarClock size={16}/>Assign</button>
       <button type="button" onClick={()=>go('messages')}><MessageSquare size={16}/>Message</button>
     </div>
   </div>
   <nav className="nsos-owner-jump" aria-label="Jump to owner sections">
     <a href="#owner-field-loop">Field loop</a>
     <a href="#owner-exceptions">Needs you</a>
     <a href="#owner-schedule">Today</a>
     <a href="#owner-revenue">Revenue</a>
     <a href="#owner-pipeline">Pipeline</a>
     <button type="button" onClick={()=>go('schedule')}>Open calendar</button>
     <button type="button" onClick={()=>go('employees')}>Open team</button>
     <button type="button" onClick={()=>go('retention')}>Referrals</button>
   </nav>
   <div className="ns-field-loop" id="owner-field-loop" aria-label="Field loop">
     {fieldLoop.map((step,i)=><button type="button" key={step.key} className={step.n?'hot':''} onClick={()=>go(step.view,step.filter)}><em>{step.n}</em><span><b>{step.label}</b><small>{step.sub}</small></span>{i<fieldLoop.length-1&&<i className="ns-field-loop-arrow" aria-hidden/>}</button>)}
   </div>
   <div className="nsos-alerts" id="owner-exceptions">
     {exceptions.length===0&&<div className="ns-next-actions">
       <p className="ns-next-lead">The board is quiet. Pick a next move from live company data.</p>
       {nextMoves.map(item=><button type="button" className="nsos-alert" key={item.title} onClick={()=>go(item.view,item.filter)}><span><b>{item.title}</b><small>{item.sub}</small></span><ChevronRight size={16}/></button>)}
     </div>}
     {exceptions.map(item=><button className={`nsos-alert ${item.hot?'hot':''}`} key={item.title} onClick={()=>go(item.view,item.title.includes('Unpaid')?'collect':item.view==='dispatch'&&item.title.includes('Unassigned')?'unassigned':undefined)}><em>{item.n}</em><span><b>{item.title}</b><small>{item.sub}</small></span><ChevronRight size={16}/></button>)}
   </div>
   <div className="owner-kpis-v17">
     <KPI label="Collected" value={money(collected)} detail={trendLabel(todayCollected,earlierCollected)} onOpen={()=>go('payments')}/>
     <KPI label="Jobs completed" value={String(completedToday.length)} detail={completedToday.length?`${completedToday.length} today`:'None finished today'} onOpen={()=>go('appointments')}/>
     <KPI label="New leads" value={String(leadSnap.neu)} detail={leadSnap.open?`${leadSnap.open} open in pipeline`:undefined} onOpen={()=>go('leads')}/>
     <KPI label="Avg completed job" value={money(avgTicket)} detail={`${completed.length} completed`} onOpen={()=>go('reports')}/>
   </div>
   <section id="owner-glance" className="owner-glance-v17">
     <div><CalendarClock/><span><b>{jobs.length}</b><small>Jobs today</small></span></div>
     <div><DollarSign/><span><b>{money(scheduled)}</b><small>Booked today</small></span></div>
     <div><Users/><span><b>{customers.length}</b><small>Customers</small></span></div>
     <div><Clock3/><span><b>{next?time(next.scheduled_at):'—'}</b><small>{next?`${next.service_name} · ${appointmentPartyName(next)}`:'No next job'}</small></span></div>
   </section>
   <div className="owner-command-grid-v17">
    <section id="owner-schedule" className="phase-panel owner-schedule-v17"><div className="phase-panel-head"><div><span className="eyebrow">TODAY'S SCHEDULE</span><h3>{jobs.length} jobs</h3></div><button className="btn-outline btn-sm" onClick={()=>go('schedule')}>View all</button></div>{jobs.slice(0,6).map(j=>{const live=j.field_status||j.status;return <button className="owner-job-v17" key={j.id} onClick={()=>go('dispatch',canCollectJob(j)?'collect':!j.assigned_employee_id?'unassigned':undefined,j.id)}><time>{time(j.scheduled_at)}</time><span><b>{appointmentPartyName(j)}</b><small>{j.vehicle_info||'Vehicle not added'}</small></span><span><b>{j.service_name}</b><small>{money(Number(j.price||0))}</small></span><span><small>{j.assigned_employee_id?employees.find(e=>e.id===j.assigned_employee_id)?.name||'Assigned':'Unassigned'}</small><b className={`status-badge badge-${live==='completed'||live==='finished'?'green':live==='cancelled'?'red':['en_route','arrived','started','in_progress'].includes(String(live||''))?'purple':'blue'}`}>{humanStatus(live)}</b></span></button>})}{!jobs.length&&<div className="ns-empty"><strong>{crew.length?'Crew is idle today':'No appointments today'}</strong><p>{crew.length?'Nobody is on the calendar. Book a job or open D2D so the next visit lands here.':'Hire a technician, then book the first job — the Owner field profile is not a crew.'}</p><div className="ns-empty-actions"><button type="button" className="btn-primary" onClick={()=>go(crew.length?'appointments':'employees')}>{crew.length?'Book':'Invite a technician'}</button><button type="button" className="btn-outline" onClick={()=>go('leads')}>Open D2D</button></div></div>}</section>
    <section id="owner-revenue" className="phase-panel owner-revenue-v17"><div className="phase-panel-head"><div><span className="eyebrow">COLLECTED</span><h3>{money(collected)}</h3></div><small>Settled payments on the board</small></div><OwnerRevenueChart days={days}/><div className="owner-mini-metrics"><div><small>Today</small><b>{money(todayCollected)}</b></div><div><small>Avg ticket</small><b>{money(avgTicket)}</b></div><div><small>Days shown</small><b>7</b></div></div></section>
   </div>
   <div className="owner-bottom-v17 v20-owner-bottom">
     <section id="owner-pipeline" className="phase-panel v20-pipeline-panel"><div className="phase-panel-head"><div><span className="eyebrow">SALES PIPELINE</span><h3>Booking flow</h3></div></div><div className="v20-stage-flow"><div><span>D2D</span><b>{d2d||leadSnap.open}</b></div><i/><div><span>Pending</span><b>{pending}</b></div><i/><div><span>Assigned</span><b>{assigned}</b></div><i/><div><span>Completed</span><b>{completedToday.length}</b></div></div><button className="btn-outline btn-sm" style={{marginTop:14}} onClick={()=>go('leads')}>Open pipeline</button></section>
     <section id="owner-team" className="phase-panel v20-team-panel"><div className="phase-panel-head"><div><span className="eyebrow">TEAM STATUS</span><h3>{crew.length} hired</h3></div><button className="btn-outline btn-sm" onClick={()=>go('employees')}>Directory</button></div><div className="v20-team-list">{teamRows.map(e=><button type="button" key={e.id} onClick={()=>go('employees')}><EmployeeAvatar employee={e} size="sm" className="v23-team-avatar"/><span><b>{e.name}</b><small>{packetOpen(e)?'Onboarding packet':humanStatus(e.role)}</small></span><i className={packetOpen(e)?'packet':e.status==='active'?'online':''}/></button>)}{!crew.length&&<div className="v20-dark-empty">No hired technicians yet. Invite from People — the Owner field profile does not count as crew.</div>}</div></section>
     <section className="phase-panel v20-health-panel"><div className="phase-panel-head"><div><span className="eyebrow">BUSINESS HEALTH</span><h3>On the board</h3></div></div><div className="owner-summary-cells nsos-health-cells"><div><b>{money(collected)}</b><small>Collected</small></div><div><b>{inField}</b><small>In the field</small></div><div><b>{money(avgTicket)}</b><small>Avg ticket</small></div><div><b>{unpaid.length}</b><small>Unpaid</small></div></div></section>
   </div>
 </div>;
}

function polygonOverlap(a:[number,number][],b:[number,number][]) {
  if(a.some(p=>pointInPolygon(p[0],p[1],b))||b.some(p=>pointInPolygon(p[0],p[1],a)))return true;
  const orient=(p:[number,number],q:[number,number],r:[number,number])=>(q[1]-p[1])*(r[0]-q[0])-(q[0]-p[0])*(r[1]-q[1]);
  const intersects=(p1:[number,number],q1:[number,number],p2:[number,number],q2:[number,number])=>{const o1=orient(p1,q1,p2),o2=orient(p1,q1,q2),o3=orient(p2,q2,p1),o4=orient(p2,q2,q1);return (o1>0)!==(o2>0)&&(o3>0)!==(o4>0)};
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(intersects(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
  return false;
}
