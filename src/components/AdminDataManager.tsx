import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckSquare, Database, RefreshCw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type DataManagerSection =
  | 'dashboard'|'customers'|'appointments'|'schedule'|'availability'|'archived'|'employees'|'recruiting'
  | 'staff_schedule'|'timeclock'|'finance'|'sales'|'inventory'|'pay_settings'|'job_assignments'|'leads'
  | 'territories'|'tasks'|'equipment'|'documents'|'reports'|'permissions'|'notifications'|'time_off'
  | 'payroll_approval'|'audit'|'payments'|'visitors'|'command_center'|'crm'|'dispatch'|'crews'|'fleet'
  | 'locations'|'marketing'|'automations'|'approvals'|'incidents'|'training'|'purchasing'|'communications'
  | 'messages'|'retention'|'continuity';

type TableDef={table:string;label:string;description:string;protected?:boolean;archive?:boolean};

const SECTIONS:Record<DataManagerSection,TableDef[]>={
  dashboard:[{table:'appointments',label:'Appointments',description:'Bookings and jobs'},{table:'business_notifications',label:'Notifications',description:'Operational alerts'},{table:'business_tasks',label:'Tasks',description:'Open business tasks'}],
  command_center:[{table:'appointments',label:'Appointments',description:'Jobs and bookings'},{table:'business_tasks',label:'Tasks',description:'Owner attention items'},{table:'crew_alerts',label:'Crew alerts',description:'Crew attention items'}],
  customers:[{table:'profiles',label:'Customer accounts',description:'Registered customer profiles'},{table:'customer_vehicles',label:'Vehicles',description:'Saved customer vehicles'},{table:'crm_notes',label:'CRM notes',description:'Customer notes'}],
  crm:[{table:'profiles',label:'Customer accounts',description:'Registered customer profiles'},{table:'crm_notes',label:'CRM notes',description:'Customer timeline notes'},{table:'customer_vehicles',label:'Vehicles',description:'Customer vehicles'}],
  appointments:[{table:'appointments',label:'Appointments',description:'Bookings, jobs and test appointments'}],
  schedule:[{table:'appointments',label:'Appointments',description:'Customer schedule records'}],
  availability:[{table:'availability',label:'Availability',description:'Availability blocks'}],
  archived:[{table:'appointments',label:'Appointments',description:'Cancelled/completed records'},{table:'leads',label:'Leads',description:'Archived/protected leads'}],
  fleet:[{table:'profiles',label:'Customer accounts',description:'Fleet/customer accounts'},{table:'customer_vehicles',label:'Fleet vehicles',description:'Saved vehicles'}],
  employees:[{table:'employees',label:'Employees',description:'Employee and test employee records'},{table:'employee_documents',label:'Documents',description:'Employee files'}],
  crews:[{table:'crew_groups',label:'Crews',description:'Crew groups'},{table:'crew_alerts',label:'Crew alerts',description:'Crew alerts'},{table:'crew_coaching_notes',label:'Coaching notes',description:'Manager coaching notes'}],
  recruiting:[{table:'recruiting_candidates',label:'Candidates',description:'Applicants and test applicants'},{table:'recruiting_events',label:'Recruiting events',description:'Applicant activity'}],
  messages:[{table:'employee_messages',label:'Messages',description:'Internal team messages'},{table:'employee_message_channels',label:'Channels',description:'Custom/team channels'}],
  staff_schedule:[{table:'employee_shifts',label:'Employee shifts',description:'Scheduled shifts'}],
  timeclock:[{table:'time_entries',label:'Time entries',description:'Timecard history',protected:true},{table:'time_entry_breaks',label:'Breaks',description:'Recorded breaks',protected:true}],
  time_off:[{table:'time_off_requests',label:'Time-off requests',description:'PTO/time-off requests'}],
  payroll_approval:[{table:'time_entries',label:'Time entries',description:'Payroll source records',protected:true},{table:'payroll_runs',label:'Payroll runs',description:'Payroll history',protected:true}],
  training:[{table:'training_courses',label:'Courses',description:'Training courses'},{table:'training_assignments',label:'Assignments',description:'Employee course assignments'},{table:'training_attempts',label:'Attempts',description:'Quiz/course attempts'}],
  sales:[{table:'sales_records',label:'Sales records',description:'D2D sales attribution',protected:true},{table:'d2d_daily_goals',label:'D2D goals',description:'Rep goal records'}],
  leads:[{table:'leads',label:'Leads',description:'Field leads and test leads',archive:true},{table:'lead_activities',label:'Lead activity',description:'Lead history'},{table:'lead_contact_attempts',label:'Contact attempts',description:'Lead contact history'}],
  territories:[{table:'lead_territories',label:'Territories',description:'Territories and test territories',archive:true},{table:'territory_doors',label:'Territory houses',description:'Mapped house records'},{table:'territory_routes',label:'Routes',description:'Saved territory routes'}],
  marketing:[{table:'marketing_campaigns',label:'Campaigns',description:'Marketing campaigns'}],
  retention:[{table:'subscriptions',label:'Subscriptions',description:'Membership/subscription records',protected:true},{table:'leads',label:'Leads',description:'Retention/reactivation leads',archive:true}],
  dispatch:[{table:'appointments',label:'Appointments',description:'Dispatch jobs'},{table:'business_tasks',label:'Tasks',description:'Dispatch tasks'}],
  job_assignments:[{table:'appointments',label:'Appointments',description:'Assigned jobs'}],
  inventory:[{table:'inventory_items',label:'Inventory',description:'Inventory items'}],
  equipment:[{table:'equipment_assets',label:'Equipment',description:'Equipment and asset records'},{table:'vehicle_inspections',label:'Inspections',description:'Vehicle/equipment inspections'}],
  tasks:[{table:'business_tasks',label:'Tasks',description:'Operations tasks'}],
  documents:[{table:'employee_documents',label:'Documents',description:'Employee/recruiting documents'}],
  notifications:[{table:'business_notifications',label:'Notifications',description:'Internal notifications'}],
  purchasing:[{table:'purchase_requests',label:'Purchase requests',description:'Purchasing requests'}],
  incidents:[{table:'incident_reports',label:'Incidents',description:'Incident reports'}],
  approvals:[{table:'purchase_requests',label:'Purchase requests',description:'Purchasing approvals'},{table:'time_off_requests',label:'Time-off',description:'Time-off approvals'}],
  finance:[{table:'expenses',label:'Expenses',description:'Expense records',protected:true},{table:'payments',label:'Payments',description:'Payment history',protected:true},{table:'payroll_runs',label:'Payroll runs',description:'Payroll history',protected:true}],
  payments:[{table:'payments',label:'Payments',description:'Payment transaction history',protected:true}],
  reports:[{table:'sales_records',label:'Sales records',description:'Reporting source records',protected:true},{table:'payments',label:'Payments',description:'Reporting source records',protected:true}],
  pay_settings:[{table:'pay_settings',label:'Pay settings',description:'Compensation configuration'}],
  permissions:[{table:'profiles',label:'Portal accounts',description:'Portal user profiles'}],
  communications:[{table:'communication_templates',label:'Templates',description:'Email communication templates',archive:true},{table:'communication_logs',label:'Delivery log',description:'Email delivery history',protected:true}],
  automations:[{table:'automation_rules',label:'Automation rules',description:'Automation rules',archive:true},{table:'automation_events',label:'Automation events',description:'Automation execution history'}],
  locations:[{table:'rep_locations',label:'Rep locations',description:'Field GPS history'}],
  continuity:[{table:'audit_logs',label:'Audit history',description:'Protected system history',protected:true}],
  audit:[{table:'audit_logs',label:'Audit history',description:'Protected system history',protected:true}],
  visitors:[{table:'site_visits',label:'Site visits',description:'Site analytics events'}],
};

function labelOf(row:any){
  return row?.name||row?.title||row?.customer_name||row?.full_name||row?.email||row?.address||row?.service_name||row?.item_name||row?.module_name||row?.slug||row?.id||'Record';
}
function detailOf(row:any){
  const values=[row?.status,row?.role,row?.email,row?.phone,row?.description,row?.subject,row?.created_at].filter(Boolean).map(String);
  return values.slice(0,3).join(' · ');
}
function looksTest(row:any){
  return JSON.stringify(row).toLowerCase().match(/\b(test|testing|demo|sample|dummy|fake)\b/)!=null;
}

export default function AdminDataManager({section,label,onClose}:{section:DataManagerSection;label:string;onClose:()=>void}){
  const defs=SECTIONS[section]||[];
  const [active,setActive]=useState(defs[0]?.table||'');
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [testOnly,setTestOnly]=useState(false);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [changed,setChanged]=useState(false);
  const def=defs.find(d=>d.table===active)||defs[0];

  const load=async()=>{
    if(!active)return;
    setLoading(true);setError('');setSelected(new Set());
    const {data,error}=await supabase.functions.invoke('admin-data-manager',{body:{action:'list',table:active,limit:250}});
    if(error){setError(error.message);setRows([])}
    else if(data?.error){setError(data.error);setRows([])}
    else setRows(data?.rows||[]);
    setLoading(false);
  };
  useEffect(()=>{setActive(defs[0]?.table||'')},[section]);
  useEffect(()=>{if(active)load()},[active]);

  const filtered=useMemo(()=>rows.filter(r=>(!testOnly||looksTest(r))&&(!query||JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))),[rows,query,testOnly]);
  const allSelected=filtered.length>0&&filtered.every(r=>selected.has(String(r.id)));
  const toggle=(id:string)=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n});

  const act=async(action:'delete'|'archive',ids:string[])=>{
    if(!ids.length||!def)return;
    const permanent=action==='delete';
    const phrase=permanent?'DELETE':'ARCHIVE';
    const warning=permanent?`Permanently delete ${ids.length} record${ids.length===1?'':'s'} from ${def.label}? This cannot be undone.`:`Archive ${ids.length} record${ids.length===1?'':'s'} from ${def.label}?`;
    if(!confirm(warning))return;
    if(permanent&&ids.length>1){const typed=prompt(`Type ${phrase} to confirm bulk deletion.`);if(typed!==phrase)return;}
    setLoading(true);setError('');
    const {data,error}=await supabase.functions.invoke('admin-data-manager',{body:{action,table:def.table,ids}});
    if(error)setError(error.message);else if(data?.error)setError(data.error);else{setChanged(true);await load()}
    setLoading(false);
  };

  const close=()=>{onClose();if(changed)setTimeout(()=>window.location.reload(),50)};
  return <div className="data-manager-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <section className="data-manager-shell" role="dialog" aria-modal="true">
      <header className="data-manager-header"><div><span className="eyebrow">ADMIN DATA CONTROL</span><h2>Manage {label}</h2><p>Remove test records, archive working records, and protect financial/audit history.</p></div><button className="icon-btn" onClick={close}><X size={20}/></button></header>
      <div className="data-manager-tabs">{defs.map(d=><button key={d.table} className={active===d.table?'active':''} onClick={()=>setActive(d.table)}><Database size={14}/><span>{d.label}</span>{d.protected&&<ShieldAlert size={13}/>}</button>)}</div>
      {!defs.length?<div className="data-manager-empty"><Database size={34}/><h3>No removable records for this workspace</h3><p>This page is calculated from other protected business data.</p></div>:<>
      <div className="data-manager-toolbar"><div className="search-control"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${def?.label||'records'}…`}/></div><button className={testOnly?'btn-outline active':'btn-outline'} onClick={()=>setTestOnly(v=>!v)}>Test data only</button><button className="btn-outline" onClick={load} disabled={loading}><RefreshCw size={14}/>Refresh</button></div>
      {def?.protected&&<div className="data-manager-protected"><ShieldAlert size={17}/><div><strong>History protected</strong><span>These records affect money, payroll, compliance, or audit history and cannot be permanently deleted here.</span></div></div>}
      {error&&<div className="data-manager-error">{error}</div>}
      <div className="data-manager-list-head"><button onClick={()=>setSelected(allSelected?new Set():new Set(filtered.map(r=>String(r.id))))}><CheckSquare size={15}/>{allSelected?'Clear':'Select visible'}</button><span>{filtered.length} records</span><div>{selected.size>0&&<><strong>{selected.size} selected</strong>{def?.archive&&<button className="btn-outline" onClick={()=>act('archive',[...selected])}><Archive size={14}/>Archive</button>}{!def?.protected&&<button className="btn-danger-soft" onClick={()=>act('delete',[...selected])}><Trash2 size={14}/>Delete</button>}</>}</div></div>
      <div className="data-manager-list">{loading?<div className="data-manager-loading"><RefreshCw className="spin" size={20}/>Loading records…</div>:filtered.length?filtered.map(row=>{const id=String(row.id);return <article key={id} className={`data-manager-row ${selected.has(id)?'selected':''}`}><input type="checkbox" checked={selected.has(id)} onChange={()=>toggle(id)}/><div className="data-manager-record"><strong>{labelOf(row)}</strong><span>{detailOf(row)||id}</span>{looksTest(row)&&<small>TEST-LIKE RECORD</small>}</div><div className="data-manager-row-actions">{def?.archive&&<button title="Archive" onClick={()=>act('archive',[id])}><Archive size={15}/></button>}{!def?.protected&&<button className="danger" title="Permanently delete" onClick={()=>act('delete',[id])}><Trash2 size={15}/></button>}</div></article>}):<div className="data-manager-empty"><Database size={28}/><h3>No matching records</h3><p>{testOnly?'No records look like test/demo data.':'Nothing found for this section.'}</p></div>}</div>
      </>}
    </section>
  </div>;
}
