import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award, BarChart3, CalendarDays, ChevronDown, ClipboardCheck, Clock3, Crosshair, DollarSign, Gauge,
  History, ListChecks, LogOut, MapPin, Menu, Navigation, Pause, Phone,
  Play, Plus, RefreshCw, Route, Search, Sparkles, Target, TrendingUp, UserRound,
  WifiOff, X, Eye, MessageCircle, MoreHorizontal, Presentation,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchTerritoryHouses, mapOsmHouses } from '@/lib/territoryHouses';
import type {
  Appointment, D2DDailyGoal, Employee, Lead, LeadTerritory, SalesRecord, TerritoryDoor,
  TerritoryDoorHistory, TerritoryRoute, TimeEntry,
} from '@/lib/supabase';
import { money } from '@/lib/data';
import { MARKET } from '@/lib/market';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';
import TrainingPortal from '@/components/TrainingPortal';
import TeamMessaging from '@/components/TeamMessaging';
import EmployeeOnboardingTab from '@/components/EmployeeOnboardingTab';
import SalesPresentation from '@/components/SalesPresentation';
import {
  createDoorCustomerAccount,
  householdAsLeadFields,
  type ApplyOfferResult,
  type OfferSelection,
} from '@/lib/customerAccount';
import LeadCommandCenter from '@/components/LeadCommandCenter';
import CanvassInspector from '@/components/CanvassInspector';
import SharedCalendar from '@/components/SharedCalendar';
import { minutesForService } from '@/lib/detailCatalog';
import { DEFAULT_TRAVEL_BUFFER_MINUTES } from '@/lib/driveTime';
import { planAppointmentTiming, toLocalInput } from '@/lib/scheduling';
import {
  APPOINTMENT_STATUSES, CONTACTED_STATUSES, DOOR_STATUSES,
  SOLD_STATUSES, doorStatus, doorStreetLabel, formatDistance, haversineMeters, localDateTime, optimizeWalkingRoute, rankNextBestHouse,
  percent, sameLocalDay,
} from '@/lib/fieldOps';
import { CANVASS_FILTER_KEYS, CLOSE_AFTER_KNOCK, NEEDS_TIME_KEYS, canvassTerritoryStats } from '@/lib/canvass';
import { sendCommunication, notifyCustomer } from '@/lib/communications';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import WorkspaceGate from '@/components/WorkspaceGate';
import { BackToOwnerBanner, PortalSwitchGrid, PortalSwitchRail, TopbarOwnerLink, canSwitchLivePortals } from '@/components/PortalSwitch';
import { BRAND_LOGO } from '@/lib/brand';
import { isOnboardingOpen } from '@/lib/onboarding';
import {
  composedLeadIdentity, emptySrLeadFields, fieldsFromLead, leadDisplayName,
} from '@/lib/salesRabbitLeads';

type Tab='territory'|'route'|'leads'|'calendar'|'followups'|'presentation'|'messages'|'performance'|'timeclock'|'training'|'onboarding';
type LiveLocation={latitude:number;longitude:number;accuracy?:number|null};
type OfflineAction={id:string;type:'save_lead'|'door_status'|'create_appointment';payload:any;created_at:string};
const OFFLINE_KEY='ns_d2d_offline_queue_v2';
const DOOR_CACHE_KEY='ns_d2d_territory_doors_v3';
const JOBS_CACHE_KEY='ns_d2d_jobs_cache_v1';

const emptyForm=()=>({
  ...emptySrLeadFields(),
  customer_name:'',address:'',status:'unworked',service_interest:'',vehicle_info:'',
  estimated_value:'',converted_customer_id:'',lead_source:'d2d',
});

export default function D2DPortal(){
  const {user,profile,loading}=useAuth();
  const navigate=useNavigate();
  const [tab,setTab]=useState<Tab>('territory');
  const [sidebar,setSidebar]=useState(false);
  const [pitchOpen,setPitchOpen]=useState(false);
  const [pitchMode,setPitchMode]=useState<'presentation'|'quote'|'account'>('presentation');
  const [groups,setGroups]=useState<Record<string,boolean>>({field:true,performance:true,account:false});
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
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
  const [canvassSearch,setCanvassSearch]=useState('');
  const [filters,setFilters]=useState<string[]>([]);
  const [showLabels,setShowLabels]=useState(false);
  const [leadView,setLeadView]=useState<'pipeline'|'list'>('pipeline');
  const [leadStage,setLeadStage]=useState('all');
  const [discoveringHouses,setDiscoveringHouses]=useState(false);
  const [houseDiscoveryError,setHouseDiscoveryError]=useState('');
  const [loadError,setLoadError]=useState('');
  const attemptedDiscovery=useRef<Set<string>>(new Set());
  const lastLocationWrite=useRef(0);

  useEffect(()=>{
    if(loading)return;
    if(!user){navigate('/login',{replace:true});return;}
    if(!['d2d','owner'].includes(profile?.portal_role||''))navigate('/portal');
  },[user,profile,loading,navigate]);

  const load=async()=>{
    if(!user){setBusy(false);return;}
    setBusy(true);
    setLoadError('');
    try{
    const {data:emp}=await supabase.from('employees').select('*').eq('user_id',user.id).maybeSingle();
    setEmployee(emp);
    if(!emp)return;
    if(!navigator.onLine){
      const cachedJobs=loadJobsCache();
      if(cachedJobs.length)setAppointments(cachedJobs);
    }
    const [l,t,s,ti,g,r,a]=await Promise.all([
      supabase.from('leads').select('*').eq('assigned_employee_id',emp.id).order('created_at',{ascending:false}),
      supabase.from('lead_territories').select('*').eq('assigned_employee_id',emp.id).eq('status','active').order('priority',{ascending:false}),
      supabase.from('sales_records').select('*').eq('employee_id',emp.id).order('sold_at',{ascending:false}),
      supabase.from('time_entries').select('*').eq('employee_id',emp.id).order('clock_in',{ascending:false}).limit(60),
      supabase.from('d2d_daily_goals').select('*').eq('employee_id',emp.id).eq('goal_date',new Date().toISOString().slice(0,10)).maybeSingle(),
      supabase.from('territory_routes').select('*').eq('employee_id',emp.id).in('status',['active','paused']).order('started_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('appointments').select('*').or(`sales_rep_employee_id.eq.${emp.id},assigned_employee_id.eq.${emp.id}`).order('scheduled_at'),
    ]);
    setLeads(l.data??[]);setTerritories(t.data??[]);setSales(s.data??[]);setTimes(ti.data??[]);setGoals(g.data??null);setRoute(r.data??null);setAppointments(a.data??[]);cacheJobs(a.data??[]);
    const currentTerritory=selectedTerritory||(t.data?.[0]?.id??'');
    setSelectedTerritory(currentTerritory);
    const ids=(t.data??[]).map(x=>x.id);
    if(ids.length){
      const d=await supabase.from('territory_doors').select('*').in('territory_id',ids);
      if(!d.error){setDoors(d.data??[]);cacheTerritoryDoors(d.data??[])}
      else {const cached=loadTerritoryDoors(ids);setDoors(cached)}
    }else setDoors([]);
    if(r.data?.id){const rs=await supabase.from('territory_route_stops').select('*').eq('route_id',r.data.id).order('stop_order');setRouteDoorIds((rs.data??[]).filter(x=>x.status!=='completed').map(x=>x.door_id));}
    }catch(err){setLoadError(err instanceof Error&&err.message?err.message:'Could not load the D2D workspace.')}finally{setBusy(false)}
  };
  useEffect(()=>{load()},[user]);
  const [packetOpened,setPacketOpened]=useState(false);
  useEffect(()=>{
    if(packetOpened||!employee)return;
    if(isOnboardingOpen(employee.onboarding_status)){setTab('onboarding');setPacketOpened(true);setGroups(p=>({...p,account:true}))}
  },[employee,packetOpened]);
  useEffect(()=>{
    if(!employee)return;
    const channel=supabase.channel(`ns-d2d-live-${employee.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'appointments'},payload=>{
        const next=payload.new as Appointment, old=payload.old as Appointment;
        setAppointments(current=>{
          if(payload.eventType==='DELETE')return current.filter(a=>a.id!==old.id);
          if(next.sales_rep_employee_id!==employee.id&&next.assigned_employee_id!==employee.id)return current.filter(a=>a.id!==next.id);
          return current.some(a=>a.id===next.id)?current.map(a=>a.id===next.id?next:a):[...current,next];
        });
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'leads'},payload=>{
        const next=payload.new as Lead, old=payload.old as Lead;
        setLeads(current=>{
          if(payload.eventType==='DELETE')return current.filter(l=>l.id!==old.id);
          if(next.assigned_employee_id!==employee.id)return current.filter(l=>l.id!==next.id);
          return current.some(l=>l.id===next.id)?current.map(l=>l.id===next.id?next:l):[next,...current];
        });
      }).on('postgres_changes',{event:'*',schema:'public',table:'territory_doors'},payload=>{
        const next=payload.new as TerritoryDoor, old=payload.old as TerritoryDoor;
        setDoors(current=>{
          if(payload.eventType==='DELETE')return current.filter(d=>d.id!==old.id);
          if(!next?.id)return current;
          const ids=new Set((territories.length?territories:[]).map(t=>t.id));
          if(ids.size && next.territory_id && !ids.has(next.territory_id)) return current;
          const merged=current.some(d=>d.id===next.id)?current.map(d=>d.id===next.id?next:d):[...current,next];
          cacheTerritoryDoors(merged);
          return merged;
        });
      }).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[employee?.id]);


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
    const points: [number, number][] = (raw as number[][]).map((pair) => [Number(pair[1]), Number(pair[0])] as [number, number]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if(points.length<3){setHouseDiscoveryError('This territory needs a saved boundary before houses can be loaded.');return;}
    if(!force&&(doors.some(d=>d.territory_id===territoryId)||territory?.houses_imported_at))return;
    setDiscoveringHouses(true);setHouseDiscoveryError('');
    try{
      const lats=points.map(p=>p[0]),lngs=points.map(p=>p[1]);
      const elements=await fetchTerritoryHouses({
        south:Math.min(...lats),west:Math.min(...lngs),north:Math.max(...lats),east:Math.max(...lngs),points,residentialOnly:true,
      });
      const houses=mapOsmHouses(elements,points,{residentialOnly:true});
      const existing=doors.filter(d=>d.territory_id===territoryId);
      const seen=new Set(existing.map((d:any)=>String(d.source||'')));
      const rows:any[]=[];
      for(const house of houses){
        if(seen.has(house.source)||existing.some(d=>Math.abs(Number(d.latitude)-house.lat)<.000012&&Math.abs(Number(d.longitude)-house.lng)<.000012))continue;
        seen.add(house.source);
        rows.push({territory_id:territoryId,latitude:house.lat,longitude:house.lng,address:house.address,house_number:house.house_number,street_name:house.street_name,status:'unworked',source:house.source});
      }
      for(let i=0;i<rows.length;i+=250){
        const {error:insertError}=await supabase.from('territory_doors').insert(rows.slice(i,i+250));
        if(insertError)throw insertError;
      }
      const {data:fresh,error:freshError}=await supabase.from('territory_doors').select('*').eq('territory_id',territoryId);
      if(freshError)throw freshError;
      setDoors(prev=>{const next=[...prev.filter(d=>d.territory_id!==territoryId),...(fresh??[])];cacheTerritoryDoors(next);return next;});
      attemptedDiscovery.current.add(territoryId);
      await supabase.from('lead_territories').update({houses_imported_at:new Date().toISOString()}).eq('id',territoryId);
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
  const weekStart=(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());d.setHours(0,0,0,0);return d})();
  const weekSales=sales.filter(s=>s.status==='completed'&&new Date(s.sold_at)>=weekStart);
  const weekRevenue=weekSales.reduce((n,s)=>n+Number(s.sale_amount||0),0);
  const commission=['base_commission','commission_only','custom'].includes(employee?.pay_type||'base_commission')?weekRevenue*Number(employee?.commission_rate||0)/100+weekSales.length*Number(employee?.flat_commission||0):0;
  const weekBase=['base_commission','custom'].includes(employee?.pay_type||'base_commission')?Number(employee?.weekly_base||0):0;
  const weekPerJob=['per_job','custom'].includes(employee?.pay_type||'')?weekSales.length*Number(employee?.per_job_rate||0):0;
  const weekSalary=(employee?.pay_type==='salary'||employee?.pay_type==='custom')?Number(employee?.annual_salary||0)/52:0;
  const estimatedWeekPay=weekBase+commission+weekPerJob+weekSalary;
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
    let address=lead?.address||doorStreetLabel(door,'');
    const fields=fieldsFromLead(lead||{address,city:door.city,state:door.state,postal_code:door.postal_code,notes:door.notes});
    const identity=composedLeadIdentity(fields, lead?.customer_name||'', address);
    setForm({
      ...emptyForm(),
      ...fields,
      customer_name:identity.name,
      address:identity.address||address,
      status:lead?.status||door.status||'unworked',
      service_interest:fields.service,
      vehicle_info:fields.vehicle,
      estimated_value:fields.value,
      converted_customer_id:lead?.converted_customer_id||'',
    });
    if(door.id){const h=await supabase.from('territory_door_history').select('*').eq('door_id',door.id).order('created_at',{ascending:false}).limit(20);setHistory(h.data??[])}
    if(!address&&Number.isFinite(Number(door.latitude))&&Number.isFinite(Number(door.longitude))){
      const geo=await lookupAddress(Number(door.latitude),Number(door.longitude));address=geo?.address||'';
      if(address){setForm(p=>({...p,address,street1:geo?.street||p.street1,city:geo?.city||p.city,state:geo?.state||p.state,postal_code:geo?.postal_code||p.postal_code}));if(door.id){const patch={address,street_name:geo?.street||null,house_number:geo?.house_number||null,city:geo?.city||null,state:geo?.state||null,postal_code:geo?.postal_code||null};await supabase.from('territory_doors').update(patch).eq('id',door.id);setDoors(p=>{const next=p.map(x=>x.id===door.id?{...x,...patch}:x);cacheTerritoryDoors(next);return next;});}}
    }
  };

  const pickMapPoint=async(lat:number,lng:number)=>{
    setManual(true);setSelectedDoor({latitude:lat,longitude:lng,territory_id:undefined});setHistory([]);setForm({...emptyForm(),address:'Locating address…'});
    const geo=await lookupAddress(lat,lng);setForm(p=>({...p,address:geo?.address||'',street1:geo?.street||p.street1,city:geo?.city||'',state:geo?.state||'',postal_code:geo?.postal_code||''}));
  };

  const checkDuplicate=async(phoneRaw?:string,addressRaw?:string)=>{
    const phone=(phoneRaw??form.phone).replace(/\D/g,'').slice(-10);const address=(addressRaw??form.address).trim().toLowerCase().replace(/\s+/g,' ');
    if(!phone&&!address)return null;
    let query=supabase.from('leads').select('id,customer_name,address,phone,status,assigned_employee_id,archived_at,cooldown_until,archive_reason').limit(5);
    if(phone)query=query.eq('normalized_phone',phone);else query=query.eq('normalized_address',address);
    const {data}=await query;return(data??[]).filter((x:any)=>x.id!==selectedDoor?.lead_id);
  };

  const queueOffline=(action:OfflineAction)=>{const q=loadOffline();q.push(action);localStorage.setItem(OFFLINE_KEY,JSON.stringify(q));setOfflineCount(q.length)};
  const syncOffline=async()=>{
    if(!employee||!navigator.onLine)return;const q=loadOffline();if(!q.length)return;
    const remaining:OfflineAction[]=[];
    for(const item of q){
      try{
        if(item.type==='save_lead'){
          const {error}=await supabase.from('leads').upsert(item.payload,{onConflict:'id'});
          if(error)throw error;
        }else if(item.type==='door_status'){
          const {error}=await supabase.from('territory_doors').update(item.payload.patch).eq('id',item.payload.id);
          if(error)throw error;
        }else if(item.type==='create_appointment'){
          const leadId=item.payload.lead_id as string|undefined;
          if(leadId){
            const existingLead=await supabase.from('leads').select('appointment_id').eq('id',leadId).maybeSingle();
            if(existingLead.data?.appointment_id)continue;
            const existingAppt=await supabase.from('appointments').select('id').eq('lead_id',leadId).limit(1).maybeSingle();
            if(existingAppt.data?.id){
              await supabase.from('leads').update({status:'appointment_set',appointment_id:existingAppt.data.id}).eq('id',leadId);
              continue;
            }
          }
          const {data,error}=await supabase.from('appointments').insert(item.payload).select('id').maybeSingle();
          if(error)throw error;
          if(data?.id&&leadId)await supabase.from('leads').update({status:'appointment_set',appointment_id:data.id}).eq('id',leadId);
          if(data?.id&&item.payload.customer_email)void notifyCustomer('booking_received',{...item.payload,id:data.id});
        }
      }catch{remaining.push(item)}
    }
    localStorage.setItem(OFFLINE_KEY,JSON.stringify(remaining));setOfflineCount(remaining.length);if(remaining.length!==q.length)await load();
  };

  const saveLead=async(e?:React.FormEvent,forcedStatus?:string,override?:Partial<ReturnType<typeof emptyForm>>,doorOverride?:typeof selectedDoor,opts?:{keepOpen?:boolean;skipDuplicatePrompt?:boolean}):Promise<boolean>=>{
    e?.preventDefault();if(!employee)return false;
    const door=doorOverride||selectedDoor;
    if(!door)return false;setSaving(true);
    const data={...form,...override};
    const identity=composedLeadIdentity({
      first_name:data.first_name, last_name:data.last_name, phone:data.phone, alt_phone:data.alt_phone, email:data.email,
      street1:data.street1, street2:data.street2, city:data.city, state:data.state, postal_code:data.postal_code,
      notes:data.notes, vehicle:data.vehicle_info||data.vehicle, service:data.service_interest||data.service,
      value:data.estimated_value||data.value, follow_up_at:data.follow_up_at, appointment_at:data.appointment_at,
    }, data.customer_name, data.address);
    const nextStatus=forcedStatus||data.status||'unworked';
    const isManual=!door.id;
    if(nextStatus==='appointment_set'&&!data.appointment_at){setSaving(false);alert('Set the appointment time before saving. Dispatch needs a window.');return false;}
    if(isManual&&!String(identity.name||data.phone||identity.address||'').trim()){setSaving(false);alert('Add a name, phone, or street before saving this lead.');return false;}
    const duplicates=opts?.skipDuplicatePrompt?[]:((await checkDuplicate(data.phone,identity.address||data.address))??[]);
    const protectedDuplicate=duplicates?.find((x:any)=>x.status==='do_not_knock'||(x.cooldown_until&&new Date(x.cooldown_until)>new Date()));
    if(protectedDuplicate){setSaving(false);alert(protectedDuplicate.status==='do_not_knock'?'This address/contact is permanently Do Not Knock.':'This lead is in the 6-month archive cooldown and cannot be reused yet.');return false;}
    if(duplicates?.length&&!window.confirm(`Possible duplicate lead found: ${duplicates[0].customer_name||duplicates[0].address||duplicates[0].phone}. Save anyway?`)){setSaving(false);return false;}
    const territory_id=door.territory_id||(!isManual?selectedTerritory:null)||null;
    const payload:any={
      ...(door.lead_id?{id:door.lead_id}:{}),assigned_employee_id:employee.id,territory_id,territory_door_id:door.id||null,
      customer_name:identity.name||null,address:identity.address||null,city:data.city||null,state:data.state||null,postal_code:data.postal_code||null,
      source:data.lead_source||'d2d',phone:data.phone||null,email:data.email||null,status:nextStatus,
      service_interest:data.service_interest||data.service||null,vehicle_info:data.vehicle_info||data.vehicle||null,estimated_value:Number(data.estimated_value||data.value||0),
      follow_up_at:data.follow_up_at?new Date(data.follow_up_at).toISOString():null,
      notes:[data.alt_phone?`Alt phone: ${data.alt_phone}`:'',data.notes].filter(Boolean).join('\n')||null,
      ...(data.converted_customer_id?{converted_customer_id:data.converted_customer_id}:{}),
      latitude:door.latitude??null,longitude:door.longitude??null,last_contacted_at:new Date().toISOString(),
      next_action:nextStatus==='follow_up'?'follow_up':nextStatus==='estimate'?'send_estimate':nextStatus==='appointment_set'?'appointment':null,
      next_action_at:data.follow_up_at?new Date(data.follow_up_at).toISOString():null,
      ...(['not_interested','cancelled','lost'].includes(nextStatus)?(()=>{const d=new Date();d.setMonth(d.getMonth()+6);return{archived_at:new Date().toISOString(),archive_reason:nextStatus,cooldown_until:d.toISOString(),reactivation_status:'cooldown'}})():{}),
      ...(nextStatus==='do_not_knock'?{archived_at:new Date().toISOString(),archive_reason:'do_not_knock',cooldown_until:null,reactivation_status:'permanent_dnk'}:{}),
    };
    try{
      if(!navigator.onLine)throw new Error('offline');
      let saved:any;
      if(door.lead_id){const r=await supabase.from('leads').update(payload).eq('id',door.lead_id).select().single();if(r.error)throw r.error;saved=r.data;setLeads(p=>p.map(x=>x.id===saved.id?saved:x));}
      else{const r=await supabase.from('leads').insert(payload).select().single();if(r.error)throw r.error;saved=r.data;setLeads(p=>[saved,...p]);}
      try{await supabase.from('lead_contact_attempts').insert({lead_id:saved.id,employee_id:employee.id,channel:isManual?'other':'door',outcome:nextStatus,notes:data.notes||null,attempted_at:new Date().toISOString()});}catch{/* optional intelligence table */}
      try{await supabase.from('lead_activities').insert({lead_id:saved.id,employee_id:employee.id,activity_type:'field_update',previous_status:door.status||null,new_status:nextStatus,notes:data.notes||null});}catch{/* keep field work moving */}
      if(door.id){
        const patch:any={lead_id:saved.id,status:nextStatus,last_visited_at:new Date().toISOString(),last_employee_id:employee.id,notes:data.notes,next_follow_up_at:data.follow_up_at?new Date(data.follow_up_at).toISOString():null,...(nextStatus==='do_not_knock'?{do_not_knock:true}:{})};
        const d=await supabase.from('territory_doors').update(patch).eq('id',door.id).select().single();if(d.error)throw d.error;setDoors(p=>{const next=p.map(x=>x.id===door.id?d.data:x);cacheTerritoryDoors(next);return next;});
        if(route?.id){await supabase.from('territory_route_stops').update({status:'completed',completed_at:new Date().toISOString()}).eq('route_id',route.id).eq('door_id',door.id);setRouteDoorIds(p=>p.filter(id=>id!==door.id));}
      }
      if(nextStatus==='appointment_set'&&data.appointment_at)await createAppointment(saved,data);
      const keep=opts?.keepOpen || (opts?.keepOpen!==false && !CLOSE_AFTER_KNOCK.has(nextStatus) && nextStatus!=='no_answer');
      if(keep){
        setSelectedDoor({...door,lead_id:saved.id,status:nextStatus} as any);
        setForm((p:any)=>({...p,status:nextStatus}));
        if(door.id){const h=await supabase.from('territory_door_history').select('*').eq('door_id',door.id).order('created_at',{ascending:false}).limit(20);setHistory(h.data??[])}
      } else {
        setSelectedDoor(null);setManual(false);setHistory([]);
      }
      setSaving(false);return true;
    }catch(error:any){
      if(!navigator.onLine||String(error?.message||'').toLowerCase().includes('network')){
        const leadId=payload.id||door.lead_id||crypto.randomUUID();
        queueOffline({id:crypto.randomUUID(),type:'save_lead',payload:{...payload,id:leadId},created_at:new Date().toISOString()});
        if(door.id)queueOffline({id:crypto.randomUUID(),type:'door_status',payload:{id:door.id,patch:{status:nextStatus,last_visited_at:new Date().toISOString(),last_employee_id:employee.id,notes:data.notes,lead_id:leadId}},created_at:new Date().toISOString()});
        if(nextStatus==='appointment_set'&&data.appointment_at)queueOffline({id:crypto.randomUUID(),type:'create_appointment',payload:appointmentDraft({...payload,id:leadId},employee,data,door),created_at:new Date().toISOString()});
        alert('Saved offline. North Splash will sync this lead when your connection returns.');setSelectedDoor(null);setManual(false);setSaving(false);return true;
      }else alert(error?.message||'Unable to save lead.');setSaving(false);return false;
    }
  };

  const createEstimate=async()=>{
    if(!employee||!selectedDoor)return;let lead=selectedDoor.lead_id?leads.find(l=>l.id===selectedDoor.lead_id):null;
    if(!lead){await saveLead(undefined,'estimate');return alert('Lead saved. Reopen the house and create the estimate.');}
    const amount=Number(form.estimated_value||lead.estimated_value||0);const {data,error}=await supabase.from('customer_estimates').insert({lead_id:lead.id,employee_id:employee.id,sales_rep_employee_id:employee.id,amount,subtotal:amount,total:amount,status:'draft',line_items:[{name:form.service_interest||'Detailing service',quantity:1,price:amount}],notes:form.notes}).select().single();if(error)return alert(error.message);
    await supabase.from('leads').update({status:'estimate',estimate_id:data.id}).eq('id',lead.id);setLeads(p=>p.map(x=>x.id===lead!.id?{...x,status:'estimate',estimate_id:data.id}:x));setForm(p=>({...p,status:'estimate'}));
    const email=form.email||lead.email;
    if(email)sendCommunication('estimate_sent',{estimate_id:data.id,lead_id:lead.id,recipient_email:email,variables:{customer_name:form.customer_name||lead.customer_name||'Customer',service_name:form.service_interest||lead.service_interest||'Detailing service',price:money(amount)}}).catch(console.warn);
    alert('Estimate created. It is now attached to this lead.');
  };

  const createAppointment=async(lead:Lead,source:ReturnType<typeof emptyForm>=form)=>{
    if(!employee||!source.appointment_at)return;
    const service=source.service_interest||lead.service_interest||'Detailing Service';
    const duration=minutesForService(service,120);
    const dest={lat:selectedDoor?.latitude??lead.latitude,lng:selectedDoor?.longitude??lead.longitude,address:form.address||lead.address};
    const plan=await planAppointmentTiming({appointments,durationMinutes:duration,destination:dest,requestedStart:new Date(source.appointment_at),shopLane:true});
    if(plan.previous)await supabase.from('appointments').update({travel_buffer_minutes:plan.inboundMinutes}).eq('id',plan.previous.id);
    if(plan.snapped)setForm((p:any)=>({...p,appointment_at:toLocalInput(plan.start)}));
    const {data,error}=await supabase.from('appointments').insert({
      user_id:lead.converted_customer_id||null,customer_name:source.customer_name||lead.customer_name,customer_email:source.email||lead.email,customer_phone:source.phone||lead.phone,
      service_name:service,package_name:source.service_interest||lead.service_interest||null,add_ons:[],vehicle_info:source.vehicle_info||lead.vehicle_info||'',
      scheduled_at:plan.start.toISOString(),status:'pending',price:Number(source.estimated_value||lead.estimated_value||0),notes:source.notes||lead.notes||'',
      service_address:form.address||lead.address,latitude:selectedDoor?.latitude??lead.latitude,longitude:selectedDoor?.longitude??lead.longitude,
      estimated_duration_minutes:duration,travel_buffer_minutes:plan.travelBufferMinutes,
      sales_rep_employee_id:employee.id,lead_id:lead.id,source_channel:'d2d',dispatch_status:'unassigned',field_status:'scheduled',
    }).select().single();if(error)throw error;
    setAppointments(p=>[...p,data].sort((x,y)=>new Date(x.scheduled_at||0).getTime()-new Date(y.scheduled_at||0).getTime()));
    await supabase.from('leads').update({status:'appointment_set',appointment_id:data.id}).eq('id',lead.id);
    setLeads(p=>p.map(x=>x.id===lead.id?{...x,status:'appointment_set',appointment_id:data.id}:x));
    void notifyCustomer('booking_received', data);
  };

  const startRoute=async()=>{
    if(!employee||!selectedTerritory)return;
    if(isOnboardingOpen(employee.onboarding_status)){setTab('onboarding');return;}
    const available=territoryDoors.filter(d=>!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked'));
    if(!available.length)return alert('No eligible houses remain in this territory.');
    const start=live||{latitude:Number(territories.find(t=>t.id===selectedTerritory)?.center_lat||available[0].latitude),longitude:Number(territories.find(t=>t.id===selectedTerritory)?.center_lng||available[0].longitude)};
    const ordered=optimizeWalkingRoute(start,available);let distance=0;let cursor=start;ordered.forEach(stop=>{distance+=haversineMeters(cursor,stop);cursor=stop});
    if(route?.id)await supabase.from('territory_routes').update({status:'completed',ended_at:new Date().toISOString()}).eq('id',route.id);
    const {data,error}=await supabase.from('territory_routes').insert({territory_id:selectedTerritory,employee_id:employee.id,status:'active',total_stops:ordered.length,distance_meters:Math.round(distance),start_latitude:start.latitude,start_longitude:start.longitude}).select().single();if(error)return alert(error.message);
    const stops=ordered.map((d,i)=>({route_id:data.id,door_id:d.id,stop_order:i+1,status:'pending'}));if(stops.length){const r=await supabase.from('territory_route_stops').insert(stops);if(r.error)return alert(r.error.message)}
    setRoute(data);setRouteDoorIds(ordered.map(d=>d.id));setTab('territory');
  };
  const toggleRoute=async()=>{if(!route)return;const status=route.status==='paused'?'active':'paused';const patch=status==='paused'?{status,paused_at:new Date().toISOString()}:{status,paused_at:null};await supabase.from('territory_routes').update(patch).eq('id',route.id);setRoute({...route,...patch});};
  const finishRoute=async()=>{if(!route)return;await supabase.from('territory_routes').update({status:'completed',ended_at:new Date().toISOString()}).eq('id',route.id);setRoute(null);setRouteDoorIds([]);};
  const nextBest=()=>{const nextId=routeDoorIds[0];const start=live||(selectedDoor&&selectedDoor.latitude!=null&&selectedDoor.longitude!=null?{latitude:Number(selectedDoor.latitude),longitude:Number(selectedDoor.longitude)}:territoryDoors[0]||{latitude:MARKET.lat,longitude:MARKET.lng});const door=nextId?doors.find(d=>d.id===nextId):rankNextBestHouse(start as any,territoryDoors.filter(d=>!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked')))[0];if(door){pickDoor(door);setTab('territory')}else alert('No available house found.');};

  const saveAndNext=async()=>{
    const current=selectedDoor;
    if(!current)return;
    const ok=await saveLead(undefined,form.status,undefined,undefined,{keepOpen:false,skipDuplicatePrompt:Boolean(current.id)});
    if(!ok)return;
    const start={latitude:Number(current.latitude??live?.latitude??MARKET.lat),longitude:Number(current.longitude??live?.longitude??MARKET.lng)};
    const remaining=territoryDoors.filter(d=>d.id!==current.id&&!d.do_not_knock);
    const unworked=remaining.filter(d=>(d.status||'unworked')==='unworked');
    const fallback=remaining.filter(d=>['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked'));
    const candidates=rankNextBestHouse(start,unworked.length?unworked:fallback);
    if(candidates[0])setTimeout(()=>pickDoor(candidates[0]),80);
  };

  const knockDoor=async(status:string)=>{
    if(NEEDS_TIME_KEYS.has(status)){
      if(status==='appointment_set'&&!form.appointment_at){setForm((p:any)=>({...p,status}));return;}
      if(status==='follow_up'&&!form.follow_up_at){setForm((p:any)=>({...p,status}));return;}
    }
    await saveLead(undefined,status,undefined,undefined,{keepOpen:!CLOSE_AFTER_KNOCK.has(status),skipDuplicatePrompt:Boolean(selectedDoor?.id)});
  };

  const skipRouteHouse=async()=>{
    const id=routeDoorIds[0];
    if(!id)return;
    if(route?.id)await supabase.from('territory_route_stops').update({status:'skipped'}).eq('route_id',route.id).eq('door_id',id);
    setRouteDoorIds(p=>p.filter(x=>x!==id));
  };

  const manualLead=()=>{setManual(true);setSelectedDoor({territory_id:selectedTerritory||undefined,latitude:live?.latitude,longitude:live?.longitude});setHistory([]);setForm({...emptyForm(),status:'interested'});};
  const openPitch=(source:string,mode:'presentation'|'quote'|'account'='presentation')=>{setPitchMode(mode);setPitchOpen(true);logPresentationEvent('presentation_opened',{source,mode});};
  const offerPatch=(offer:OfferSelection)=>{
    const hh=offer.household;
    const fields=householdAsLeadFields(hh);
    const identity=composedLeadIdentity(fields, hh.name, hh.address);
    const note=offer.name
      ?(offer.type==='membership'?`Membership interest: ${offer.name} at ${money(offer.amount)}/mo`:`Presented ${offer.name} estimate at ${money(offer.amount)}`)
      :(offer.createPortalAccount?'Customer portal account from presentation':'Household captured from presentation');
    const nextStatus=['unworked','no_answer','revisit','contacted'].includes(form.status)
      ?(offer.createPortalAccount&&!offer.name?'customer':offer.name?(offer.type==='membership'?'interested':'estimate'):'interested')
      :form.status;
    return {
      customer_name:identity.name||form.customer_name,
      first_name:fields.first_name||form.first_name,
      last_name:fields.last_name||form.last_name,
      phone:fields.phone||form.phone,
      alt_phone:fields.alt_phone||form.alt_phone,
      email:fields.email||form.email,
      address:identity.address||form.address,
      street1:fields.street1||form.street1,
      street2:fields.street2||form.street2,
      city:fields.city||form.city,
      state:fields.state||form.state,
      postal_code:fields.postal_code||form.postal_code,
      vehicle_info:fields.vehicle||form.vehicle_info,
      vehicle:fields.vehicle||form.vehicle,
      service_interest:offer.name||form.service_interest,
      estimated_value:offer.amount?String(offer.amount):form.estimated_value,
      notes:[form.notes,note].filter(Boolean).join('\n'),
      status:nextStatus,
      converted_customer_id:form.converted_customer_id,
    };
  };
  const useSalesOffer=(offer:OfferSelection)=>{
    const patch=offerPatch(offer);
    setForm(f=>({...f,...patch}));
    setPitchOpen(false);
    if(!selectedDoor&&!manual){setManual(true);setSelectedDoor({territory_id:selectedTerritory||undefined,latitude:live?.latitude,longitude:live?.longitude});}
  };
  const applyAndSaveOffer=async(offer:OfferSelection):Promise<ApplyOfferResult>=>{
    const patch=offerPatch(offer);
    setForm(f=>({...f,...patch}));
    const door=selectedDoor||{territory_id:selectedTerritory||undefined,latitude:live?.latitude,longitude:live?.longitude};
    if(!selectedDoor){setManual(true);setSelectedDoor(door);}
    let account:ApplyOfferResult['account'];
    if(offer.createPortalAccount){
      try{
        account=await createDoorCustomerAccount({
          email:offer.household.email,
          password:offer.portalPassword,
          full_name:offer.household.name||composedLeadIdentity(householdAsLeadFields(offer.household)).name,
          phone:offer.household.phone,
          vehicle_info:offer.household.vehicle,
          address:offer.household.address,
          lead_id:selectedDoor?.lead_id||null,
          send_email:offer.sendInviteEmail,
          membership:offer.type==='membership'&&offer.name?{name:offer.name,price:offer.amount}:null,
        });
        patch.converted_customer_id=account.user_id;
        setForm(f=>({...f,...patch,converted_customer_id:account!.user_id,email:account!.email||patch.email}));
      }catch(err){
        return {saved:false,error:err instanceof Error?err.message:'Unable to create the customer portal account.'};
      }
    }
    const ok=await saveLead(undefined,patch.status,patch,door);
    if(!ok)return {saved:false,error:'Household was captured, but the lead could not be saved.'};
    if(account)return {saved:true,account};
    setPitchOpen(false);
    setTab('leads');
    return {saved:true};
  };
  const useCurrentLocation=()=>navigator.geolocation?.getCurrentPosition(async p=>{const lat=p.coords.latitude,lng=p.coords.longitude;setSelectedDoor(d=>({...d,latitude:lat,longitude:lng}));window.dispatchEvent(new CustomEvent('northsplash:center-map',{detail:{latitude:lat,longitude:lng,zoom:19}}));const geo=await lookupAddress(lat,lng);if(geo?.address)setForm(f=>({...f,address:geo.address,street1:geo.street||f.street1,city:geo.city||f.city,state:geo.state||f.state,postal_code:geo.postal_code||f.postal_code}))},()=>alert('Allow location access to pin this lead.'),{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
  const logPresentationEvent=(event:string,detail:Record<string,unknown>={})=>{
    if(!employee)return;
    void supabase.from('d2d_presentation_events').insert({employee_id:employee.id,lead_id:selectedDoor?.lead_id||null,territory_id:selectedTerritory||null,event_type:event,event_data:detail}).then(()=>{},()=>{});
  };

  const clock=async()=>{if(!employee)return;if(openEntry){const pos=await getPosition();const {data,error}=await supabase.from('time_entries').update({clock_out:new Date().toISOString(),clock_out_latitude:pos?.latitude??null,clock_out_longitude:pos?.longitude??null}).eq('id',openEntry.id).select().single();if(error)return alert(error.message);setTimes(p=>p.map(t=>t.id===openEntry.id?data:t));}
    else{const pos=await getPosition();const {data,error}=await supabase.from('time_entries').insert({employee_id:employee.id,clock_in:new Date().toISOString(),clock_in_latitude:pos?.latitude??null,clock_in_longitude:pos?.longitude??null,status:'pending'}).select().single();if(error)return alert(error.message);setTimes(p=>[data,...p]);}};

  const createCalendarAppointment=async(payload:Record<string,unknown>)=>{
    if(!employee)return;
    const {data,error}=await supabase.from('appointments').insert({...payload,sales_rep_employee_id:employee.id,source_channel:'d2d',field_status:'scheduled',dispatch_status:'unassigned'}).select().single();
    if(error){alert(error.message);return}
    setAppointments(p=>[...p,data].sort((a,b)=>new Date(a.scheduled_at||0).getTime()-new Date(b.scheduled_at||0).getTime()));
    if(data.lead_id){await supabase.from('leads').update({status:'appointment_set',appointment_id:data.id,next_action:'appointment',next_action_at:data.scheduled_at}).eq('id',data.lead_id);setLeads(p=>p.map(l=>l.id===data.lead_id?{...l,status:'appointment_set',appointment_id:data.id}:l))}
    void notifyCustomer('booking_received', data);
  };
  const updateCalendarAppointment=async(id:string,payload:Record<string,unknown>)=>{const {data,error}=await supabase.from('appointments').update(payload).eq('id',id).select().single();if(error){alert(error.message);return}setAppointments(p=>p.map(a=>a.id===id?data:a))};

  const logout=async()=>{await signOut().catch(()=>{});navigate('/')};
  if(loading||busy)return <WorkspaceGate busy title="Opening D2D" body="Loading territories, doors, and today's knocks." />;
  if(loadError&&!employee)return <WorkspaceGate title="Could not open D2D" body={loadError} onRetry={()=>{setBusy(true);void load()}} homeHref="/login" homeLabel="Back to sign in" />;
  if(!employee)return <WorkspaceGate title="D2D profile not linked" body="Ask an owner to link your login in People → Permissions." homeHref="/login" homeLabel="Back to sign in" />;

  const nav:[Tab,string,any,string][]=[
    ['territory','Territory',MapPin,'field'],['route','Route',Route,'field'],['leads','My Leads',Target,'field'],['calendar','Calendar',CalendarDays,'field'],['followups','Follow-Ups',Navigation,'field'],['presentation','Sales Presentation',Presentation,'field'],['messages','Messages',MessageCircle,'field'],
    ['performance','Performance',BarChart3,'performance'],['onboarding','Onboarding',ClipboardCheck,'account'],['timeclock','Time Clock',Clock3,'account'],['training','Training',Award,'account'],
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
  const dueFollowups=leads.filter(l=>l.status==='follow_up'||(l.follow_up_at&&new Date(l.follow_up_at)<=new Date()));
  // Keep this as a plain calculation instead of a hook. The D2D page has early
  // loading returns above, so adding a hook here changes the hook count between
  // the loading render and the loaded render and causes React to blank the route.
  const nextSuggestedDoor=(()=>{
    const eligible=territoryDoors.filter(d=>!d.do_not_knock&&['unworked','no_answer','revisit','follow_up'].includes(d.status||'unworked'));
    if(!eligible.length)return null;
    const start=live||territoryDoors[0]||{latitude:MARKET.lat,longitude:MARKET.lng};
    return rankNextBestHouse(start,eligible)[0];
  })();
  const fieldStats=canvassTerritoryStats(territoryDoors,leads.filter(l=>!selectedTerritory||l.territory_id===selectedTerritory),sales);
  const mapDoors=territoryDoors.map(d=>{
    const lead=d.lead_id?leads.find(l=>l.id===d.lead_id):null;
    return {...d,customer_name:lead?.customer_name||null,assigned_name:employee?.name||''};
  });
  const nextRouteDoor=routeDoorIds[0]?doors.find(d=>d.id===routeDoorIds[0]):null;
  const routeRemainingMeters=(()=>{
    if(!routeDoorIds.length)return 0;
    let cursor=live||nextRouteDoor||{latitude:MARKET.lat,longitude:MARKET.lng};
    let meters=0;
    for(const id of routeDoorIds){
      const door=doors.find(d=>d.id===id);
      if(!door)continue;
      meters+=haversineMeters(cursor as any,door);
      cursor=door;
    }
    return meters;
  })();
  const completedRouteStops=Math.max(0,Number(route?.total_stops||0)-routeDoorIds.length);

  return <div className={`portal-layout d2d-os nsos-cream${tab==='messages'?' os-tab-messages':''}`}>
    <a className="skip-to-workspace" href="#portal-workspace">Skip to workspace</a>
    <aside className={`portal-sidebar ${sidebar?'sidebar-open':''}`}>
      <div className="sidebar-header"><Link to="/" className="sidebar-brand"><img className="portal-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe"/><div><strong>D2D SALES</strong><small>NORTH SPLASH</small></div></Link><button className="sidebar-close" onClick={()=>setSidebar(false)}><X size={18}/></button></div>
      <div className="sidebar-user"><EmployeeAvatar employee={employee} size="md" editable onUploaded={url=>setEmployee(p=>p?{...p,avatar_url:url}:p)} className="sidebar-avatar"/><div><p>{employee.name}</p><span>Level {employee.employment_level||1} · {employee.commission_rate}%</span></div></div>
      <nav className="sidebar-nav">{[['field','Field Work'],['performance','Results'],['account','My Account']].map(([id,label])=><div className="nav-group" key={id}><button className="nav-group-title" onClick={()=>setGroups(p=>Object.fromEntries(Object.keys(p).map(k=>[k,k===id?!p[id]:false])))}>{label}<ChevronDown size={14} className={groups[id]?'nav-chevron-open':''}/></button>{groups[id]&&nav.filter(n=>n[3]===id).map(([tid,l,Icon])=><button key={tid} className={`sidebar-item ${tab===tid?'sidebar-active':''}`} onClick={()=>{setTab(tid);setSidebar(false)}}><Icon size={18}/>{l}{tid==='onboarding'&&isOnboardingOpen(employee.onboarding_status)&&<span className="nav-count">1</span>}{tid==='followups'&&dueFollowups.length>0&&<span className="nav-count">{dueFollowups.length}</span>}</button>)}</div>)}</nav>
      <div className="sidebar-footer"><PortalSwitchGrid allow={canSwitchLivePortals(profile?.portal_role)}/><div className={`connection-pill ${online?'online':'offline'}`}>{online?'Online':'Offline'}{offlineCount>0&&` · ${offlineCount} queued`}</div><button className="sidebar-item sidebar-signout" onClick={logout}><LogOut size={18}/>Sign Out</button></div>
    </aside>
    {sidebar&&<div className="sidebar-backdrop" onClick={()=>setSidebar(false)}/>}<main id="portal-workspace" className="portal-main" tabIndex={-1}>
      <div className="portal-topbar"><button className="sidebar-toggle" onClick={()=>setSidebar(true)}><Menu size={20}/></button><div className="topbar-title"><h1>{nav.find(n=>n[0]===tab)?.[1]}</h1><span>{territories.find(t=>t.id===selectedTerritory)?.name||'No territory assigned'}</span></div><div className="topbar-actions"><TopbarOwnerLink allow={canSwitchLivePortals(profile?.portal_role)}/>{offlineCount>0&&<button className="btn-outline" onClick={syncOffline}><RefreshCw size={15}/> Sync {offlineCount}</button>}</div></div>
      <PortalSwitchRail allow={canSwitchLivePortals(profile?.portal_role)}/>
      <BackToOwnerBanner allow={canSwitchLivePortals(profile?.portal_role)}/>
      <div className="portal-content">
        {loadError&&<div className="d2d-house-discovery error">{loadError}<button type="button" onClick={()=>void load()}>Retry</button></div>}
        {(!online||offlineCount>0)&&<div className={`d2d-offline-banner ${online?'queued':'down'}`}><WifiOff size={16}/><div><strong>{online?`${offlineCount} knock${offlineCount===1?'':'s'} queued`:'Working offline'}</strong><span>{online?'Sync when the connection is solid.':'Knocks save on this phone until you are back online.'}</span></div>{online&&offlineCount>0&&<button type="button" className="btn-primary" onClick={()=>void syncOffline()}>Sync now</button>}</div>}
        {isOnboardingOpen(employee.onboarding_status)&&tab!=='onboarding'&&<button type="button" className="portal-notice" onClick={()=>setTab('onboarding')}><ClipboardCheck size={17}/><div><strong>Finish your Gusto hire packet</strong><span>Personal details, W-4, payment method, I-9, and emergency contact.</span></div><small>Open</small></button>}
        {tab==='onboarding'&&<div className="tab-content v2-page"><EmployeeOnboardingTab employee={employee} audience="self" onUpdated={setEmployee} onOpenTraining={()=>setTab('training')}/></div>}
        {tab==='territory'&&<div className="tab-content d2d-field-page v2-page d2d-canvass-page">
          <div className="v2-page-head"><div><span className="eyebrow">Canvass</span><h2>Work the neighborhood</h2><p>Tap a house, mark the door, keep walking. Details stay optional.</p></div><div className="v2-head-actions"><button className="btn-outline" onClick={()=>openPitch('territory_quote','quote')}><Presentation size={15}/> Quote</button><button className="btn-outline" onClick={manualLead}><Plus size={15}/> Add Lead</button><button className="btn-primary" onClick={nextBest}><Target size={15}/> Next Best House</button></div></div>
          <div className="d2d-field-commandbar">
            <div className="d2d-command-territory"><MapPin size={19}/><div><strong>{territories.find(t=>t.id===selectedTerritory)?.name||'Assigned Territory'}</strong><span>{fieldStats.worked} / {fieldStats.total} houses worked · {fieldStats.progress}%</span></div></div>
            <div className="d2d-command-next"><Target size={18}/><div><small>NEXT BEST HOUSE</small><strong>{doorStreetLabel(nextSuggestedDoor,'Choose next mapped house')}</strong></div><button onClick={nextBest}>Open <Navigation size={14}/></button></div>
            <button className="d2d-command-route" onClick={startRoute}><Route size={18}/>{route?'Rebuild Route':'Start Route'}</button>
          </div>
          <div className="d2d-canvass-stats"><Kpi label="Properties" value={String(fieldStats.total)} detail={`${fieldStats.remaining} remaining`}/><Kpi label="Worked" value={String(fieldStats.worked)} detail={`${fieldStats.progress}%`}/><Kpi label="Contacted" value={String(fieldStats.contacted)}/><Kpi label="Interested" value={String(fieldStats.interested)}/><Kpi label="Follow-ups" value={String(fieldStats.followUps)}/><Kpi label="Estimates" value={String(fieldStats.estimates)}/><Kpi label="Appointments" value={String(fieldStats.appointments)}/><Kpi label="Sales" value={String(fieldStats.sales)} detail={`${fieldStats.conversion}% conversion`}/><Kpi label="Revenue" value={money(fieldStats.revenue||revenueToday)} detail={`Today ${money(revenueToday)}`}/></div>
          {route&&<div className="d2d-route-hud">
            <div>
              <small>ROUTE MODE{live?' · live location':''}</small>
              <strong>{doorStreetLabel(nextRouteDoor||nextSuggestedDoor,'Next recommended house')}</strong>
              <small>{routeDoorIds.length} remaining · {completedRouteStops} completed · {formatDistance(routeRemainingMeters)}</small>
            </div>
            <div className="d2d-route-hud-actions">
              {nextRouteDoor&&<a className="btn-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${nextRouteDoor.latitude},${nextRouteDoor.longitude}`)}`}><Navigation size={15}/> Navigate</a>}
              <button type="button" className="btn-outline" onClick={()=>nextRouteDoor?pickDoor(nextRouteDoor):nextBest()}>Open next</button>
              <button type="button" className="btn-outline" onClick={skipRouteHouse}>Skip house</button>
              <button type="button" className="btn-outline" onClick={toggleRoute}>{route.status==='paused'?<Play size={15}/>:<Pause size={15}/>} {route.status==='paused'?'Resume':'Pause'}</button>
            </div>
          </div>}
          <div className="d2d-map-shell">
            <div className="d2d-map-topline">
              <div className="d2d-territory-select"><label>Assigned Territory</label><select value={selectedTerritory} onChange={e=>{setSelectedTerritory(e.target.value);setSelectedDoor(null);setHouseDiscoveryError('')}}>{territories.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div>
              <label className="d2d-canvass-search"><Search size={15}/><input value={canvassSearch} onChange={e=>setCanvassSearch(e.target.value)} placeholder="Search address or customer" aria-label="Search houses"/></label>
              <div className="d2d-field-actions"><button className="btn-outline" onClick={()=>discoverTerritoryHouses(selectedTerritory,true)} disabled={!selectedTerritory||discoveringHouses}><RefreshCw size={15}/>{discoveringHouses?'Finding Houses…':'Refresh Houses'}</button><button className="btn-outline" onClick={()=>setShowLabels(v=>!v)}>{showLabels?'Hide Labels':'Show Addresses'}</button><button className="btn-outline" onClick={startRoute}><Route size={15}/> {route?'Rebuild Route':'Build Route'}</button></div>
            </div>
            <div className="d2d-filter-row v2-status-scroller">{DOOR_STATUSES.filter(x=>CANVASS_FILTER_KEYS.includes(x.key)).map(s=><button key={s.key} type="button" title={s.label} aria-label={s.label} className={filters.includes(s.key)?'status-filter active dim-mode':'status-filter'} onClick={()=>setFilters(p=>p.includes(s.key)?p.filter(x=>x!==s.key):[...p,s.key])}><i style={{background:s.color}}/><b>{s.short}</b><span className="status-filter-name">{s.label}</span></button>)}</div>
            {discoveringHouses&&<div className="d2d-house-discovery"><span className="live-dot"/> Mapping residential doors inside this territory…</div>}
            {houseDiscoveryError&&<div className="d2d-house-discovery error">{houseDiscoveryError}<button type="button" onClick={()=>discoverTerritoryHouses(selectedTerritory,true)}>Try again</button></div>}
            {!territories.length?<div className="ns-empty"><strong>No territory assigned</strong><p>Ask an owner to pin a neighborhood to this D2D login. Once it lands, houses, knock colors, and Next Best House appear here.</p></div>:!territoryDoors.length?<div className="ns-empty"><strong>No houses mapped yet</strong><p>Refresh houses for this territory, or ask an owner to redraw the neighborhood.</p><button type="button" className="btn-primary" onClick={()=>discoverTerritoryHouses(selectedTerritory,true)} disabled={!selectedTerritory||discoveringHouses}>{discoveringHouses?'Finding Houses…':'Refresh Houses'}</button></div>:<FieldTerritoryMap fieldMode className="d2d-primary-map" territories={territories.filter(t=>!selectedTerritory||t.id===selectedTerritory)} doors={mapDoors} leads={leads.filter(l=>!selectedTerritory||l.territory_id===selectedTerritory)} liveLocation={live} routeDoorIds={routeDoorIds} activeDoorId={selectedDoor?.id||null} statusFilter={filters} filterMode="dim" searchQuery={canvassSearch} showDoorLabels={showLabels} onDoorClick={pickDoor} onMapClick={pickMapPoint}/>}
            {!selectedDoor&&!manual&&<button type="button" className="d2d-phone-next" onClick={nextBest}><Target size={18}/><span><small>Next Best House</small><strong>{doorStreetLabel(nextSuggestedDoor,'Open the next door')}</strong></span><Navigation size={16}/></button>}
            <div className="territory-bottom-stats v2-map-footer"><span><strong>{fieldStats.progress}%</strong> complete</span>{currentStreet&&<span><strong>{streetProgress}%</strong> {currentStreet}</span>}<span><strong>{fieldStats.followUps}</strong> follow-ups</span><span><strong>{fieldStats.remaining}</strong> remaining</span>{!online&&<span><WifiOff size={14}/> Offline</span>}</div>
          </div>
        </div>}

        {tab==='route'&&<div className="tab-content"><div className="route-hero"><div><span className="eyebrow">FIELD ROUTE</span><h2>{route?route.status==='paused'?'Route Paused':'Route Active':'No Active Route'}</h2><p>{route?`${routeDoorIds.length} stops remaining`:'Start an optimized route from the Territory screen.'}</p></div>{route&&<div className="route-actions"><button className="btn-outline" onClick={toggleRoute}>{route.status==='paused'?<Play size={15}/>:<Pause size={15}/>} {route.status==='paused'?'Resume':'Pause'}</button><button className="btn-primary" onClick={nextBest}><Navigation size={15}/> Next Stop</button><button className="btn-outline" onClick={finishRoute}>Finish Route</button></div>}</div>{route&&<><FieldTerritoryMap territories={territories.filter(t=>t.id===route.territory_id)} doors={doors.filter(d=>d.territory_id===route.territory_id)} liveLocation={live} routeDoorIds={routeDoorIds} onDoorClick={pickDoor}/><div className="route-stop-list">{routeDoorIds.slice(0,12).map((id,i)=>{const d=doors.find(x=>x.id===id);return d?<button key={id} onClick={()=>pickDoor(d)}><span>{i+1}</span><div><strong>{doorStreetLabel(d)}</strong><small>{doorStatus(d.status).label}</small></div><Navigation size={16}/></button>:null})}</div></>}</div>}

        {tab==='leads'&&<div className="tab-content v2-page"><div className="v2-page-head"><div><span className="eyebrow">Leads</span><h2>My leads</h2><p>Name, phone, and street first. Open any card to pitch, quote, or book.</p></div><div className="v2-head-actions"><button className="btn-outline" onClick={()=>openPitch('leads_quote','quote')}><Presentation size={15}/> Quote</button><button className="btn-primary" onClick={manualLead}><Plus size={15}/> Add Lead</button></div></div><LeadCommandCenter leads={leads} onOpen={l=>pickDoor({id:l.territory_door_id||undefined,lead_id:l.id,latitude:Number(l.latitude||0),longitude:Number(l.longitude||0),address:l.address,territory_id:l.territory_id,status:l.status})} onSchedule={()=>setTab('calendar')} onLeadsPatched={patches=>setLeads(p=>p.map(l=>{const hit=patches.find(x=>x.id===l.id);return hit?{...l,...hit}:l}))} repName={employee.name}/></div>}

        {tab==='calendar'&&<div className="tab-content v2-page"><SharedCalendar mode="rep" appointments={appointments} employees={employee?[employee]:[]} employeeId={employee.id} leads={leads} title="My Customer Calendar" onCreate={createCalendarAppointment} onUpdate={updateCalendarAppointment}/></div>}

        {tab==='followups'&&<div className="tab-content"><div className="v2-page-head"><div><span className="eyebrow">Callbacks</span><h2>Follow-up queue</h2><p>Highest-priority callbacks and revisits first.</p></div></div><div className="followup-grid">{dueFollowups.sort((a,b)=>new Date(a.follow_up_at||0).getTime()-new Date(b.follow_up_at||0).getTime()).map(l=><div className="followup-card" key={l.id}><div><span className="eyebrow">{l.follow_up_at&&new Date(l.follow_up_at)<new Date()?'OVERDUE':'FOLLOW UP'}</span><h3>{leadDisplayName(l)}</h3><p>{l.address}</p></div><div className="followup-meta"><span>{l.follow_up_at?localDateTime(l.follow_up_at):'No date set'}</span><strong>{money(Number(l.estimated_value||0))}</strong></div><div className="followup-actions">{l.phone&&<a className="btn-outline" href={`tel:${l.phone}`}><Phone size={14}/> Call</a>}<button className="btn-primary" onClick={()=>{const door=doors.find(d=>d.id===l.territory_door_id)||doors.find(d=>d.lead_id===l.id);setTab('territory');void pickDoor(door||{id:l.territory_door_id||undefined,lead_id:l.id,latitude:Number(l.latitude||0),longitude:Number(l.longitude||0),address:l.address,territory_id:l.territory_id,status:l.status,notes:l.notes})}}>Open house</button></div></div>)}{!dueFollowups.length&&<div className="ns-empty"><strong>You're caught up</strong><p>No follow-ups are due. New revisits from the map land here automatically.</p></div>}</div></div>}

        {tab==='presentation'&&<div className="tab-content d2d-presentation-page v2-page"><div className="v2-page-head"><div><span className="eyebrow">Pitch</span><h2>Sales presentation</h2><p>Hand the screen to the customer, then open their portal account and apply the offer without leaving the door.</p></div><div className="v2-head-actions"><button className="btn-outline" onClick={()=>openPitch('d2d_tab_account','account')}><UserRound size={15}/> Customer account</button><button className="btn-primary" onClick={()=>openPitch('d2d_tab')}><Presentation size={15}/> Present to customer</button></div></div>
          <div className="d2d-presentation-launch">
            <div>
              <span className="eyebrow">CLOSE AT THE DOOR</span>
              <h3>Pitch, quote, and open their customer account in one flow.</h3>
              <p>Walk through why North Splash, build a live quote, then apply a customer portal login onto this door. The rep stays signed in. The customer leaves with email, password, and /login.</p>
              <div className="d2d-presentation-cta">
                <button className="btn-primary" onClick={()=>openPitch('launch_card')}><Presentation size={17}/> Start presentation</button>
                <button className="btn-outline" onClick={()=>openPitch('launch_quote','quote')}>Jump to quote</button>
                <button className="btn-outline" onClick={manualLead}><Plus size={15}/> Add lead first</button>
              </div>
            </div>
            <div className="d2d-presentation-preview">
              <span>01</span><strong>Introduce North Splash</strong><i/>
              <span>02</span><strong>Build the quote</strong><i/>
              <span>03</span><strong>Create the customer account</strong><i/>
              <span>04</span><strong>Apply & save</strong>
            </div>
          </div>
        </div>}

        {tab==='messages'&&<div className="tab-content v2-page"><TeamMessaging employee={employee} portalKind="d2d"/></div>}

        {tab==='performance'&&<div className="tab-content v2-page"><div className="v2-page-head"><div><span className="eyebrow">Results</span><h2>Performance</h2><p>Doors, conversion, and revenue for the day and the week.</p></div></div><div className="d2d-kpi-strip v2-kpis"><Kpi label="Completed Revenue" value={money(totalRevenue)} detail="Collected / completed sales"/><Kpi label="Commission" value={money(commission)} detail={`${employee.commission_rate||0}% rate`}/><Kpi label="Weekly Base" value={money(weekBase)}/><Kpi label="Contact Rate" value={`${percent(contactsToday,workedToday.length)}%`} detail={`${contactsToday}/${workedToday.length} doors`}/><Kpi label="Appointment Rate" value={`${percent(appointmentsToday,Math.max(contactsToday,1))}%`} detail={`${appointmentsToday} appointments`}/></div><div className="performance-v2-grid"><section className="v2-card goals-card"><div className="v2-card-head"><div><span className="eyebrow">TODAY</span><h3>Goal Progress</h3></div><Gauge size={24}/></div><Goal label="Doors" value={workedToday.length} goal={goals?.door_goal??50}/><Goal label="Contacts" value={contactsToday} goal={goals?.contact_goal??15}/><Goal label="Appointments" value={appointmentsToday} goal={goals?.appointment_goal??4}/><Goal label="Revenue" value={revenueToday} goal={Number(goals?.revenue_goal??1500)} moneyMode/></section><section className="v2-card funnel-card"><div className="v2-card-head"><div><span className="eyebrow">CONVERSION</span><h3>Today's Funnel</h3></div><TrendingUp size={24}/></div><div className="conversion-funnel"><div style={{'--w':'100%'} as any}><span>Doors</span><strong>{workedToday.length}</strong></div><div style={{'--w':`${Math.max(28,percent(contactsToday,Math.max(workedToday.length,1)))}%`} as any}><span>Contacts</span><strong>{contactsToday}</strong></div><div style={{'--w':`${Math.max(20,percent(appointmentsToday,Math.max(workedToday.length,1)))}%`} as any}><span>Appointments</span><strong>{appointmentsToday}</strong></div><div style={{'--w':`${Math.max(14,percent(salesToday.length,Math.max(workedToday.length,1)))}%`} as any}><span>Sales</span><strong>{salesToday.length}</strong></div></div></section><section className="v2-card recent-sales-card"><div className="v2-card-head"><div><span className="eyebrow">CLOSED</span><h3>Recent Sales</h3></div><DollarSign size={24}/></div>{sales.slice(0,8).map(s=><div className="performance-line" key={s.id}><span>{s.customer_name||s.service_name}</span><strong>{money(Number(s.sale_amount||0))}</strong></div>)}{!sales.length&&<div className="ns-empty compact">No completed sales yet.</div>}</section><section className="v2-card pay-card"><span className="eyebrow">ESTIMATED WEEKLY PAY</span><strong className="big-money">{money(estimatedWeekPay)}</strong><p>{money(weekBase)} base + {money(commission)} commission + {money(weekPerJob)} per-job + {money(weekSalary)} salary</p><small>Final payroll is subject to owner/manager approval and collected-sale rules.</small></section></div></div>}

        {tab==='timeclock'&&<div className="tab-content"><div className="clock-card"><div className={`clock-status ${openEntry?'active':''}`}><Clock3/><span>{openEntry?'CLOCKED IN':'OFF THE CLOCK'}</span></div><h2>{openEntry?`Started ${new Date(openEntry.clock_in).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'Ready to work?'}</h2><p>Location is recorded only for company field operations while you're actively working.</p><button className="btn-primary btn-full" onClick={clock}>{openEntry?'Clock Out':'Clock In'}</button></div><div className="timecard-list">{times.slice(0,12).map(t=><div key={t.id}><strong>{new Date(t.clock_in).toLocaleDateString()}</strong><span>{new Date(t.clock_in).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} → {t.clock_out?new Date(t.clock_out).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Open'}</span><em>{t.status}</em></div>)}</div></div>}

        {tab==='training'&&<div className="tab-content"><TrainingPortal employee={employee}/></div>}
      </div>
    </main>
    <nav className="os-mobile-bottom-nav mobile-app-nav-v25" aria-label="D2D mobile navigation">
      {([['territory','Map',MapPin],['leads','Leads',Target],['presentation','Pitch',Presentation],['calendar','Calendar',CalendarDays]] as const).map(([id,label,Icon])=><button key={id} type="button" className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span>{id==='leads'&&dueFollowups.length>0&&<b>{dueFollowups.length}</b>}</button>)}
      <button type="button" className={sidebar?'active':''} onClick={()=>setSidebar(true)}><MoreHorizontal size={20}/><span>More</span></button>
    </nav>
    {!selectedDoor&&!manual&&tab==='leads'&&<button type="button" className="d2d-add-lead-fab" onClick={manualLead}><Plus size={20}/><span>Add lead</span></button>}

    {(selectedDoor||manual)&&<CanvassInspector door={selectedDoor} form={form} setForm={setForm} history={history} manual={manual} saving={saving} assignedName={employee.name} onClose={()=>{setSelectedDoor(null);setManual(false);setHistory([])}} onKnock={knockDoor} onSave={saveLead} onSaveNext={saveAndNext} onEstimate={createEstimate} onLocation={useCurrentLocation} onPitch={()=>openPitch('lead_drawer')} onQuote={()=>openPitch('lead_drawer_quote','quote')} onAccount={()=>openPitch('lead_drawer_account','account')}/>} 
    {pitchOpen&&<SalesPresentation key={pitchMode} householdSeed={form} leadId={selectedDoor?.lead_id||null} customerName={form.customer_name||undefined} customerPhone={form.phone||undefined} customerEmail={form.email||undefined} customerAddress={form.address||undefined} initialMode={pitchMode} onClose={()=>{setPitchOpen(false);if(form.converted_customer_id)setTab('leads');}} onSelectOffer={useSalesOffer} onApplyAndSave={applyAndSaveOffer} onEvent={logPresentationEvent}/>}
  </div>;
}

function Kpi({label,value,detail}:{label:string;value:string;detail?:string}){return <div className="d2d-kpi"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function Goal({label,value,goal,moneyMode=false}:{label:string;value:number;goal:number;moneyMode?:boolean}){const pct=percent(value,goal);return <div className="goal-row"><div><span>{label}</span><strong>{moneyMode?money(value):value} / {moneyMode?money(goal):goal}</strong></div><div className="goal-track"><i style={{width:`${pct}%`}}/></div></div>}
function loadOffline():OfflineAction[]{try{return JSON.parse(localStorage.getItem(OFFLINE_KEY)||'[]')}catch{return[]}}
function cacheTerritoryDoors(doors:TerritoryDoor[]){try{localStorage.setItem(DOOR_CACHE_KEY,JSON.stringify({savedAt:Date.now(),doors:doors.slice(0,5000)}))}catch{/* storage can be unavailable/private */}}
function loadTerritoryDoors(ids:string[]):TerritoryDoor[]{try{const parsed=JSON.parse(localStorage.getItem(DOOR_CACHE_KEY)||'{}');if(!Array.isArray(parsed?.doors))return[];return parsed.doors.filter((d:TerritoryDoor)=>ids.includes(String(d.territory_id||'')))}catch{return[]}}
function cacheJobs(jobs:Appointment[]){try{localStorage.setItem(JOBS_CACHE_KEY,JSON.stringify({savedAt:Date.now(),jobs:jobs.slice(0,200)}))}catch{/* storage can be unavailable/private */}}
function loadJobsCache():Appointment[]{try{const parsed=JSON.parse(localStorage.getItem(JOBS_CACHE_KEY)||'{}');return Array.isArray(parsed?.jobs)?parsed.jobs:[]}catch{return[]}}
function appointmentDraft(lead:any,employee:Employee,form:ReturnType<typeof emptyForm>,door:(Partial<TerritoryDoor>&{lead_id?:string|null})|null){
  return {
    user_id:lead.converted_customer_id||null,customer_name:form.customer_name||lead.customer_name,customer_email:form.email||lead.email,customer_phone:form.phone||lead.phone,
    service_name:form.service_interest||lead.service_interest||'Detailing Service',package_name:form.service_interest||lead.service_interest||null,add_ons:[],vehicle_info:form.vehicle_info||lead.vehicle_info||'',
    scheduled_at:new Date(form.appointment_at).toISOString(),status:'pending',price:Number(form.estimated_value||lead.estimated_value||0),notes:form.notes||lead.notes||'',
    estimated_duration_minutes:minutesForService(form.service_interest||lead.service_interest,120),travel_buffer_minutes:DEFAULT_TRAVEL_BUFFER_MINUTES,
    service_address:form.address||lead.address,latitude:door?.latitude??lead.latitude,longitude:door?.longitude??lead.longitude,
    sales_rep_employee_id:employee.id,lead_id:lead.id||null,source_channel:'d2d',dispatch_status:'unassigned',field_status:'scheduled',
  };
}
function getPosition():Promise<LiveLocation|null>{return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})})}
