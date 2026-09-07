
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus, ChevronRight, Flame, Layers3, List, Map, Navigation, Phone, Search,
  Target, TrendingUp, RefreshCw
} from 'lucide-react';
import { supabase, type Lead } from '@/lib/supabase';
import { money, prettyLabel } from '@/lib/data';
import { localDateTime, DOOR_STATUSES, doorStatus } from '@/lib/fieldOps';
import { googleMapsErrorMessage, loadGoogleMaps } from '@/lib/googleMaps';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';

type Props={leads:Lead[];onOpen:(lead:Lead)=>void;onSchedule?:(lead:Lead)=>void;repName?:string};
const statusNames:Record<string,string>={unworked:'New',contacted:'Contacted',interested:'Interested',follow_up:'Follow Up',estimate:'Estimate',appointment_set:'Appointment',sold:'Sold',no_answer:'No Answer',revisit:'Revisit',do_not_knock:'DNK'};
const stageColors:Record<string,string>=Object.fromEntries(DOOR_STATUSES.map(s=>[s.key,s.color]));
const pipelineStages=['unworked','interested','follow_up','estimate','appointment_set'] as const;
const score=(l:Lead)=>{if(Number(l.lead_score||0)>0)return Number(l.lead_score);let n=20;if(l.phone)n+=15;if(l.email)n+=10;if(l.service_interest)n+=10;if(Number(l.estimated_value||0)>=300)n+=15;if(['interested','estimate','appointment_set'].includes(l.status))n+=25;if(l.follow_up_at&&new Date(l.follow_up_at)<=new Date())n+=10;return Math.min(100,n)};
const temp=(l:Lead)=>l.lead_temperature&&l.lead_temperature!=='cold'?l.lead_temperature:(score(l)>=75?'hot':score(l)>=45?'warm':'cold');

function LeadMap({leads,onOpen}:{leads:Lead[];onOpen:(lead:Lead)=>void}){
  return <div className="lead-map-v26">
    <FieldTerritoryMap
      className="lead-command-map"
      fieldMode
      territories={[]}
      leads={leads}
      onDoorClick={(door)=>{
        const lead=leads.find(l=>l.id===door.lead_id)||leads.find(l=>l.address===door.address&&Number(l.latitude)===Number(door.latitude));
        if(lead) onOpen(lead);
      }}
    />
    <div className="lead-map-legend salesrabbit-legend-v29">{DOOR_STATUSES.slice(0,10).map(s=><span key={s.key}><i style={{background:s.color}}/>{s.short}</span>)}</div>
  </div>;
}

function leadDistance(l:Lead,pos:{lat:number;lng:number}){const lat=Number(l.latitude),lng=Number(l.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng)||!lat||!lng)return Number.POSITIVE_INFINITY;const R=3958.8,toRad=(d:number)=>d*Math.PI/180;const dLat=toRad(lat-pos.lat),dLng=toRad(lng-pos.lng);const a=Math.sin(dLat/2)**2+Math.cos(toRad(pos.lat))*Math.cos(toRad(lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function formatDistance(miles:number){if(!Number.isFinite(miles))return 'unmapped';return miles<0.1?`${Math.round(miles*5280)} ft`:`${miles.toFixed(miles<10?1:0)} mi`}

export default function LeadCommandCenter({leads,onOpen,onSchedule,repName}:Props){
  const [q,setQ]=useState(''); const [stage,setStage]=useState('all'); const [sort,setSort]=useState('priority'); const [view,setView]=useState<'map'|'pipeline'|'list'>(()=>window.matchMedia?.('(max-width: 699px)').matches?'map':'pipeline');
  const [userPos,setUserPos]=useState<{lat:number;lng:number}|null>(null);
  const [geocoding,setGeocoding]=useState(false);
  const [geocodeNote,setGeocodeNote]=useState('');
  useEffect(()=>{const media=window.matchMedia('(max-width: 699px)');const onChange=(ev:MediaQueryListEvent)=>{if(ev.matches)setView(v=>v==='pipeline'?'map':v)};media.addEventListener?.('change',onChange);return()=>media.removeEventListener?.('change',onChange)},[]);
  const useMyLocation=()=>navigator.geolocation?.getCurrentPosition(p=>{setUserPos({lat:p.coords.latitude,lng:p.coords.longitude});setSort('nearest')},()=>alert('Location permission is needed to sort leads by distance.'),{enableHighAccuracy:true,timeout:9000,maximumAge:30000});

  const geocodeMissing=async()=>{
    const targets=active.filter(l=>l.address&&(!Number(l.latitude)||!Number(l.longitude))).slice(0,20);
    if(!targets.length){setGeocodeNote('All visible leads with addresses are mapped.');return}
    setGeocoding(true);setGeocodeNote(`Mapping ${targets.length} address${targets.length===1?'':'es'}…`);
    try{const google=await loadGoogleMaps();const geocoder=new google.maps.Geocoder();let mappedCount=0;
      for(const lead of targets){try{const result=await new Promise<any[]>((resolve,reject)=>geocoder.geocode({address:lead.address,componentRestrictions:{country:'US'}},(results:any[],status:string)=>status==='OK'&&results?.length?resolve(results):reject(new Error(status))));const loc=result[0].geometry.location;const latitude=loc.lat(),longitude=loc.lng();const {error}=await supabase.from('leads').update({latitude,longitude}).eq('id',lead.id);if(!error)mappedCount++;await new Promise(r=>setTimeout(r,90));}catch{}}
      setGeocodeNote(`Mapped ${mappedCount} of ${targets.length}.`);
    }catch(error){setGeocodeNote(googleMapsErrorMessage(error))}finally{setGeocoding(false)}
  };
  const now=Date.now();
  const active=useMemo(()=>leads.filter(l=>!l.archived_at),[leads]);
  const rows=useMemo(()=>active.filter(l=>stage==='all'||(stage==='due'?Boolean(l.follow_up_at&&new Date(l.follow_up_at).getTime()<=now):l.status===stage)).filter(l=>`${l.customer_name||''} ${l.address||''} ${l.phone||''} ${l.service_interest||''}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>{
    if(sort==='value')return Number(b.estimated_value||0)-Number(a.estimated_value||0);
    if(sort==='followup')return new Date(a.follow_up_at||'2999').getTime()-new Date(b.follow_up_at||'2999').getTime();
    if(sort==='nearest'&&userPos)return leadDistance(a,userPos)-leadDistance(b,userPos);
    return score(b)-score(a)||Number(b.estimated_value||0)-Number(a.estimated_value||0);
  }),[active,q,stage,sort,now,userPos]);
  const due=active.filter(l=>l.follow_up_at&&new Date(l.follow_up_at).getTime()<=now&&!['sold','do_not_knock'].includes(l.status)).length;
  const hot=active.filter(l=>temp(l)==='hot'&&!['sold','do_not_knock'].includes(l.status)).length;
  const appts=active.filter(l=>l.status==='appointment_set').length;
  const pipeline=active.filter(l=>!['sold','do_not_knock'].includes(l.status)).reduce((n,l)=>n+Number(l.estimated_value||0),0);
  const mapped=rows.filter(l=>Number(l.latitude)&&Number(l.longitude)).length;
  const unmapped=active.filter(l=>l.address&&(!Number(l.latitude)||!Number(l.longitude))).length;
  const openMaps=(l:Lead)=>{const q=l.latitude&&l.longitude?`${l.latitude},${l.longitude}`:l.address||'';window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,'_blank','noopener,noreferrer')};

  return <div className="lead-command-v26">
    <section className="lead-mobile-command-v26"><div><span className="eyebrow">FIELD SALES</span><h3>{repName?`${repName}'s pipeline`:'Lead Command'}</h3><p>{rows.length} active leads · {mapped} mapped</p></div><div className="lead-view-switch-v26"><button className={view==='map'?'active':''} onClick={()=>setView('map')}><Map size={16}/>Map</button><button className={view==='pipeline'?'active':''} onClick={()=>setView('pipeline')}><Layers3 size={16}/>Pipeline</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={16}/>List</button></div></section>
    <div className="lead-command-kpis lead-kpis-v26">
      <div><Flame/><span>Hot Leads</span><strong>{hot}</strong><small>Highest priority</small></div>
      <div><Target/><span>Follow-ups Due</span><strong>{due}</strong><small>Needs action now</small></div>
      <div><CalendarPlus/><span>Appointments</span><strong>{appts}</strong><small>Scheduled</small></div>
      <div><TrendingUp/><span>Pipeline</span><strong>{money(pipeline)}</strong><small>Open value</small></div>
    </div>
    <div className="lead-command-toolbar lead-toolbar-v26">
      <div className="lead-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, address, phone or service"/></div>
      <select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All active leads</option><option value="due">Follow-ups due</option>{Object.entries(statusNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Priority first</option><option value="followup">Next action</option><option value="value">Highest value</option><option value="nearest" disabled={!userPos}>Nearest to me</option></select><button type="button" className="btn-outline lead-near-me-v27" onClick={useMyLocation}><Navigation size={15}/>{userPos?'Refresh location':'Near me'}</button>{unmapped>0&&<button type="button" className="btn-outline lead-map-missing-v27" onClick={geocodeMissing} disabled={geocoding} title="Map up to 20 leads with addresses"><RefreshCw size={15} className={geocoding?'spin':''}/>{geocoding?'Mapping…':`Map ${Math.min(20,unmapped)} missing`}</button>}
    </div>{geocodeNote&&<div className="lead-geocode-note-v27">{geocodeNote}<button type="button" onClick={()=>setGeocodeNote('')}>×</button></div>}

    {view==='map'&&<div className="lead-map-layout-v26"><LeadMap leads={rows} onOpen={onOpen}/><aside className="lead-map-sidebar-v26 salesrabbit-door-list-v29"><header><div><span className="eyebrow">KNOCK QUEUE</span><h4>Next doors</h4></div><span>{rows.length}</span></header>{rows.slice(0,18).map(l=>{const knock=doorStatus(l.status);return <button key={l.id} onClick={()=>onOpen(l)}><i className="door-knock-dot-v29" style={{background:knock.color}} title={knock.label}/><span><strong>{l.customer_name||l.address||'Prospect'}</strong><small>{knock.short} · {l.address||'Address pending'}{userPos&&l.latitude&&l.longitude?` · ${formatDistance(leadDistance(l,userPos))}`:''}</small></span><em>{money(Number(l.estimated_value||0))}</em></button>})}</aside></div>}

    {view==='pipeline'&&<div className="lead-pipeline-v26">{pipelineStages.map(s=>{const items=rows.filter(l=>l.status===s||(s==='unworked'&&['contacted','no_answer','revisit'].includes(l.status)));const total=items.reduce((n,l)=>n+Number(l.estimated_value||0),0);return <section key={s}><header><div><i style={{background:stageColors[s]}}/><strong>{statusNames[s]}</strong><span>{items.length}</span></div><em>{money(total)}</em></header><div className="lead-pipeline-cards-v26">{items.map(l=><article key={l.id} onClick={()=>onOpen(l)}><div className="lead-pipeline-card-head"><span className={`lead-temp ${temp(l)}`}/><strong>{l.customer_name||'Unnamed prospect'}</strong><em>{score(l)}</em></div><p>{l.address||'Address pending'}</p><small>{l.service_interest||'Service not selected'}{l.vehicle_info?` · ${l.vehicle_info}`:''}</small><div className="lead-pipeline-meta"><span>{money(Number(l.estimated_value||0))}</span><span>{l.follow_up_at?new Date(l.follow_up_at).toLocaleDateString():'No follow-up'}</span></div><div className="lead-pipeline-actions-v26">{l.phone&&<a href={`tel:${l.phone}`} onClick={e=>e.stopPropagation()}><Phone size={15}/></a>}{l.latitude&&l.longitude&&<button onClick={e=>{e.stopPropagation();openMaps(l)}}><Navigation size={15}/></button>}{onSchedule&&<button onClick={e=>{e.stopPropagation();onSchedule(l)}}><CalendarPlus size={15}/></button>}<button onClick={e=>{e.stopPropagation();onOpen(l)}}><ChevronRight size={16}/></button></div></article>)}{!items.length&&<div className="lead-column-empty">No leads</div>}</div></section>})}</div>}

    {view==='list'&&<div className="lead-command-table lead-list-v26">
      <div className="lead-command-head"><span>Customer</span><span>Stage</span><span>Next action</span><span>Value</span><span>Actions</span></div>
      {rows.map(l=><div className="lead-command-row" key={l.id}>
        <button className="lead-customer-cell" onClick={()=>onOpen(l)}><i className="door-knock-dot-v29" style={{background:doorStatus(l.status).color}}/><div><strong>{l.customer_name||'Unnamed prospect'}</strong><span>{l.address||'Address not added'}</span><small>{doorStatus(l.status).label} · {l.service_interest||'Service not selected'}{l.vehicle_info?` · ${l.vehicle_info}`:''}</small></div></button>
        <span><b className={`lead-stage stage-${l.status}`}>{statusNames[l.status||'']||prettyLabel(l.status)}</b><small className="lead-score-line">Score {score(l)} · {temp(l)}</small></span>
        <span>{l.follow_up_at?<><strong className={new Date(l.follow_up_at).getTime()<=now?'overdue-text':''}>{new Date(l.follow_up_at).getTime()<=now?'Due ':'Next '}{localDateTime(l.follow_up_at)}</strong><small>{l.last_contacted_at?`Last contact ${new Date(l.last_contacted_at).toLocaleDateString()}`:'No contact logged'}</small></>:<><strong>No next action</strong><small>Set a follow-up to keep it moving</small></>}</span>
        <span><strong>{money(Number(l.estimated_value||0))}</strong><small>{l.contact_attempt_count||0} attempts</small></span>
        <span className="lead-row-actions">{l.phone&&<a href={`tel:${l.phone}`} title="Call"><Phone size={16}/></a>}{l.latitude&&l.longitude&&<button onClick={()=>openMaps(l)} title="Navigate"><Navigation size={16}/></button>}{onSchedule&&<button onClick={()=>onSchedule(l)} title="Schedule"><CalendarPlus size={16}/></button>}<button onClick={()=>onOpen(l)} title="Open"><ChevronRight size={17}/></button></span>
      </div>)}
      {!rows.length&&<div className="ns-empty">No leads match these filters.</div>}
    </div>}
  </div>
}
