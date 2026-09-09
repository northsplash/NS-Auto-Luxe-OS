
import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronRight, Flame, Layers3, List, Map, MessageCircle, Navigation, Phone, Search, Target, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase, type Lead } from '@/lib/supabase';
import { money } from '@/lib/data';
import { doorStatus, smsHref, telHref } from '@/lib/fieldOps';
import { SR_PIPELINE_KEYS, SR_STATUSES, doorStatusKey, leadDisplayName, leadNextAction, srStatus } from '@/lib/salesRabbitLeads';
import { groupByStreet, nextBestDoor, type FieldDoor } from '@/lib/fieldReview';
import { googleMapsErrorMessage, loadGoogleMaps, shouldUseGoogleMaps } from '@/lib/googleMaps';
import { geocodeOsmAddress, osmDirectionsUrl } from '@/lib/osmGeocode';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';

type LeadGeoPatch={id:string;latitude:number;longitude:number};
type Props={leads:Lead[];onOpen:(lead:Lead)=>void;onSchedule?:(lead:Lead)=>void;onLeadsPatched?:(patches:LeadGeoPatch[])=>void;repName?:string};
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
    <div className="lead-map-legend salesrabbit-legend-v29">{SR_STATUSES.filter(s=>s.knock||s.key==='unworked').map(s=><span key={s.key}><i style={{background:s.color}}/>{s.abbr}</span>)}</div>
  </div>;
}

function leadAsDoor(l:Lead):FieldDoor{
  return {id:l.id,address:l.address||'',status:l.status,follow_up_at:l.follow_up_at,hot:temp(l)==='hot',name:leadDisplayName(l),phone:l.phone,lat:Number(l.latitude||0),lng:Number(l.longitude||0)};
}
function leadDistance(l:Lead,pos:{lat:number;lng:number}){const lat=Number(l.latitude),lng=Number(l.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng)||!lat||!lng)return Number.POSITIVE_INFINITY;const R=3958.8,toRad=(d:number)=>d*Math.PI/180;const dLat=toRad(lat-pos.lat),dLng=toRad(lng-pos.lng);const a=Math.sin(dLat/2)**2+Math.cos(toRad(pos.lat))*Math.cos(toRad(lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function formatDistance(miles:number){if(!Number.isFinite(miles))return 'unmapped';return miles<0.1?`${Math.round(miles*5280)} ft`:`${miles.toFixed(miles<10?1:0)} mi`}

export default function LeadCommandCenter({leads,onOpen,onSchedule,onLeadsPatched,repName}:Props){
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
    const patches:LeadGeoPatch[]=[];
    try{
      if (shouldUseGoogleMaps()) {
        const google=await loadGoogleMaps();const geocoder=new google.maps.Geocoder();
        for(const lead of targets){try{const result=await new Promise<any[]>((resolve,reject)=>geocoder.geocode({address:lead.address,componentRestrictions:{country:'US'}},(results:any[],status:string)=>status==='OK'&&results?.length?resolve(results):reject(new Error(status))));const loc=result[0].geometry.location;const latitude=loc.lat(),longitude=loc.lng();const {error}=await supabase.from('leads').update({latitude,longitude}).eq('id',lead.id);if(!error)patches.push({id:lead.id,latitude,longitude});await new Promise(r=>setTimeout(r,90));}catch{}}
      } else {
        for (const lead of targets) {
          try {
            const loc = await geocodeOsmAddress(lead.address || '');
            if (!loc) continue;
            const { error } = await supabase.from('leads').update({ latitude: loc.lat, longitude: loc.lng }).eq('id', lead.id);
            if (!error) patches.push({ id: lead.id, latitude: loc.lat, longitude: loc.lng });
            await new Promise(r => setTimeout(r, 1100));
          } catch { /* keep mapping the rest */ }
        }
      }
      if(patches.length) onLeadsPatched?.(patches);
      setGeocodeNote(`Mapped ${patches.length} of ${targets.length}.`);
    }catch(error){setGeocodeNote(googleMapsErrorMessage(error))}finally{setGeocoding(false)}
  };
  const now=Date.now();
  const active=useMemo(()=>leads.filter(l=>!l.archived_at),[leads]);
  const pipelineStages=useMemo(()=>{
    const keys=[...SR_PIPELINE_KEYS];
    if(active.some(l=>doorStatusKey(l.status)==='contacted')&&!keys.includes('contacted')){
      const i=Math.max(0,keys.indexOf('unworked'));
      keys.splice(i+1,0,'contacted');
    }
    return keys;
  },[active]);
  const rows=useMemo(()=>active.filter(l=>stage==='all'||(stage==='due'?Boolean(l.follow_up_at&&new Date(l.follow_up_at).getTime()<=now):doorStatusKey(l.status)===stage||l.status===stage)).filter(l=>`${leadDisplayName(l)} ${l.address||''} ${l.phone||''} ${l.service_interest||''}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>{
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
  const openMaps=(l:Lead)=>{
    const url=osmDirectionsUrl({lat:l.latitude,lng:l.longitude,query:l.address});
    if(url) window.open(url,'_blank','noopener,noreferrer');
  };
  const best=nextBestDoor(rows.map(leadAsDoor));
  const streetGroups=groupByStreet(rows.map(leadAsDoor));
  const openBest=()=>{const l=rows.find(x=>x.id===best?.id);if(l) onOpen(l)};

  return <div className="lead-command-v26">
    <section className="lead-mobile-command-v26"><div><span className="eyebrow">FIELD SALES</span><h3>{repName?`${repName}'s pipeline`:'Lead Command'}</h3><p>{rows.length} active leads · {mapped} mapped</p></div><div className="lead-view-switch-v26"><button className={view==='map'?'active':''} onClick={()=>setView('map')}><Map size={16}/>Map</button><button className={view==='pipeline'?'active':''} onClick={()=>setView('pipeline')}><Layers3 size={16}/>Pipeline</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={16}/>List</button></div></section>
    <div className="lead-command-kpis lead-kpis-v26">
      <button type="button" className={stage==='interested'?'active':''} onClick={()=>setStage(s=>s==='interested'?'all':'interested')}><Flame/><span>Hot Leads</span><strong>{hot}</strong><small>Highest priority</small></button>
      <button type="button" className={stage==='due'?'active':''} onClick={()=>setStage(s=>s==='due'?'all':'due')}><Target/><span>Follow-ups Due</span><strong>{due}</strong><small>Needs action now</small></button>
      <button type="button" className={stage==='appointment_set'?'active':''} onClick={()=>setStage(s=>s==='appointment_set'?'all':'appointment_set')}><CalendarPlus/><span>Appointments</span><strong>{appts}</strong><small>Scheduled</small></button>
      <div><TrendingUp/><span>Pipeline</span><strong>{money(pipeline)}</strong><small>Open value</small></div>
    </div>
    <div className="lead-command-toolbar lead-toolbar-v26">
      <div className="lead-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, address, phone or service"/></div>
      <select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All active leads</option><option value="due">Follow-ups due</option>{SR_STATUSES.map(s=><option key={s.key} value={s.key}>{s.name}</option>)}</select>
      <select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Priority first</option><option value="followup">Next action</option><option value="value">Highest value</option><option value="nearest" disabled={!userPos}>Nearest to me</option></select><button type="button" className="btn-outline lead-near-me-v27" onClick={useMyLocation}><Navigation size={15}/>{userPos?'Refresh location':'Near me'}</button>{unmapped>0&&<button type="button" className="btn-outline lead-map-missing-v27" onClick={geocodeMissing} disabled={geocoding} title="Map up to 20 leads with addresses"><RefreshCw size={15} className={geocoding?'spin':''}/>{geocoding?'Mapping…':`Map ${Math.min(20,unmapped)} missing`}</button>}
    </div>{geocodeNote&&<div className="lead-geocode-note-v27">{geocodeNote}<button type="button" onClick={()=>setGeocodeNote('')}>×</button></div>}

    {view==='map'&&<div className="lead-map-layout-v26"><LeadMap leads={rows} onOpen={onOpen}/><aside className="lead-map-sidebar-v26 salesrabbit-door-list-v29"><header><div><span className="eyebrow">KNOCK QUEUE</span><h4>Next doors</h4></div><span>{rows.length}</span></header>{best&&<button type="button" className="lead-next-best" onClick={openBest}><Target size={15}/><span><small>Next best door</small><strong>{best.name||best.address}</strong></span></button>}{streetGroups.map(g=><div className="knock-street-group" key={g.street}><div className="knock-street-head"><strong>{g.street}</strong><span>{g.worked}/{g.total}</span></div>{g.items.map(d=>{const l=rows.find(x=>x.id===d.id);if(!l)return null;const knock=doorStatus(l.status);return <button key={l.id} onClick={()=>onOpen(l)}><i className="door-knock-dot-v29" style={{background:knock.color}} title={knock.label}/><span><strong>{leadDisplayName(l)}</strong><small>{knock.short} · {l.address||'Address pending'}{userPos&&l.latitude&&l.longitude?` · ${formatDistance(leadDistance(l,userPos))}`:''}</small></span><em>{money(Number(l.estimated_value||0))}</em></button>})}</div>)}{!rows.length&&<div className="ns-empty">No doors in this queue.</div>}</aside></div>}

    {view==='pipeline'&&(!rows.length?<div className="ns-empty"><strong>No leads match these filters</strong><p>Clear search or change the stage filter to see the board.</p></div>:<div className="lead-pipeline-v26">{pipelineStages.map(s=>{const items=rows.filter(l=>doorStatusKey(l.status)===s);const total=items.reduce((n,l)=>n+Number(l.estimated_value||0),0);const meta=srStatus(s);return <section key={s}><header><div><i style={{background:meta.color}}/><strong>{meta.name}</strong><span>{items.length}</span></div><em>{money(total)}</em></header><div className="lead-pipeline-cards-v26">{items.map(l=>{const next=leadNextAction(l);const pin=srStatus(l.status);return <article key={l.id} onClick={()=>onOpen(l)}><div className="lead-pipeline-card-head"><span className={`lead-temp ${temp(l)}`}/><strong>{leadDisplayName(l)}</strong><b className="lead-status-abbr" style={{color:pin.color}} title={pin.name}>{pin.abbr}</b><em>{score(l)}</em></div><p>{l.address||'Address pending'}</p><small>{l.service_interest||'Service not selected'}{l.vehicle_info?` · ${l.vehicle_info}`:''}</small><div className="lead-pipeline-meta"><span>{money(Number(l.estimated_value||0))}</span><span className={next.overdue?'overdue-text':''}>{next.text}</span></div><div className="lead-pipeline-actions-v26">{l.phone&&<a href={telHref(l.phone)||`tel:${l.phone}`} onClick={e=>e.stopPropagation()} title="Call"><Phone size={15}/></a>}{smsHref(l.phone)&&<a href={smsHref(l.phone)} onClick={e=>e.stopPropagation()} title="Text"><MessageCircle size={15}/></a>}{l.latitude&&l.longitude&&<button onClick={e=>{e.stopPropagation();openMaps(l)}}><Navigation size={15}/></button>}{onSchedule&&<button onClick={e=>{e.stopPropagation();onSchedule(l)}} title="Schedule"><CalendarPlus size={15}/></button>}<button onClick={e=>{e.stopPropagation();onOpen(l)}}><ChevronRight size={16}/></button></div></article>})}{!items.length&&<div className="lead-column-empty">No leads</div>}</div></section>})}</div>)}

    {view==='list'&&<div className="lead-command-table lead-list-v26">
      <div className="lead-command-head"><span>Customer</span><span>Stage</span><span>Next action</span><span>Value</span><span>Actions</span></div>
      {rows.map(l=>{const next=leadNextAction(l);return <div className="lead-command-row" key={l.id}>
        <button className="lead-customer-cell" onClick={()=>onOpen(l)}><i className="door-knock-dot-v29" style={{background:doorStatus(l.status).color}}/><div><strong>{leadDisplayName(l)}</strong><span>{l.address||'Address not added'}</span><small>{doorStatus(l.status).label} · {l.service_interest||'Service not selected'}{l.vehicle_info?` · ${l.vehicle_info}`:''}</small></div></button>
        <span><b className={`lead-stage stage-${l.status}`}>{srStatus(l.status).name}</b><small className="lead-score-line">Score {score(l)} · {temp(l)}</small></span>
        <span>{next.at?<><strong className={next.overdue?'overdue-text':''}>{next.text}</strong><small>{l.last_contacted_at?`Last contact ${new Date(l.last_contacted_at).toLocaleDateString()}`:'No contact logged'}</small></>:<><strong>No next action</strong><small>Set a follow-up to keep it moving</small></>}</span>
        <span><strong>{money(Number(l.estimated_value||0))}</strong><small>{l.contact_attempt_count||0} attempts</small></span>
        <span className="lead-row-actions">{telHref(l.phone)&&<a href={telHref(l.phone)} title="Call"><Phone size={16}/></a>}{smsHref(l.phone)&&<a href={smsHref(l.phone)} title="Text"><MessageCircle size={16}/></a>}{l.latitude&&l.longitude&&<button onClick={()=>openMaps(l)} title="Navigate"><Navigation size={16}/></button>}{onSchedule&&<button onClick={()=>onSchedule(l)} title="Schedule"><CalendarPlus size={16}/></button>}<button onClick={()=>onOpen(l)} title="Open"><ChevronRight size={17}/></button></span>
      </div>})}
      {!rows.length&&<div className="ns-empty">No leads match these filters.</div>}
    </div>}
  </div>
}
