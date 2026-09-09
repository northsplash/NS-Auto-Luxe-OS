import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, CheckCircle2, Clock3, DollarSign, MapPin, Navigation, ShieldCheck, TimerReset, Upload, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Appointment, Employee, JobChecklistItem, JobMedia, VehicleInspection } from '@/lib/supabase';
import { money } from '@/lib/data';
import { appointmentPartyName } from '@/lib/scheduling';
import { checklistForService } from '@/lib/detailCatalog';
import { buildAppleMapsUrl, localDateTime } from '@/lib/fieldOps';
import FieldContactBar from '@/components/FieldContactBar';
import { sendCommunication } from '@/lib/communications';
import { canCollectJob, isJobPaid, markJobCollected, type CollectMethod } from '@/lib/collectPayment';
import SignaturePad from './SignaturePad';

const checklistSeedInFlight = new Set<string>();

const STATUS_ACTIONS=[
  ['en_route','En Route',Navigation],['arrived','Arrived',MapPin],['started','Start Job',Clock3],['finished','Finish Job',CheckCircle2]
] as const;

export default function JobWorkflow({appointment,employee,onUpdate,onClose}:{appointment:Appointment;employee:Employee;onUpdate:(a:Appointment)=>void;onClose?:()=>void}){
  const [job,setJob]=useState(appointment);const [checklist,setChecklist]=useState<JobChecklistItem[]>([]);const [media,setMedia]=useState<JobMedia[]>([]);const [inspection,setInspection]=useState<VehicleInspection|null>(null);const [condition,setCondition]=useState('');const [damage,setDamage]=useState('');const [signature,setSignature]=useState('');const [signer,setSigner]=useState(job.customer_name||'');const [uploading,setUploading]=useState(false);const [busy,setBusy]=useState(false);const [elapsed,setElapsed]=useState(0);const [collectBusy,setCollectBusy]=useState(false);
  const load=async()=>{
    const [c,m,i]=await Promise.all([
      supabase.from('job_checklist_items').select('*').eq('appointment_id',job.id).order('sort_order'),
      supabase.from('job_media').select('*').eq('appointment_id',job.id).order('created_at'),
      supabase.from('vehicle_inspections').select('*').eq('appointment_id',job.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    setMedia(m.data??[]);
    setInspection(i.data??null);
    setCondition(i.data?.condition_summary||'');
    setDamage(i.data?.damage_notes||'');
    const existing=c.data??[];
    if(existing.length){setChecklist(existing);return existing;}
    const steps=checklistForService(job.service_name,job.package_name);
    if(!steps.length){setChecklist([]);return [];}
    const again=await supabase.from('job_checklist_items').select('*').eq('appointment_id',job.id).order('sort_order');
    const seeded=again.data??[];
    if(seeded.length){setChecklist(seeded);return seeded;}
    const rows=steps.map((step,index)=>({appointment_id:job.id,label:step.label,sort_order:30+index*10,required:step.required}));
    const inserted=await supabase.from('job_checklist_items').insert(rows).select().order('sort_order');
    if(!inserted.error&&inserted.data?.length){setChecklist(inserted.data);return inserted.data;}
    const local=steps.map((step,index)=>({
      id:`local-${job.id}-${index}`,
      appointment_id:job.id,
      label:step.label,
      sort_order:30+index*10,
      required:step.required,
      completed:false,
      completed_by:null,
      completed_at:null,
      created_at:new Date().toISOString(),
    }));
    setChecklist(local);
    return local;
  };
  useEffect(()=>{
    if(!job.id)return;
    if(checklistSeedInFlight.has(job.id))return;
    checklistSeedInFlight.add(job.id);
    void load().finally(()=>checklistSeedInFlight.delete(job.id));
  },[job.id,job.service_name,job.package_name]);
  useEffect(()=>{
    if(!job.started_at)return;
    const end=job.finished_at||job.completed_at;
    const update=()=>setElapsed(Math.max(0,(end?new Date(end).getTime():Date.now())-new Date(job.started_at!).getTime()));
    update();
    if(end)return;
    const id=setInterval(update,1000);
    return()=>clearInterval(id);
  },[job.started_at,job.completed_at,job.finished_at]);
  const completedRequired=checklist.filter(c=>c.required).every(c=>c.completed);const beforeCount=media.filter(m=>m.media_type==='before').length;const afterCount=media.filter(m=>m.media_type==='after').length;
  const canFinish=completedRequired&&(!job.before_photos_required||beforeCount>0)&&(!job.after_photos_required||afterCount>0);
  const setStatus=async(status:string)=>{setBusy(true);if(status==='finished'&&!canFinish){setBusy(false);return alert('Complete required checklist items and required before/after photos first.')}const patch:any={field_status:status};if(status==='en_route')patch.en_route_at=new Date().toISOString();if(status==='arrived')patch.arrived_at=new Date().toISOString();if(status==='started'){patch.started_at=job.started_at||new Date().toISOString();patch.status='in_progress';}if(status==='finished'){patch.finished_at=new Date().toISOString();patch.qc_status='pending';}const {data,error}=await supabase.from('appointments').update(patch).eq('id',job.id).select().single();if(error){setBusy(false);return alert(error.message)}setJob(data);onUpdate(data);setBusy(false);const event=status==='en_route'?'detailer_en_route':status==='arrived'?'detailer_arrived':status==='started'?'job_started':null;if(event&&job.customer_email){sendCommunication(event,{appointment_id:job.id,recipient_email:job.customer_email,variables:{customer_name:job.customer_name||'Customer',employee_name:employee.name,service_name:job.service_name,service_address:job.service_address||''}}).catch(console.warn)};if(status==='started')setTimeout(load,350)};
  const toggleChecklist=async(item:JobChecklistItem)=>{const completed=!item.completed;if(String(item.id).startsWith('local-')){setChecklist(p=>p.map(x=>x.id===item.id?{...x,completed,completed_by:completed?employee.id:null,completed_at:completed?new Date().toISOString():null}:x));return;}const patch={completed,completed_by:completed?employee.id:null,completed_at:completed?new Date().toISOString():null};const {data,error}=await supabase.from('job_checklist_items').update(patch).eq('id',item.id).select().single();if(error)return alert(error.message);setChecklist(p=>p.map(x=>x.id===item.id?data:x))};
  const saveInspection=async()=>{const payload={appointment_id:job.id,employee_id:employee.id,condition_summary:condition||null,damage_notes:damage||null};let r;if(inspection?.id)r=await supabase.from('vehicle_inspections').update(payload).eq('id',inspection.id).select().single();else r=await supabase.from('vehicle_inspections').insert(payload).select().single();if(r.error)return alert(r.error.message);setInspection(r.data);alert('Vehicle condition saved.')};
  const upload=async(file:File,type:'before'|'after'|'damage')=>{setUploading(true);try{const ext=file.name.split('.').pop()||'jpg';const path=`${job.id}/${type}/${Date.now()}-${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('job-media').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;const pub=supabase.storage.from('job-media').getPublicUrl(path);const r=await supabase.from('job_media').insert({appointment_id:job.id,employee_id:employee.id,media_type:type,file_url:pub.data.publicUrl,storage_path:path,file_name:file.name,mime_type:file.type}).select().single();if(r.error)throw r.error;setMedia(p=>[...p,r.data])}catch(e:any){alert(e.message||'Upload failed')}finally{setUploading(false)}};
  const saveSignature=async()=>{if(!signature)return alert('Customer signature is required.');const {error}=await supabase.from('job_signatures').insert({appointment_id:job.id,signature_type:'completion',signer_name:signer||job.customer_name||'Customer',signature_data:signature});if(error)return alert(error.message);const {data}=await supabase.from('appointments').update({customer_signature:signature,customer_signature_at:new Date().toISOString()}).eq('id',job.id).select().single();if(data){setJob(data);onUpdate(data)}alert('Customer completion signature saved.')};
  const addChecklist=async()=>{const label=window.prompt('Checklist item');if(!label)return;const {data,error}=await supabase.from('job_checklist_items').insert({appointment_id:job.id,label,sort_order:(checklist.at(-1)?.sort_order||0)+10,required:true}).select().single();if(error)return alert(error.message);setChecklist(p=>[...p,data])};
  const duration=job.actual_duration_minutes||Math.round(elapsed/60000);
  const liveStep=job.field_status==='finished'||job.status==='completed'?4:job.field_status==='started'||job.status==='in_progress'?3:job.field_status==='arrived'?2:job.field_status==='en_route'?1:0;
  const collect=async(method:CollectMethod)=>{
    setCollectBusy(true);
    try{
      const next=await markJobCollected(job,method);
      setJob(next);onUpdate(next);
    }catch(e:any){alert(e?.message||'Unable to mark this job collected.')}
    finally{setCollectBusy(false)}
  };
  const liveSteps=[['Booked','Job is on the board'],['En route','Driving to the customer'],['On site','Arrived at the vehicle'],['In progress','Service started'],['Done','Finished and sent to QC']] as const;
  const checklistGroups=useMemo(()=>{
    const buckets=new Map<string,JobChecklistItem[]>();
    for(const item of checklist){
      const match=/^(Exterior|Interior) · /.exec(item.label);
      const key=match?`${match[1]} self`:'Service checklist';
      buckets.set(key,[...(buckets.get(key)||[]),item]);
    }
    return [...buckets.entries()];
  },[checklist]);
  return <div className="job-mode"><div className="job-mode-head"><div><span className="eyebrow">Live job</span><h2>{job.service_name}</h2><p>{job.service_address||'Service address pending'} · {job.vehicle_info||'Vehicle not listed'}</p></div>{onClose&&<button className="icon-btn" onClick={onClose}><XCircle/></button>}</div><div className="uber-live-tracker" aria-label="Live job status">{liveSteps.map(([label,hint],i)=><div key={label} className={i<liveStep?'done':i===liveStep?'current':''}><b>{label}</b>{hint}</div>)}</div><div className="job-mode-metrics"><div><span>Customer</span><strong>{appointmentPartyName(job)}</strong></div><div><span>Total</span><strong>{money(Number(job.price||0))}</strong></div><div><span>Job Timer</span><strong>{job.started_at?formatDuration(elapsed):'Not started'}</strong></div><div><span>QC</span><strong>{job.qc_status?.replaceAll('_',' ')||'not required'}</strong></div></div><FieldContactBar phone={job.customer_phone} address={job.service_address} name={appointmentPartyName(job)}/><div className="job-action-row"><a className="btn-outline" href={buildAppleMapsUrl(job.latitude,job.longitude,job.service_address)} target="_blank" rel="noreferrer"><Navigation size={15}/> Navigate</a>{STATUS_ACTIONS.map(([key,label,Icon])=><button key={key} className={job.field_status===key?'btn-primary':'btn-outline'} disabled={busy||job.field_status==='finished'||job.status==='completed'} onClick={()=>setStatus(key)}><Icon size={15}/>{label}</button>)}</div>{(canCollectJob(job)||isJobPaid(job))&&<div className="job-collect-bar">{isJobPaid(job)?<><CheckCircle2 size={18}/><div><strong>Collected</strong><span>{money(Number(job.price||0))} marked paid on this job.</span></div></>:<><DollarSign size={18}/><div><strong>Collect {money(Number(job.price||0))}</strong><span>Mark cash, check, or card after finish. QC still happens in Manager. The job closes when QC is passed and this is paid.</span></div><button type="button" className="btn-outline" disabled={collectBusy} onClick={()=>void collect('cash')}>Cash</button><button type="button" className="btn-outline" disabled={collectBusy} onClick={()=>void collect('check')}>Check</button><button type="button" className="btn-primary" disabled={collectBusy} onClick={()=>void collect('card')}>Card collected</button></>}</div>}<div className="job-mode-grid"><section className="job-panel"><div className="job-panel-head"><div><span className="eyebrow">1 · CHECK-IN</span><h3>Vehicle Condition</h3></div><ShieldCheck/></div><label>Condition summary<textarea value={condition} onChange={e=>setCondition(e.target.value)} placeholder="Overall vehicle condition, customer requests, belongings…"/></label><label>Existing damage<textarea value={damage} onChange={e=>setDamage(e.target.value)} placeholder="Existing scratches, dents, wheel damage, stains…"/></label><button className="btn-outline" onClick={saveInspection}>Save Inspection</button><MediaUploader label="Damage / condition photos" type="damage" onFile={upload} disabled={uploading}/></section><section className="job-panel"><div className="job-panel-head"><div><span className="eyebrow">2 · DOCUMENT</span><h3>Before Photos</h3></div><Camera/></div><MediaUploader label={uploading?'Uploading…':'Upload Before Photo'} type="before" onFile={upload} disabled={uploading}/><MediaGrid media={media.filter(m=>m.media_type==='before'||m.media_type==='damage')}/></section><section className="job-panel job-panel-wide"><div className="job-panel-head"><div><span className="eyebrow">3 · SERVICE</span><h3>{job.service_name||job.package_name||'Service Checklist'}</h3></div><ListProgress value={checklist.filter(c=>c.completed).length} total={checklist.length}/></div><div className="job-checklist">{checklistGroups.map(([title,items])=><div className="job-checklist-group" key={title}><span className="eyebrow">{title}</span>{items.map(item=><button key={item.id} className={item.completed?'completed':''} onClick={()=>toggleChecklist(item)}><span className="check-box">{item.completed&&<Check size={15}/>}</span><span>{item.label.replace(/^(Exterior|Interior) · /,'')}{item.required&&<small>Required</small>}</span></button>)}</div>)}{!checklist.length&&<p>No checklist seeded yet. Start the job or add a custom item.</p>}</div><button className="btn-link" onClick={addChecklist}>+ Add custom checklist item</button></section><section className="job-panel"><div className="job-panel-head"><div><span className="eyebrow">4 · PROOF</span><h3>After Photos</h3></div><Camera/></div><MediaUploader label={uploading?'Uploading…':'Upload After Photo'} type="after" onFile={upload} disabled={uploading}/><MediaGrid media={media.filter(m=>m.media_type==='after')}/></section><section className="job-panel"><div className="job-panel-head"><div><span className="eyebrow">5 · SIGN-OFF</span><h3>Customer Signature</h3></div><CheckCircle2/></div><input value={signer} onChange={e=>setSigner(e.target.value)} placeholder="Signer name"/><SignaturePad onChange={setSignature}/><button className="btn-outline" onClick={saveSignature}>Save Signature</button></section></div><div className="job-completion-bar"><div><strong>{canFinish?'Ready to Finish':'Completion requirements remaining'}</strong><span>{checklist.filter(c=>c.completed).length}/{checklist.length} checklist · {beforeCount} before photos · {afterCount} after photos · {duration} min</span></div><button className="btn-primary" disabled={!canFinish||busy||job.field_status==='finished'} onClick={()=>setStatus('finished')}>Finish & Send to QC</button></div></div>;
}

function MediaUploader({label,type,onFile,disabled}:{label:string;type:'before'|'after'|'damage';onFile:(file:File,type:any)=>void;disabled:boolean}){return <label className="media-upload"><Upload size={18}/><span>{label}</span><input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f,type);e.currentTarget.value=''}}/></label>}
function MediaGrid({media}:{media:JobMedia[]}){return <div className="job-media-grid">{media.map(m=><a key={m.id} href={m.file_url} target="_blank" rel="noreferrer"><img src={m.file_url} alt={m.caption||m.media_type}/><span>{m.media_type}</span></a>)}</div>}
function ListProgress({value,total}:{value:number;total:number}){return <div className="list-progress"><span>{value}/{total}</span><i><b style={{width:`${total?value/total*100:0}%`}}/></i></div>}
function formatDuration(ms:number){const mins=Math.floor(ms/60000);const h=Math.floor(mins/60);const m=mins%60;return h?`${h}h ${m}m`:`${m}m`}
