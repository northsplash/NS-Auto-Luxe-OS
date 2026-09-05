import { useMemo, useState } from 'react';
import { Target, Users, Car, TrendingUp, DollarSign, ShieldCheck, ArrowRight, AlertTriangle, Save, SlidersHorizontal, RotateCcw, Pencil, X } from 'lucide-react';
import { buildOwnerPlan, ownerMoney, OwnerPlanningConfig, OwnerWeekOverride } from '@/lib/ownerPlanning';
import { useOwnerPlanning } from '@/hooks/useOwnerPlanning';

type Horizon = '90' | 'y1' | 'y2';

function NumberField({ label, value, onChange, suffix, min = 0, step = 1 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; step?: number }) {
  return <label className="owner-edit-field"><span>{label}</span><div><input type="number" min={min} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/>{suffix&&<small>{suffix}</small>}</div></label>;
}

export default function OwnerGrowthPlanner(){
 const planState=useOwnerPlanning();
 const {config,loading,saving,dirty,error,savedAt,update,setWeekOverride,clearWeekOverride,save,reset}=planState;
 const [horizon,setHorizon]=useState<Horizon>('y1');
 const [editing,setEditing]=useState(false);
 const [editWeek,setEditWeek]=useState<number|null>(null);
 const plan=useMemo(()=>buildOwnerPlan(config),[config]);
 const visible=plan.slice(0,horizon==='90'?13:horizon==='y1'?52:104);
 const final=visible.at(-1)||plan[0];
 const milestones=visible.filter(w=>w.event||w.note);
 const activeOverride=editWeek?config.weeklyOverrides[String(editWeek)]||{}:null;
 const week=editWeek?plan.find(w=>w.n===editWeek):null;
 const setNum=(k:keyof OwnerPlanningConfig,v:number)=>update(k,v as never);
 const setO=(k:keyof OwnerWeekOverride,v:number|string|undefined)=>editWeek&&setWeekOverride(editWeek,{[k]:v});
 if(loading)return <div className="tab-content owner-growth-page"><div className="owner-loading">Loading shared owner growth plan…</div></div>;
 return <div className="tab-content owner-growth-page">
   <header className="owner-growth-head"><div><span className="eyebrow">OWNER ONLY · STARTING SEP 30, 2026</span><h1>Growth Planner</h1><p>Fully editable growth plan for North Splash Auto Luxe. Change demand, staffing, capacity, compensation, costs or any individual week and save the shared plan for both 50/50 owners.</p></div><div className="owner-plan-actions"><button className="btn-outline" onClick={()=>setEditing(v=>!v)}><SlidersHorizontal size={17}/> Edit plan</button><button className="btn-primary" disabled={!dirty||saving} onClick={()=>void save()}><Save size={17}/>{saving?'Saving…':dirty?'Save changes':'Saved'}</button></div></header>
   {(error||savedAt)&&<div className={`owner-save-status ${error?'error':''}`}>{error||`Shared plan saved ${new Date(savedAt).toLocaleString()}`}</div>}
   {editing&&<section className="owner-plan-editor"><div className="owner-plan-editor-head"><div><span className="eyebrow">GLOBAL ASSUMPTIONS</span><h2>Edit the growth engine</h2><p>These values set the baseline. Weekly overrides below can replace staffing, jobs, revenue drivers and costs for any specific week.</p></div><button className="btn-outline" onClick={reset}><RotateCcw size={15}/> Reset defaults</button></div><div className="owner-profit-settings-grid">
    <NumberField label="Starting jobs / week" value={config.jobsPerOwnerWeek} onChange={v=>setNum('jobsPerOwnerWeek',v)}/>
    <NumberField label="Weekly demand growth" value={config.leadGrowthPct} onChange={v=>setNum('leadGrowthPct',v)} suffix="%" step={0.05}/>
    <NumberField label="Average ticket" value={config.avgTicket} onChange={v=>setNum('avgTicket',v)} suffix="$"/>
    <NumberField label="Owner-operated weeks" value={config.ownerOperatedWeeks} onChange={v=>setNum('ownerOperatedWeeks',v)} />
    <NumberField label="Starting detailers" value={config.startingDetailers} onChange={v=>setNum('startingDetailers',v)} />
    <NumberField label="Starting D2D reps" value={config.startingD2D} onChange={v=>setNum('startingD2D',v)} />
    <NumberField label="Starting managers" value={config.startingManagers} onChange={v=>setNum('startingManagers',v)} />
    <label className="owner-edit-field"><span>Automatic hiring</span><select value={config.autoHiringEnabled?'1':'0'} onChange={e=>setNum('autoHiringEnabled',Number(e.target.value))}><option value="1">On — use triggers</option><option value="0">Off — manual staffing only</option></select></label>
    <NumberField label="Detailer capacity" value={config.detailerCapacityJobs} onChange={v=>setNum('detailerCapacityJobs',v)} suffix="jobs / week"/>
    <NumberField label="D2D capacity" value={config.d2dCapacityJobs} onChange={v=>setNum('d2dCapacityJobs',v)} suffix="jobs / rep"/>
    <NumberField label="First detailer trigger" value={config.hireDetailerAtJobs} onChange={v=>setNum('hireDetailerAtJobs',v)} suffix="jobs / week"/>
    <NumberField label="First D2D trigger" value={config.hireD2DAtJobs} onChange={v=>setNum('hireD2DAtJobs',v)} suffix="jobs / week"/>
    <NumberField label="Manager trigger" value={config.managerAtEmployees} onChange={v=>setNum('managerAtEmployees',v)} suffix="employees"/>
    <NumberField label="Doors per booked job" value={config.doorsPerJob} onChange={v=>setNum('doorsPerJob',v)} />
    <NumberField label="Vehicle / equipment reserve" value={config.vehicleCost} onChange={v=>setNum('vehicleCost',v)} suffix="$"/>
    <NumberField label="Reserve interval" value={config.vehicleReserveEveryWeeks} onChange={v=>setNum('vehicleReserveEveryWeeks',v)} suffix="weeks; 0 disables"/>
   </div></section>}
   <div className="owner-growth-horizon"><button className={horizon==='90'?'active':''} onClick={()=>setHorizon('90')}>First 90 Days</button><button className={horizon==='y1'?'active':''} onClick={()=>setHorizon('y1')}>Year 1</button><button className={horizon==='y2'?'active':''} onClick={()=>setHorizon('y2')}>Year 2</button></div>
   <div className="owner-growth-kpis"><div><Target/><span>Target jobs / week</span><strong>{final.jobs}</strong><small>{Math.round(final.capacity)} weekly capacity</small></div><div><DollarSign/><span>Target weekly revenue</span><strong>{ownerMoney(final.revenue)}</strong><small>{ownerMoney(final.avgTicket)} average ticket</small></div><div><Users/><span>Planned employees</span><strong>{final.employeeCount}</strong><small>{final.detailers} detailers · {final.d2d} D2D · {final.managers} managers</small></div><div><TrendingUp/><span>D2D activity target</span><strong>{final.doors}</strong><small>doors / week</small></div></div>
   <section className="owner-growth-phases"><div className="owner-growth-section-title"><span className="eyebrow">ROADMAP</span><h2>Owner workload → operating company</h2></div><div className="owner-growth-phase-grid">
    <article><span className="owner-growth-phase-number">01</span><ShieldCheck size={22}/><small>Weeks 1–{config.ownerOperatedWeeks}</small><h3>Owner-operated launch</h3><p>You lead D2D/customer acquisition while your 50/50 partner handles detailing. Change the owner-only period at any time.</p></article>
    <article><span className="owner-growth-phase-number">02</span><Users size={22}/><small>Demand triggers</small><h3>First crew</h3><p>Default triggers: detailer at {config.hireDetailerAtJobs} jobs/week, D2D at {config.hireD2DAtJobs}. Turn auto hiring off for a completely manual plan.</p></article>
    <article><span className="owner-growth-phase-number">03</span><Target size={22}/><small>Team trigger</small><h3>Operations layer</h3><p>Management defaults to one manager per {config.managerAtEmployees} employees, but each week can be overridden.</p></article>
    <article><span className="owner-growth-phase-number">04</span><Car size={22}/><small>Year 1 → 2</small><h3>Capacity expansion</h3><p>Weekly overrides let you force extra crews, jobs, doors, costs and notes wherever your real plan differs from the model.</p></article>
   </div></section>
   <div className="owner-growth-two-col"><section className="owner-growth-panel"><div className="owner-growth-section-title"><span className="eyebrow">SCALE TRIGGERS</span><h2>Hiring, equipment & custom milestones</h2></div><div className="owner-growth-milestones">{milestones.length?milestones.slice(0,24).map(w=><div key={w.n}><span>W{w.n}</span><div><strong>{w.note||w.event}</strong><small>{w.jobs} jobs/wk · {ownerMoney(w.revenue)}/wk · {w.employeeCount} employees</small></div><ArrowRight size={16}/></div>):<p>No milestones inside this horizon with the current plan.</p>}</div></section>
   <section className="owner-growth-panel"><div className="owner-growth-section-title"><span className="eyebrow">EDITABILITY</span><h2>What you can change</h2></div><div className="owner-growth-rules"><div><Users/><p><strong>Staffing</strong><span>Detailers, D2D reps and managers globally or on any individual week.</span></p></div><div><TrendingUp/><p><strong>Volume</strong><span>Jobs, ticket value, demand growth, doors and production capacity.</span></p></div><div><DollarSign/><p><strong>Costs & pay</strong><span>Wages, commission, fixed/variable costs, one-time costs, tax reserve and owner distributions.</span></p></div><div><AlertTriangle/><p><strong>Manual overrides win</strong><span>A weekly value you enter replaces the automatic model for that week.</span></p></div></div></section></div>
   <section className="owner-growth-weekly"><div className="owner-growth-section-title"><div><span className="eyebrow">WEEKLY PLAN</span><h2>Day One → {horizon==='90'?'90 Days':horizon==='y1'?'Year One':'Year Two'}</h2></div><small>Tap Edit on any week to override the model.</small></div><div className="owner-growth-week-list">{visible.map(w=><article key={w.n} className={w.overridden?'overridden':''}><div><span>Week {w.n}</span>{w.overridden&&<b>Custom</b>}{(w.note||w.event)&&<b>{w.note||w.event}</b>}</div><strong>{w.jobs} jobs</strong><span>{ownerMoney(w.revenue)}</span><span>{w.doors} doors</span><small>{w.employeeCount===0?'Owners only':`${w.detailers} detailer · ${w.d2d} D2D · ${w.managers} mgr`}</small><button className="owner-week-edit" onClick={()=>setEditWeek(w.n)}><Pencil size={13}/> Edit</button></article>)}</div></section>
   {editWeek&&week&&activeOverride&&<div className="owner-week-modal-backdrop" onClick={()=>setEditWeek(null)}><div className="owner-week-modal" onClick={e=>e.stopPropagation()}><div className="owner-week-modal-head"><div><span className="eyebrow">WEEK {editWeek}</span><h3>Edit weekly plan</h3><p>Leave a field blank to use the global model. Staffing overrides persist into later weeks until the model or another override changes them.</p></div><button onClick={()=>setEditWeek(null)}><X size={20}/></button></div><div className="owner-week-edit-grid">
    {([['jobs','Jobs',week.jobs],['avgTicket','Average ticket',week.avgTicket],['doors','Doors',week.doors],['detailers','Detailers',week.detailers],['d2d','D2D reps',week.d2d],['managers','Managers',week.managers],['extraCosts','One-time costs',week.extraCosts]] as const).map(([key,label,current])=><label key={key}><span>{label}<small>Model: {current}</small></span><input type="number" placeholder="Use model" value={(activeOverride as any)[key]??''} onChange={e=>setO(key,e.target.value===''?undefined:Number(e.target.value))}/></label>)}
    <label className="owner-week-note"><span>Owner note / milestone</span><textarea value={activeOverride.note||''} onChange={e=>setO('note',e.target.value||undefined)} placeholder="Example: Buy second van, hire sales ops manager…"/></label>
   </div><div className="owner-week-modal-actions"><button className="btn-outline" onClick={()=>{clearWeekOverride(editWeek);setEditWeek(null)}}>Clear override</button><button className="btn-primary" onClick={()=>{setEditWeek(null);void save()}}><Save size={15}/> Save shared plan</button></div></div></div>}
 </div>
}
