import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, BarChart3, ChevronDown, Clock3, Crosshair, DollarSign, Gauge,
  History, ListChecks, LogOut, MapPin, Menu, Navigation, Pause, Phone,
  Play, Plus, RefreshCw, Route, Search, Target, TrendingUp, UserRound,
  WifiOff, X, Eye, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type {
  D2DDailyGoal, Employee, Lead, LeadTerritory, SalesRecord, TerritoryDoor,
  TerritoryDoorHistory, TerritoryRoute, TimeEntry,
} from '@/lib/supabase';
import { money } from '@/lib/data';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';
import TrainingPortal from '@/components/TrainingPortal';
import TeamMessaging from '@/components/TeamMessaging';
import {
  APPOINTMENT_STATUSES, CONTACTED_STATUSES, DOOR_STATUSES, REVISIT_STATUSES,
  SOLD_STATUSES, doorStatus, haversineMeters, localDateTime, optimizeWalkingRoute,
  percent, sameLocalDay,
} from '@/lib/fieldOps';
import { sendCommunication } from '@/lib/communications';

type Tab='territory'|'route'|'leads'|'followups'|'messages'|'performance'|'timeclock'|'training';
type LiveLocation={latitude:number;longitude:number;accuracy?:number|null};
type OfflineAction={id:string;type:'save_lead'|'door_status';payload:any;created_at:string};
const OFFLINE_KEY='ns_d2d_offline_queue_v2';
const STATUS_QUICK=['no_answer','revisit','interested','follow_up','estimate','appointment_set','sold','do_not_knock'] as const;

const emptyForm=()=>({
  customer_name:'',address:'',phone:'',email:'',status:'unworked',service_interest:'',vehicle_info:'',
  estimated_value:'',follow_up_at:'',notes:'',appointment_at:'',
});

export default function D2DPortal(){
  const {user,profile,loading}=useAuth();
  const navigate=useNavigate();
  const [tab,setTab]=useState<Tab>('territory');
  const [sidebar,setSidebar]=useState(false);
  const [groups,setGroups]=useState<Record<string,boolean>>({field:true,performance:true,account:false});
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [territories,setTerritories]=useState<LeadTerritory[]>([]);
  const [doors,setDoors]=useState<TerritoryDoor[]>([]);
  const [sales,setSales]=useState<SalesRecord[]>([]);
  const [times,setTimes]=useState<TimeEntry[]>([]);
  const [goals,setGoals]=useState<D2DDailyGoal|null>(null);
  const [route,setRoute]=useState<TerritoryRoute|null>(null);
  const [routeDoorIds,setRouteDoorIds]=useState<string[]>([]);
  const [selectedTerritory,setSelectedTerritory]=useState<string>('');
  const [selectedDoor,setSelectedDoor]=useState<(Partial<TerritoryDoor>&{lead_id?:string|null})|null>(null);
  const [history,setHistory]=useState<TerritoryDoorHistory[]>([]);
  const [form,setForm]=useState(emptyForm());
  const [manual,setManual]=useState(false);
  const [live,setLive]=useState<LiveLocation|null>(null);
  const [online,setOnline]=useState(navigator.onLine);
  const [offlineCount,setOfflineCount]=useState(loadOffline().length);
  const [busy,setBusy]=useState(true);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState('');
  const [filters,setFilters]=useState<string[]>([]);
  const [showLabels,setShowLabels]=useState(false);
  const [leadView,setLeadView]=useState<'pipeline'|'list'>('pipeline');
  const [leadStage,setLeadStage]=useState('all');
  const [discoveringHouses,setDiscoveringHouses]=useState(false);
  const [houseDiscoveryError,setHouseDiscoveryError]=useState('');
  const attemptedDiscovery=useRef<Set<string>>(new Set());
  const lastLocationWrite=useRef(0);

  useEffect(()=>{
    if(!loading&&(!user||!['d2d','owner'].includes(profile?.portal_role||'')))navigate('/portal');
  },[user,profile,loading,navigate]);

  const load=async()=>{
    if(!user)return;
    setBusy(true);
    const {data:emp}=await supabase.from('employees').select('*').eq('user_id',user.id).maybeSingle();
    setEmployee(emp);
    if(!emp){setBusy(false);return;}
    const [l,t,s,ti,g,r]=await Promise.all([
      supabase.from('leads').select('*').eq('assigned_employee_id',emp.id).order('created_at',{ascending:false}),
      supabase.from('lead_territories').select('*').eq('assigned_employee_id',emp.id).eq('status','active').order('priority',{ascending:false}),
      supabase.from('sales_records').select('*').eq('employee_id',emp.id).order('sold_at',{ascending:false}),
      supabase.from('time_entries').select('*').eq('employee_id',emp.id).order('clock_in',{ascending:false}).limit(60),
      supabase.from('d2d_daily_goals').select('*').eq('employee_id',emp.id).eq('goal_date',new Date().toISOString().slice(0,10)).maybeSingle(),
      supabase.from('territory_routes').select('*').eq('employee_id',emp.id).in('status',['active','paused']).order('started_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    setLeads(l.data??[]);setTerritories(t.data??[]);setSales(s.data??[]);setTimes(ti.data??[]);setGoals(g.data??null);setRoute(r.data??null);
    const currentTerritory=selectedTerritory||(t.data?.[0]?.id??'');
    setSelectedTerritory(currentTerritory);
    const ids=(t.data??[]).map(x=>x.id);
    if(ids.length){const d=await supabase.from('territory_doors').select('*').in('territory_id',ids);setDoors(d.data??[])}else setDoors([]);
    if(r.data?.id){const rs=await supabase.from('territory_route_stops').select('*').eq('route_id',r.data.id).order('stop_order');setRouteDoorIds((rs.data??[]).filter(x=>x.status!=='completed').map(x=>x.door_id));}
    setBusy(false);
  };
  useEffect(()=>{load()},[user]);

  useEffect(()=>{
    const onOnline=()=>{setOnline(true);syncOffline();};
    const onOffline=()=>setOnline(false);
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)};
  },[employee]);

  const openEntry=times.find(t=>!t.clock_out);
  useEffect(()=>{
    if(!employee||(!openEntry&&!route))return;
    if(!navigator.geolocation)return;
    const watch=navigator.geolocation.watchPosition(async p=>{
      const loc={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};setLive(loc);
      const now=Date.now();if(now-lastLocationWrite.current<90000)return;lastLocationWrite.current=now;
      try{
        await supabase.from('rep_locations').insert({employee_id:employee.id,latitude:loc.latitude,longitude:loc.longitude,accuracy_meters:loc.accuracy,captured_at:new Date().toISOString()});
        if(route)await supabase.from('rep_work_sessions').update({last_latitude:loc.latitude,last_longitude:loc.longitude,last_location_at:new Date().toISOString()}).eq('employee_id',employee.id).eq('status','active');
      }catch{/* field tracking should never interrupt work */}
    },()=>{}, {enableHighAccuracy:true,maximumAge:30000,timeout:15000});
    return()=>navigator.geolocation.clearWatch(watch);
  },[employee?.id,Boolean(openEntry),route?.id]);

  const territoryDoors=useMemo(()=>doors.filter(d=>!selectedTerritory||d.territory_id===selectedTerritory),[doors,selectedTerritory]);

  const discoverTerritoryHouses=async(territoryId=selectedTerritory,force=false)=>{
    if(!territoryId||discoveringHouses)return;
    const territory=territories.find(t=>t.id===territoryId);
    const raw=(territory?.polygon_geojson as any)?.coordinates?.[0]??[];
    const points=raw.map((p:number[])=>[Number(p[1]),Number(p[0])] as [number,number]).filter((p:[number,number])=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(points.length<3){setHouseDiscoveryError('This territory needs a saved boundary before houses can be loaded.');return;}
    if(!force&&doors.some(d=>d.territory_id===territoryId))return;
    setDiscoveringHouses(true);setHouseDiscoveryError('');
    try{
      const lats=points.map(p=>p[0]),lngs=points.map(p=>p[1]);
      const {data,error}=await supabase.functions.invoke('territory-house-search',{body:{
        south:Math.min(...lats),west:Math.min(...lngs),north:Math.max(...lats),east:Math.max(...lngs),points
      }});
      if(error)throw error;
      if(!data?.success)throw new Error(data?.error||'Unable to discover houses.');
      const blocked=new Set(['commercial','industrial','warehouse','retail','office','school','hospital','church','civic','public','government','garage','garages','shed']);
      const elements=(data.elements??[]).filter((e:any)=>{
        const building=String(e?.tags?.building||'').toLowerCase();
        return !building||!blocked.has(building);
      });
      const existing=doors.filter(d=>d.territory_id===territoryId);
      const seen=new Set(existing.map((d:any)=>String(d.source||'')));
      const rows:any[]=[];
      for(const e of elements){
        const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon);
        if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
        const tags=e.tags??{};
        const source=`osm:${e.type}:${e.id}`;
        if(seen.has(source)||existing.some(d=>Math.abs(Number(d.latitude)-lat)<.000012&&Math.abs(Number(d.longitude)-lng)<.000012))continue;
        seen.add(source);
        const house=String(tags['addr:housenumber']||'').trim();
        const street=String(tags['addr:street']||'').trim();
        const address=[house,street].filter(Boolean).join(' ')||null;
        rows.push({territory_id:territoryId,latitude:lat,longitude:lng,address,house_number:house||null,street_name:street||null,status:'unworked',source});
      }
      for(let i=0;i<rows.length;i+=250){
        const {error:insertError}=await supabase.from('territory_doors').insert(rows.slice(i,i+250));
        if(insertError)throw insertError;
      }
      const {data:fresh,error:freshError}=await supabase.from('territory_doors').select('*').eq('territory_id',territoryId);
      if(freshError)throw freshError;
      setDoors(prev=>[...prev.filter(d=>d.territory_id!==territoryId),...(fresh??[])]);
      attemptedDiscovery.current.add(territoryId);
    }catch(err:any){
      setHouseDiscoveryError(err?.message||'House discovery is temporarily unavailable.');
    }finally{setDiscoveringHouses(false)}
  };

  const workedToday=useMemo(()=>territoryDoors.filter(d=>d.last_visited_at&&sameLocalDay(d.last_visited_at)),[territoryDoors]);
  const contactsToday=workedToday.filter(d=>CONTACTED_STATUSES.has((d.status||'unworked') as any)).length;
  const appointmentsToday=workedToday.filter(d=>APPOINTMENT_STATUSES.has((d.status||'unworked') as any)).length;
  const salesToday=sales.filter(s=>sameLocalDay(s.sold_at)&&s.status==='completed');
  const revenueToday=salesToday.reduce((n,s)=>n+Number(s.sale_amount||0),0);
  const totalRevenue=sales.filter(s=>s.status==='completed').reduce((n,s)=>n+Number(s.sale_amount||0),0);
  const commission=totalRevenue*Number(employee?.commission_rate||0)/100;
  const weekBase=Number(employee?.weekly_base||0);
  const territoryProgress=percent(territoryDoors.filter(d=>d.status!=='unworked').length,territoryDoors.length);
  const currentStreet=selectedDoor?.address?.replace(/^\d+\s+/,'').split(',')[0]||'';
  const streetDoors=currentStreet?territoryDoors.filter(d=>(d.address||'').replace(/^\d+\s+/,'').split(',')[0]===currentStreet):[];
  const streetProgress=percent(streetDoors.filter(d=>d.status!=='unworked').length,streetDoors.length);

  useEffect(()=>{
    if(!selectedTerritory||busy||discoveringHouses)return;
    if(territoryDoors.length>0)return;
    if(attemptedDiscovery.current.has(selectedTerritory))return;
    attemptedDiscovery.current.add(selectedTerritory);
    discoverTerritoryHouses(selectedTerritory).catch(()=>{});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedTerritory,busy,territoryDoors.length]);


  const lookupAddress=async(lat:number,lng:number)=>{
    try{
      const {data,error}=await supabase.functions.invoke('geocode',{body:{latitude:lat,longitude:lng}});
      if(!error&&data?.address)return data;
    }catch{/* fallback below */}
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,{headers:{'Accept-Language':'en-US,en'}});
      if(!r.ok)return null;const d=await r.json();const a=d.address||{};const street=[a.house_number,a.road||a.residential||a.pedestrian].filter(Boolean).join(' ');const city=a.city||a.town||a.village||'';const state=a.state||'';const postal_code=a.postcode||'';return{address:[street,[city,state,postal_code].filter(Boolean).join(', ').replace(/, ([0-9]{5})$/,' $1')].filter(Boolean).join(', ')||d.display_name,street,house_number:a.house_number||'',city,state,postal_code};
    }catch{return null}
  };

  const pickDoor=async(door:any)=>{
    const lead=door.lead_id?leads.find(l=>l.id===door.lead_id):null;
    const cooldown=(lead as any)?.cooldown_until?new Date((lead as any).cooldown_until):null;
    if(lead?.status==='do_not_knock'||door?.do_not_knock){alert('Permanent Do Not Knock property. A manager must clear this restriction before canvassing.');return;}
    if((lead as any)?.archived_at&&cooldown&&cooldown>new Date()){alert(`Lead is archived until ${cooldown.toLocaleDateString()}. It cannot be reused yet.`);return;}
    setSelectedDoor(door);setManual(false);setHistory([]);
    let address=lead?.address||door.address||'';
    setForm({customer_name:lead?.customer_name||'',address,phone:lead?.phone||'',email:lead?.email||'',status:lead?.status||door.status||'unworked',service_interest:lead?.service_interest||'',vehicle_info:lead?.vehicle_info||'',estimated_value:String(lead?.estimated_value||''),follow_up_at:lead?.follow_up_at?.slice(0,16)||'',notes:lead?.notes||door.notes||'',appointment_at:''});
    if(door.id){const h=await supabase.from('territory_door_history').select('*').eq('door_id',door.id).order('created_at',{ascending:false}).limit(20);setHistory(h.data??[])}
    if(!address&&Number.isFinite(Number(door.latitude))&&Number.isFinite(Number(door.longitude))){
      const geo=await lookupAddress(Number(door.latitude),Number(door.longitude));address=geo?.address||'';
      if(address){setForm(p=>({...p,address}));if(door.id){const patch={address,street_name:geo?.street||null,house_number:geo?.house_number||null,city:geo?.city||null,state:geo?.state||null,postal_code:geo?.postal_code||null};await supabase.from('territory_doors').update(patch).eq('id',door.id);setDoors(p=>p.map(x=>x.id===door.id?{...x,...patch}:x));}}
    }
  };

  const pickMapPoint=async(lat:number,lng:number)=>{
    setManual(true);setSelectedDoor({latitude:lat,longitude:lng,territory_id:null});setHistory([]);setForm({...emptyForm(),address:'Locating address…'});
    const geo=await lookupAddress(lat,lng);setForm(p=>({...p,address:geo?.address||''}));
  };

  const checkDuplicate=async()=>{
    const phone=form.phone.replace(/\D/g,'').slice(-10);const address=form.address.trim().toLowerCase().replace(/\s+/g,' ');
    if(!phone&&!address)return null;
    let query=supabase.from('leads').select('id,customer_name,address,phone,status,assigned_employee_id,archived_at,cooldown_until,archive_reason').limit(5);
    if(phone)query=query.eq('normalized_phone',phone);else query=query.eq('normalized_address',address);
    const {data}=await query;return(data??[]).filter((x:any)=>x.id!==selectedDoor?.lead_id);
  };

  const queueOffline=(action:OfflineAction)=>{const q=loadOffline();q.push(action);localStorage.setItem(OFFLINE_KEY,JSON.stringify(q));setOfflineCount(q.length)};
  const syncOffline=async()=>{
    if(!employee||!navigator.onLine)return;const q=loadOffline();if(!q.length)return;
    const remaining:OfflineAction[]=[];
    for(const item of q){try{if(item.type==='save_lead'){const {error}=await supabase.from('leads').upsert(item.payload,{onConflict:'id'});if(error)throw error}else if(item.type==='door_status'){const {error}=await supabase.from('territory_doors').update(item.payload.patch).eq('id',item.payload.id);if(error)throw error}}catch{remaining.push(item)}}
    localStorage.setItem(OFFLINE_KEY,JSON.stringify(remaining));setOfflineCount(remaining.length);if(remaining.length!==q.length)await load();
  };

  const saveLead=async(e?:React.FormEvent,forcedStatus?:string):Promise<boolean>=>{
    e?.preventDefault();if(!employee||!selectedDoor)return false;setSaving(true);
    const nextStatus=forcedStatus||form.status||'unworked';
    const duplicates=await checkDuplicate();
    const protectedDuplicate=duplicates?.find((x:any)=>x.status==='do_not_knock'||(x.cooldown_until&&new Date(x.cooldown_until)>new Date()));
    if(protectedDuplicate){setSaving(false);alert(protectedDuplicate.status==='do_not_knock'?'This address/contact is permanently Do Not Knock.':'This lead is in the 6-month archive cooldown and cannot be reused yet.');return false;}
    if(duplicates?.length&&!window.confirm(`Possible duplicate lead found: ${duplicates[0].customer_name||duplicates[0].address||duplicates[0].phone}. Save anyway?`)){setSaving(false);return false;}
    const territory_id=selectedDoor.territory_id||(!manual?selectedTerritory:null)||null;
    const payload:any={
      ...(selectedDoor.lead_id?{id:selectedDoor.lead_id}:{}),assigned_employee_id:employee.id,territory_id,territory_door_id:selectedDoor.id||null,
      customer_name:form.customer_name||null,address:form.address||null,phone:form.phone||null,email:form.email||null,status:nextStatus,
      service_interest:form.service_interest||null,vehicle_info:form.vehicle_info||null,estimated_value:Number(form.estimated_value||0),
      follow_up_at:form.follow_up_at?new Date(form.follow_up_at).toISOString():null,notes:form.notes||null,
      latitude:selectedDoor.latitude??null,longitude:selectedDoor.longitude??null,last_contacted_at:new Date().toISOString(),
      next_action:nextStatus==='follow_up'?'follow_up':nextStatus==='estimate'?'send_estimate':nextStatus==='appointment_set'?'appointment':null,
      next_action_at:form.follow_up_at?new Date(form.follow_up_at).toISOString():null,
      ...(['not_interested','cancelled','lost'].includes(nextStatus)?(()=>{const d=new Date();d.setMonth(d.getMonth()+6);return{archived_at:new Date().toISOString(),archive_reason:nextStatus,cooldown_until:d.toISOString(),reactivation_status:'cooldown'}})():{}),
      ...(nextStatus==='do_not_knock'?{archived_at:new Date().toISOString(),archive_reason:'do_not_knock',cooldown_until:null,reactivation_status:'permanent_dnk'}:{}),
    };
    try{
      if(!navigator.onLine)throw new Error('offline');
      let saved:any;
      if(selectedDoor.lead_id){const r=await supabase.from('leads').update(payload).eq('id',selectedDoor.lead_id).select().single();if(r.error)throw r.error;saved=r.data;setLeads(p=>p.map(x=>x.id===saved.id?saved:x));}
      else{const r=await supabase.from('leads').insert(payload).select().single();if(r.error)throw r.error;saved=r.data;setLeads(p=>[saved,...p]);}
      try{await supabase.from('lead_contact_attempts').insert({lead_id:saved.id,employee_id:employee.id,channel:manual?'other':'door',outcome:nextStatus,notes:form.notes||null,attempted_at:new Date().toISOString()});}catch{/* optional intelligence table */}
      try{await supabase.from('lead_activities').insert({lead_id:saved.id,employee_id:employee.id,activity_type:'field_update',previous_status:selectedDoor.status||null,new_status:nextStatus,notes:form.notes||null});}catch{/* keep field work moving */}
      if(selectedDoor.id){
        const patch:any={lead_id:saved.id,status:nextStatus,last_visited_at:new Date().toISOString(),last_employee_id:employee.id,notes:form.notes,next_follow_up_at:form.follow_up_at?new Date(form.follow_up_at).toISOString():null,...(nextStatus==='do_not_knock'?{do_not_knock:true}:{})};
        const d=await supabase.from('territory_doors').update(patch).eq('id',selectedDoor.id).select().single();if(d.error)throw d.error;setDoors(p=>p.map(x=>x.id===selectedDoor.id?d.data:x));
        if(route?.id){await supabase.from('territory_route_stops').update({status:'completed',completed_at:new Date().toISOString()}).eq('route_id',route.id).eq('door_id',selectedDoor.id);setRouteDoorIds(p=>p.filter(id=>id!==selectedDoor.id));}
      }
      if(nextStatus==='appointment_set'&&form.appointment_at)await createAppointment(saved);
      setSelectedDoor(null);setManual(false);setHistory([]);setSaving(false);return true;
    }catch(error:any){
      if(!navigator.onLine||String(error?.message||'').toLowerCase().includes('network')){
        queueOffline({id:crypto.randomUUID(),type:'save_lead',payload:{...payload,id:payload.id||crypto.randomUUID()},created_at:new Date().toISOString()});
        if(selectedDoor.id)queueOffline({id:crypto.randomUUID(),type:'door_status',payload:{id:selectedDoor.id,patch:{status:nextStatus,last_visited_at:new Date().toISOString(),last_employee_id:employee.id,notes:form.notes}},created_at:new Date().toISOString()});
        alert('Saved offline. North Splash will sync this lead when your connection returns.');setSelectedDoor(null);setManual(false);setSaving(false);return true;
      }else alert(error?.message||'Unable to save lead.');setSaving(false);return false;
    }
  };

  const createEstimate=async()=>{
    if(!employee||!selectedDoor)return;let lead=selectedDoor.lead_id?leads.find(l=>l.id===selectedDoor.lead_id):null;
    if(!lead){await saveLead(undefined,'estimate');return alert('Lead saved. Reopen the house and create the estimate.');}
    const amount=Number(form.estimated_value||lead.estimated_value||0);const {data,error}=await supabase.from('customer_estimates').insert({lead_id:lead.id,employee_id:employee.id,sales_rep_employee_id:employee.id,amount,subtotal:amount,total:amount,status:'draft',line_items:[{name:form.service_interest||'Detailing service',quantity:1,price:amount}],notes:form.notes}).select().single();if(error)return alert(error.message);
    await supabase.from('leads').update({status:'estimate',estimate_id:data.id}).eq('id',lead.id);setLeads(p=>p.map(x=>x.id===lead!.id?{...x,status:'estimate',estimate_id:data.id}:x));setForm(p=>({...p,status:'estimate'}));alert('Estimate created. It is now attached to this lead.');
  };

  const createAppointment=async(lead:Lead)=>{
    if(!employee||!form.appointment_at)return;
    const {data,error}=await supabase.from('appointments').insert({
      user_id:lead.converted_customer_id||null,customer_name:form.customer_name||lead.customer_name,customer_email:form.email||lead.email,customer_phone:form.phone||lead.phone,
      service_name:form.service_interest||lead.service_interest||'Detailing Service',package_name:form.service_interest||lead.service_interest||null,add_ons:[],vehicle_info:form.vehicle_info||lead.vehicle_info||'',
      scheduled_at:new Date(form.appointment_at).toISOString(),status:'pending',price:Number(form.estimated_value||lead.estimated_value||0),notes:form.notes||lead.notes||'',
      service_address:form.address||lead.address,latitude:selectedDoor?.latitude??lead.latitude,longitude:selectedDoor?.longitude??lead.longitude,
      sales_rep_employee_id:employee.id,lead_id:lead.id,source_channel:'d2d',dispatch_status:'unassigned',field_status:'scheduled',
    }).select().single();if(error)throw error;
    await supabase.from('leads').update({status:'appointment_set',appointment_id:data.id}).eq('id',lead.id);
    setLeads(p=>p.map(x=>x.id===lead.id?{...x,status:'appointment_set',appointment_id:data.id}:x));
  };

  const startRoute=async()=>{
    if(!employee||!selectedTerritory)return;const available=territoryDoors.filter(d=>!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked'));
    if(!available.length)return alert('No eligible houses remain in this territory.');
    const start=live||{latitude:Number(territories.find(t=>t.id===selectedTerritory)?.center_lat||available[0].latitude),longitude:Number(territories.find(t=>t.id===selectedTerritory)?.center_lng||available[0].longitude)};
    const ordered=optimizeWalkingRoute(start,available);let distance=0;let cursor=start;ordered.forEach(stop=>{distance+=haversineMeters(cursor,stop);cursor=stop});
    if(route?.id)await supabase.from('territory_routes').update({status:'completed',ended_at:new Date().toISOString()}).eq('id',route.id);
    const {data,error}=await supabase.from('territory_routes').insert({territory_id:selectedTerritory,employee_id:employee.id,status:'active',total_stops:ordered.length,distance_meters:Math.round(distance),start_latitude:start.latitude,start_longitude:start.longitude}).select().single();if(error)return alert(error.message);
    const stops=ordered.map((d,i)=>({route_id:data.id,door_id:d.id,stop_order:i+1,status:'pending'}));if(stops.length){const r=await supabase.from('territory_route_stops').insert(stops);if(r.error)return alert(r.error.message)}
    setRoute(data);setRouteDoorIds(ordered.map(d=>d.id));setTab('route');
  };
  const toggleRoute=async()=>{if(!route)return;const status=route.status==='paused'?'active':'paused';const patch=status==='paused'?{status,paused_at:new Date().toISOString()}:{status,paused_at:null};await supabase.from('territory_routes').update(patch).eq('id',route.id);setRoute({...route,...patch});};
  const finishRoute=async()=>{if(!route)return;await supabase.from('territory_routes').update({status:'completed',ended_at:new Date().toISOString()}).eq('id',route.id);setRoute(null);setRouteDoorIds([]);};
  const nextBest=()=>{const nextId=routeDoorIds[0];const door=nextId?doors.find(d=>d.id===nextId):optimizeWalkingRoute(live||territoryDoors[0]||{latitude:35.7796,longitude:-78.6382},territoryDoors.filter(d=>!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked')))[0];if(door){pickDoor(door);setTab('territory')}else alert('No available house found.');};

  const saveAndNext=async()=>{
    const current=selectedDoor;
    if(!current)return;
    const ok=await saveLead(undefined,form.status);
    if(!ok)return;
    const candidates=territoryDoors
      .filter(d=>d.id!==current.id&&!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked'))
      .sort((a,b)=>{
        const pa=(a.status==='unworked'?0:a.status==='revisit'?1:2),pb=(b.status==='unworked'?0:b.status==='revisit'?1:2);
        if(pa!==pb)return pa-pb;
        if(current.latitude==null||current.longitude==null)return 0;
        return haversineMeters({latitude:Number(current.latitude),longitude:Number(current.longitude)},a)-haversineMeters({latitude:Number(current.latitude),longitude:Number(current.longitude)},b);
      });
    if(candidates[0])setTimeout(()=>pickDoor(candidates[0]),80);
  };

  const manualLead=()=>{setManual(true);setSelectedDoor({territory_id:null,latitude:live?.latitude,longitude:live?.longitude});setHistory([]);setForm(emptyForm())};
  const useCurrentLocation=()=>navigator.geolocation?.getCurrentPosition(async p=>{const lat=p.coords.latitude,lng=p.coords.longitude;setSelectedDoor(d=>({...d,latitude:lat,longitude:lng}));const geo=await lookupAddress(lat,lng);if(geo?.address)setForm(f=>({...f,address:geo.address}))},()=>alert('Allow location access to pin this lead.'),{enableHighAccuracy:true});

  const clock=async()=>{if(!employee)return;if(openEntry){const pos=await getPosition();const {data,error}=await supabase.from('time_entries').update({clock_out:new Date().toISOString(),clock_out_latitude:pos?.latitude??null,clock_out_longitude:pos?.longitude??null}).eq('id',openEntry.id).select().single();if(error)return alert(error.message);setTimes(p=>p.map(t=>t.id===openEntry.id?data:t));}
    else{const pos=await getPosition();const {data,error}=await supabase.from('time_entries').insert({employee_id:employee.id,clock_in:new Date().toISOString(),clock_in_latitude:pos?.latitude??null,clock_in_longitude:pos?.longitude??null,status:'pending'}).select().single();if(error)return alert(error.message);setTimes(p=>[data,...p]);}};

  const logout=async()=>{await signOut().catch(()=>{});navigate('/')};
  if(loading||busy)return <div className="portal-loading"><div className="portal-spinner"/><p>Loading D2D field system…</p></div>;
  if(!employee)return <div className="portal-loading"><p>Your account is not linked to a D2D employee profile yet.</p><Link to="/">Home</Link></div>;

  const nav:[Tab,string,any,string][]=[
    ['territory','Territory',MapPin,'field'],['route','Route',Route,'field'],['leads','My Leads',Target,'field'],['followups','Follow-Ups',Navigation,'field'],['messages','Messages',MessageCircle,'field'],
    ['performance','Performance',BarChart3,'performance'],['timeclock','Time Clock',Clock3,'account'],['training','Training',Award,'account'],
  ];
  const filteredLeads=leads.filter(l=>{
    const matchesSearch=!search||`${l.customer_name||''} ${l.address||''} ${l.phone||''} ${l.service_interest||''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStage=leadStage==='all'||l.status===leadStage;
    return matchesSearch&&matchesStage;
  });
  const leadScore=(l:Lead)=>{
    let score=20;
    if(l.phone)score+=15;if(l.email)score+=10;if(l.service_interest)score+=10;if(Number(l.estimated_value||0)>=300)score+=15;
    if(['interested','estimate','appointment_set'].includes(l.status))score+=25;if(l.follow_up_at&&new Date(l.follow_up_at)<=new Date())score+=10;
    return Math.min(100,score);
  };
  const pipelineStages=[
    ['unworked','New'],['contacted','Contacted'],['interested','Interested'],['follow_up','Follow-Up'],['estimate','Estimate'],['appointment_set','Appointment'],['sold','Sold']
  ] as const;
  const dueFollowups=leads.filter(l=>l.status==='follow_up'||(l.follow_up_at&&new Date(l.follow_up_at)<=new Date()));

  return <div className="portal-layout d2d-os">
    <aside className={`portal-sidebar ${sidebar?'sidebar-open':''}`}>
      <div className="sidebar-header"><Link to="/" className="sidebar-brand"><div className="brand-mark brand-mark-sm">NS</div><div><strong>D2D SALES</strong><small>NORTH SPLASH</small></div></Link><button className="sidebar-close" onClick={()=>setSidebar(false)}><X size={18}/></button></div>
      <div className="sidebar-user"><div className="sidebar-avatar">{employee.name[0]}</div><div><p>{employee.name}</p><span>Level {employee.employment_level||1} · {employee.commission_rate}%</span></div></div>
      <nav className="sidebar-nav">{[['field','Field Work'],['performance','Results'],['account','My Account']].map(([id,label])=><div className="nav-group" key={id}><button className="nav-group-title" onClick={()=>setGroups(p=>Object.fromEntries(Object.keys(p).map(k=>[k,k===id?!p[id]:false])))}>{label}<ChevronDown size={14} className={groups[id]?'nav-chevron-open':''}/></button>{groups[id]&&nav.filter(n=>n[3]===id).map(([tid,l,Icon])=><button key={tid} className={`sidebar-item ${tab===tid?'sidebar-active':''}`} onClick={()=>{setTab(tid);setSidebar(false)}}><Icon size={18}/>{l}{tid==='followups'&&dueFollowups.length>0&&<span className="nav-count">{dueFollowups.length}</span>}</button>)}</div>)}</nav>
      <div className="sidebar-footer"><div className={`connection-pill ${online?'online':'offline'}`}>{online?'Online':'Offline'}{offlineCount>0&&` · ${offlineCount} queued`}</div><button className="sidebar-item sidebar-signout" onClick={logout}><LogOut size={18}/>Sign Out</button></div>
    </aside>
    {sidebar&&<div className="sidebar-backdrop" onClick={()=>setSidebar(false)}/>}<main className="portal-main">
      <div className="portal-topbar"><button className="sidebar-toggle" onClick={()=>setSidebar(true)}><Menu size={20}/></button><div className="topbar-title"><h1>{nav.find(n=>n[0]===tab)?.[1]}</h1><span>{territories.find(t=>t.id===selectedTerritory)?.name||'No territory assigned'}</span></div><div className="topbar-actions">{offlineCount>0&&<button className="btn-outline" onClick={syncOffline}><RefreshCw size={15}/> Sync {offlineCount}</button>}</div></div>
      <div className="portal-content">
        {tab==='territory'&&<div className="tab-content d2d-field-page v2-page">
          <div className="v2-page-head"><div><span className="eyebrow">FIELD WORKSPACE</span><h2>Work Your Territory</h2><p>Tap a house, record the outcome, then move directly to the next best door.</p></div><div className="v2-head-actions"><button className="btn-outline" onClick={manualLead}><Plus size={15}/> Outside Territory Lead</button><button className="btn-primary" onClick={nextBest}><Target size={15}/> Next Best House</button></div></div>
          <div className="d2d-kpi-strip v2-kpis"><Kpi label="Territory" value={`${territoryProgress}%`} detail={`${territoryDoors.filter(d=>d.status!=='unworked').length}/${territoryDoors.length} worked`}/><Kpi label="Doors Today" value={String(workedToday.length)} detail={`Goal ${goals?.door_goal??50}`}/><Kpi label="Contact Rate" value={`${percent(contactsToday,workedToday.length)}%`} detail={`${contactsToday} contacts`}/><Kpi label="Appointments" value={String(appointmentsToday)} detail={`${percent(appointmentsToday,Math.max(contactsToday,1))}% of contacts`}/><Kpi label="Revenue" value={money(revenueToday)} detail={`Goal ${money(Number(goals?.revenue_goal??1500))}`}/></div>
          <div className="d2d-map-shell">
            <div className="d2d-map-topline"><div className="d2d-territory-select"><label>Assigned Territory</label><select value={selectedTerritory} onChange={e=>{setSelectedTerritory(e.target.value);setSelectedDoor(null);setHouseDiscoveryError('')}}>{territories.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div><div className="d2d-field-actions"><button className="btn-outline" onClick={()=>discoverTerritoryHouses(selectedTerritory,true)} disabled={!selectedTerritory||discoveringHouses}><RefreshCw size={15}/>{discoveringHouses?'Finding Houses…':'Refresh Houses'}</button><button className="btn-outline" onClick={()=>setShowLabels(v=>!v)}>{showLabels?'Hide Labels':'Show Addresses'}</button><button className="btn-outline" onClick={startRoute}><Route size={15}/> Build Route</button></div></div>
            <div className="d2d-filter-row v2-status-scroller">{DOOR_STATUSES.filter(x=>['unworked','no_answer','revisit','interested','follow_up','estimate','appointment_set','sold','do_not_knock'].includes(x.key)).map(s=><button key={s.key} className={filters.includes(s.key)?'status-filter active':'status-filter'} onClick={()=>setFilters(p=>p.includes(s.key)?p.filter(x=>x!==s.key):[...p,s.key])}><i style={{background:s.color}}/>{s.short}</button>)}</div>
            {discoveringHouses&&<div className="d2d-house-discovery"><span className="live-dot"/> Mapping residential doors inside this territory…</div>}
            {houseDiscoveryError&&<div className="d2d-house-discovery error">{houseDiscoveryError}<button type="button" onClick={()=>discoverTerritoryHouses(selectedTerritory,true)}>Try again</button></div>}
            {!territories.length?<div className="ns-empty">No territory is assigned to your account yet.</div>:<FieldTerritoryMap fieldMode className="d2d-primary-map" territories={territories.filter(t=>!selectedTerritory||t.id===selectedTerritory)} doors={territoryDoors} leads={leads.filter(l=>!selectedTerritory||l.territory_id===selectedTerritory)} liveLocation={live} routeDoorIds={routeDoorIds} activeDoorId={selectedDoor?.id||null} statusFilter={filters} showDoorLabels={showLabels} onDoorClick={pickDoor} onMapClick={pickMapPoint}/>}
            <div className="territory-bottom-stats v2-map-footer"><span><strong>{territoryProgress}%</strong> complete</span>{currentStreet&&<span><strong>{streetProgress}%</strong> {currentStreet}</span>}<span><strong>{dueFollowups.length}</strong> follow-ups</span><span><strong>{territoryDoors.filter(d=>d.status==='unworked').length}</strong> unworked</span>{!online&&<span><WifiOff size={14}/> Offline</span>}</div>
          </div>
        </div>}

        {tab==='route'&&<div className="tab-content"><div className="route-hero"><div><span className="eyebrow">FIELD ROUTE</span><h2>{route?route.status==='paused'?'Route Paused':'Route Active':'No Active Route'}</h2><p>{route?`${routeDoorIds.length} stops remaining`:'Start an optimized route from the Territory screen.'}</p></div>{route&&<div className="route-actions"><button className="btn-outline" onClick={toggleRoute}>{route.status==='paused'?<Play size={15}/>:<Pause size={15}/>} {route.status==='paused'?'Resume':'Pause'}</button><button className="btn-primary" onClick={nextBest}><Navigation size={15}/> Next Stop</button><button className="btn-outline" onClick={finishRoute}>Finish Route</button></div>}</div>{route&&<><FieldTerritoryMap territories={territories.filter(t=>t.id===route.territory_id)} doors={doors.filter(d=>d.territory_id===route.territory_id)} liveLocation={live} routeDoorIds={routeDoorIds} onDoorClick={pickDoor}/><div className="route-stop-list">{routeDoorIds.slice(0,12).map((id,i)=>{const d=doors.find(x=>x.id===id);return d?<button key={id} onClick={()=>pickDoor(d)}><span>{i+1}</span><div><strong>{d.address||'Address pending'}</strong><small>{doorStatus(d.status).label}</small></div><Navigation size={16}/></button>:null})}</div></>}</div>}

        {tab==='leads'&&<div className="tab-content v2-page">
          <div className="v2-page-head"><div><span className="eyebrow">PIPELINE</span><h2>My Leads</h2><p>Prioritize the best opportunities, follow up on time, and move every lead toward an appointment.</p></div><button className="btn-primary" onClick={manualLead}><Plus size={15}/> Add Lead</button></div>
          <div className="lead-command-bar"><div className="search-box"><Search size={16}/><input placeholder="Search name, address, phone or service" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={leadStage} onChange={e=>setLeadStage(e.target.value)}><option value="all">All stages</option>{pipelineStages.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><div className="segmented-control"><button className={leadView==='pipeline'?'active':''} onClick={()=>setLeadView('pipeline')}>Pipeline</button><button className={leadView==='list'?'active':''} onClick={()=>setLeadView('list')}>List</button></div></div>
          <div className="lead-insight-strip"><Kpi label="Open Leads" value={String(leads.filter(l=>!['sold','lost','not_interested','do_not_knock'].includes(l.status)).length)}/><Kpi label="Hot Leads" value={String(leads.filter(l=>leadScore(l)>=70&&!['sold','lost'].includes(l.status)).length)}/><Kpi label="Follow-Ups Due" value={String(dueFollowups.length)}/><Kpi label="Pipeline Value" value={money(leads.filter(l=>!['sold','lost'].includes(l.status)).reduce((n,l)=>n+Number(l.estimated_value||0),0))}/></div>
          {leadView==='pipeline'?<div className="lead-kanban">{pipelineStages.map(([stage,label])=>{const rows=filteredLeads.filter(l=>l.status===stage||(stage==='contacted'&&['no_answer','revisit'].includes(l.status)));return <section className="lead-kanban-col" key={stage}><header><span>{label}</span><strong>{rows.length}</strong></header><div>{rows.slice(0,30).map(l=><button className="lead-kanban-card" key={l.id} onClick={()=>pickDoor({id:l.territory_door_id||undefined,lead_id:l.id,latitude:Number(l.latitude||0),longitude:Number(l.longitude||0),address:l.address,territory_id:l.territory_id,status:l.status})}><div className="lead-kanban-top"><i style={{background:doorStatus(l.status).color}}/><span className={leadScore(l)>=70?'lead-score hot':'lead-score'}>{leadScore(l)}</span></div><strong>{l.customer_name||l.address||'Unnamed Lead'}</strong><small>{l.address||'No address'}</small><div className="lead-kanban-meta"><span>{l.service_interest||'Service TBD'}</span><b>{money(Number(l.estimated_value||0))}</b></div>{l.follow_up_at&&<em>{new Date(l.follow_up_at)<=new Date()?'Overdue · ':''}{localDateTime(l.follow_up_at)}</em>}</button>)}</div></section>})}</div>:<div className="lead-table-cards v2-lead-list">{filteredLeads.sort((a,b)=>leadScore(b)-leadScore(a)).map(l=><button className="lead-row-card" key={l.id} onClick={()=>pickDoor({id:l.territory_door_id||undefined,lead_id:l.id,latitude:Number(l.latitude||0),longitude:Number(l.longitude||0),address:l.address,territory_id:l.territory_id,status:l.status})}><div className="lead-status-dot" style={{background:doorStatus(l.status).color}}/><div className="lead-row-main"><strong>{l.customer_name||l.address||'Unnamed Lead'}</strong><span>{l.address||'No address'} · {l.service_interest||'Service not selected'}</span></div><span className={leadScore(l)>=70?'lead-score hot':'lead-score'}>{leadScore(l)}</span><div className="lead-row-value"><strong>{money(Number(l.estimated_value||0))}</strong><span>{doorStatus(l.status).label}</span></div></button>)}{!filteredLeads.length&&<div className="ns-empty">No matching leads.</div>}</div>}
        </div>}

        {tab==='followups'&&<div className="tab-content"><div className="tab-header"><div><h2>Follow-Up Queue</h2><p>Highest-priority callbacks and revisits first.</p></div></div><div className="followup-grid">{dueFollowups.sort((a,b)=>new Date(a.follow_up_at||0).getTime()-new Date(b.follow_up_at||0).getTime()).map(l=><div className="followup-card" key={l.id}><div><span className="eyebrow">{l.follow_up_at&&new Date(l.follow_up_at)<new Date()?'OVERDUE':'FOLLOW UP'}</span><h3>{l.customer_name||l.address}</h3><p>{l.address}</p></div><div className="followup-meta"><span>{l.follow_up_at?localDateTime(l.follow_up_at):'No date set'}</span><strong>{money(Number(l.estimated_value||0))}</strong></div><div className="followup-actions">{l.phone&&<a className="btn-outline" href={`tel:${l.phone}`}><Phone size={14}/> Call</a>}<button className="btn-primary" onClick={()=>pickDoor({id:l.territory_door_id||undefined,lead_id:l.id,latitude:Number(l.latitude||0),longitude:Number(l.longitude||0),address:l.address,territory_id:l.territory_id,status:l.status})}>Open Lead</button></div></div>)}{!dueFollowups.length&&<div className="ns-empty">You're caught up. No follow-ups are due.</div>}</div></div>}

        {tab==='messages'&&<div className="tab-content v2-page"><div className="v2-page-head"><div><span className="eyebrow">FIELD COMMUNICATION</span><h2>Messages</h2><p>Post sales wins, appointment updates, hot leads and crew messages from the field.</p></div></div><TeamMessaging employee={employee} portalKind="d2d"/></div>}

        {tab==='performance'&&<div className="tab-content v2-page"><div className="v2-page-head"><div><span className="eyebrow">MY PERFORMANCE</span><h2>Performance</h2><p>Today's activity, conversion quality, revenue and estimated compensation in one view.</p></div></div><div className="d2d-kpi-strip v2-kpis"><Kpi label="Completed Revenue" value={money(totalRevenue)} detail="Collected / completed sales"/><Kpi label="Commission" value={money(commission)} detail={`${employee.commission_rate||0}% rate`}/><Kpi label="Weekly Base" value={money(weekBase)}/><Kpi label="Contact Rate" value={`${percent(contactsToday,workedToday.length)}%`} detail={`${contactsToday}/${workedToday.length} doors`}/><Kpi label="Appointment Rate" value={`${percent(appointmentsToday,Math.max(contactsToday,1))}%`} detail={`${appointmentsToday} appointments`}/></div><div className="performance-v2-grid"><section className="v2-card goals-card"><div className="v2-card-head"><div><span className="eyebrow">TODAY</span><h3>Goal Progress</h3></div><Gauge size={24}/></div><Goal label="Doors" value={workedToday.length} goal={goals?.door_goal??50}/><Goal label="Contacts" value={contactsToday} goal={goals?.contact_goal??15}/><Goal label="Appointments" value={appointmentsToday} goal={goals?.appointment_goal??4}/><Goal label="Revenue" value={revenueToday} goal={Number(goals?.revenue_goal??1500)} moneyMode/></section><section className="v2-card funnel-card"><div className="v2-card-head"><div><span className="eyebrow">CONVERSION</span><h3>Today's Funnel</h3></div><TrendingUp size={24}/></div><div className="conversion-funnel"><div style={{'--w':'100%'} as any}><span>Doors</span><strong>{workedToday.length}</strong></div><div style={{'--w':`${Math.max(28,percent(contactsToday,Math.max(workedToday.length,1)))}%`} as any}><span>Contacts</span><strong>{contactsToday}</strong></div><div style={{'--w':`${Math.max(20,percent(appointmentsToday,Math.max(workedToday.length,1)))}%`} as any}><span>Appointments</span><strong>{appointmentsToday}</strong></div><div style={{'--w':`${Math.max(14,percent(salesToday.length,Math.max(workedToday.length,1)))}%`} as any}><span>Sales</span><strong>{salesToday.length}</strong></div></div></section><section className="v2-card recent-sales-card"><div className="v2-card-head"><div><span className="eyebrow">CLOSED</span><h3>Recent Sales</h3></div><DollarSign size={24}/></div>{sales.slice(0,8).map(s=><div className="performance-line" key={s.id}><span>{s.customer_name||s.service_name}</span><strong>{money(Number(s.sale_amount||0))}</strong></div>)}{!sales.length&&<div className="ns-empty compact">No completed sales yet.</div>}</section><section className="v2-card pay-card"><span className="eyebrow">ESTIMATED WEEKLY PAY</span><strong className="big-money">{money(weekBase+commission)}</strong><p>{money(weekBase)} base + {money(commission)} commission</p><small>Final payroll is subject to owner/manager approval and collected-sale rules.</small></section></div></div>}

        {tab==='timeclock'&&<div className="tab-content"><div className="clock-card"><div className={`clock-status ${openEntry?'active':''}`}><Clock3/><span>{openEntry?'CLOCKED IN':'OFF THE CLOCK'}</span></div><h2>{openEntry?`Started ${new Date(openEntry.clock_in).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'Ready to work?'}</h2><p>Location is recorded only for company field operations while you're actively working.</p><button className="btn-primary btn-full" onClick={clock}>{openEntry?'Clock Out':'Clock In'}</button></div><div className="timecard-list">{times.slice(0,12).map(t=><div key={t.id}><strong>{new Date(t.clock_in).toLocaleDateString()}</strong><span>{new Date(t.clock_in).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} → {t.clock_out?new Date(t.clock_out).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Open'}</span><em>{t.status}</em></div>)}</div></div>}

        {tab==='training'&&<div className="tab-content"><TrainingPortal employee={employee}/></div>}
      </div>
    </main>

    {(selectedDoor||manual)&&<HouseDrawer door={selectedDoor} form={form} setForm={setForm} history={history} manual={manual} saving={saving} onClose={()=>{setSelectedDoor(null);setManual(false);setHistory([])}} onSave={saveLead} onSaveNext={saveAndNext} onEstimate={createEstimate} onLocation={useCurrentLocation}/>} 
  </div>;
}

function HouseDrawer({door,form,setForm,history,manual,saving,onClose,onSave,onSaveNext,onEstimate,onLocation}:{door:any;form:any;setForm:any;history:TerritoryDoorHistory[];manual:boolean;saving:boolean;onClose:()=>void;onSave:(e?:React.FormEvent,status?:string)=>Promise<boolean>|void;onSaveNext:()=>Promise<void>|void;onEstimate:()=>void;onLocation:()=>void}){
  const [panel,setPanel]=useState<'quick'|'details'|'history'>('quick');
  const protectedDNK=door?.do_not_knock||door?.status==='do_not_knock';
  const statusMeta=doorStatus(form.status);
  return <div className="house-drawer-backdrop" onClick={onClose}><form className="house-drawer field-house-sheet" onSubmit={e=>onSave(e)} onClick={e=>e.stopPropagation()}>
    <div className="house-drawer-handle"/>
    <div className="house-drawer-head field-house-head">
      <div className="field-house-address">
        <span className="eyebrow">{manual?'OUTSIDE TERRITORY':'CANVASS HOUSE'}</span>
        <h2>{form.address||'Mapped house'}</h2>
        <div className="house-title-meta"><div className="house-status-pill" style={{background:statusMeta.color}}>{statusMeta.label}</div>{history.length>0&&<span className="house-visit-pill">{history.length} previous visit{history.length===1?'':'s'}</span>}</div>
      </div>
      <button type="button" className="icon-btn light" onClick={onClose}><X/></button>
    </div>

    {!manual&&<div className="field-house-actions">
      {form.phone&&<><a href={`tel:${form.phone}`}><Phone size={15}/>Call</a><a href={`sms:${form.phone}`}><MessageCircle size={15}/>Text</a></>}
      {door?.latitude&&door?.longitude&&<><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${door.latitude},${door.longitude}`}><Navigation size={15}/>Navigate</a><button type="button" onClick={()=>setPanel('history')}><History size={15}/>History</button></>}
    </div>}

    {manual&&<div className="house-manual-tools"><button type="button" className="btn-outline" onClick={onLocation}><Crosshair size={15}/> Use Current Location</button><input required placeholder="Street address" value={form.address} onChange={e=>setForm((p:any)=>({...p,address:e.target.value}))}/></div>}
    {protectedDNK&&<div className="dnk-warning">Permanent Do Not Knock. Only a manager/admin should clear this property.</div>}

    {panel==='history'?<div className="house-history-panel">
      <div className="house-panel-title"><div><span className="eyebrow">PROPERTY HISTORY</span><h3>Previous activity</h3></div><button type="button" className="btn-outline" onClick={()=>setPanel('quick')}>Back to marking</button></div>
      <div className="house-history-list">{history.map(h=><div key={h.id}><i style={{background:doorStatus(h.new_status).color}}/><div><strong>{doorStatus(h.new_status).label}</strong><span>{localDateTime(h.created_at)}</span><p>{h.notes||'Status updated'}</p></div></div>)}{!history.length&&<div className="ns-empty">No previous activity at this house.</div>}</div>
    </div>:<>
      <div className="field-quick-label"><span>Mark this house</span><small>One tap sets the outcome. Save & Next keeps you moving.</small></div>
      <div className="house-quick-grid field-quick-grid">{STATUS_QUICK.map(status=>{
        const meta=doorStatus(status);
        return <button type="button" disabled={protectedDNK&&status!=='do_not_knock'} key={status} className={form.status===status?'active':''} style={{'--status-color':meta.color} as any} onClick={()=>setForm((p:any)=>({...p,status}))}><i style={{background:meta.color}}/><strong>{meta.short}</strong></button>
      })}</div>

      <div className="field-save-bar">
        <button type="button" className="btn-primary field-save-next" disabled={saving||protectedDNK} onClick={onSaveNext}>{saving?'Saving…':'Save & Next House'}</button>
        <button type="submit" className="btn-outline" disabled={saving||protectedDNK}>Save</button>
      </div>

      <button type="button" className="field-expand-details" onClick={()=>setPanel(panel==='details'?'quick':'details')}><Plus size={15}/>{panel==='details'?'Hide Lead Details':'Add Customer / Lead Details'}</button>

      {panel==='details'&&<div className="field-lead-details">
        <div className="house-form-grid"><label><span>Name</span><input value={form.customer_name} onChange={e=>setForm((p:any)=>({...p,customer_name:e.target.value}))}/></label><label><span>Phone</span><input type="tel" value={form.phone} onChange={e=>setForm((p:any)=>({...p,phone:e.target.value}))}/></label><label><span>Email</span><input type="email" value={form.email} onChange={e=>setForm((p:any)=>({...p,email:e.target.value}))}/></label><label><span>Vehicle</span><input value={form.vehicle_info} onChange={e=>setForm((p:any)=>({...p,vehicle_info:e.target.value}))}/></label><label><span>Service Interest</span><input value={form.service_interest} onChange={e=>setForm((p:any)=>({...p,service_interest:e.target.value}))}/></label><label><span>Estimated Value</span><input type="number" min="0" value={form.estimated_value} onChange={e=>setForm((p:any)=>({...p,estimated_value:e.target.value}))}/></label><label><span>Follow-Up</span><input type="datetime-local" value={form.follow_up_at} onChange={e=>setForm((p:any)=>({...p,follow_up_at:e.target.value}))}/></label><label><span>Appointment Time</span><input type="datetime-local" value={form.appointment_at} onChange={e=>setForm((p:any)=>({...p,appointment_at:e.target.value}))}/></label></div>
        <label className="house-notes"><span>Notes</span><textarea value={form.notes} onChange={e=>setForm((p:any)=>({...p,notes:e.target.value}))}/></label>
        <div className="house-drawer-actions"><button type="button" className="btn-outline" onClick={onEstimate}>Create Estimate</button>{form.status==='appointment_set'&&form.appointment_at&&<span className="field-inline-note">Saving will create the appointment.</span>}</div>
      </div>}
    </>}
  </form></div>;
}

function Kpi({label,value,detail}:{label:string;value:string;detail?:string}){return <div className="d2d-kpi"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function Goal({label,value,goal,moneyMode=false}:{label:string;value:number;goal:number;moneyMode?:boolean}){const pct=percent(value,goal);return <div className="goal-row"><div><span>{label}</span><strong>{moneyMode?money(value):value} / {moneyMode?money(goal):goal}</strong></div><div className="goal-track"><i style={{width:`${pct}%`}}/></div></div>}
function loadOffline():OfflineAction[]{try{return JSON.parse(localStorage.getItem(OFFLINE_KEY)||'[]')}catch{return[]}}
function getPosition():Promise<LiveLocation|null>{return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})})}
