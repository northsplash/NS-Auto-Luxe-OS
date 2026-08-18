import { useEffect, useMemo, useRef, useState } from 'react';
import { doorStatus } from '@/lib/fieldOps';
import type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.4.1/dist/maplibre-gl.css';
const STYLES = {
  liberty: { label: 'Streets', url: 'https://tiles.openfreemap.org/styles/liberty' },
  bright: { label: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  positron: { label: 'Light', url: 'https://tiles.openfreemap.org/styles/positron' },
  '3d': { label: '3D', url: 'https://tiles.openfreemap.org/styles/3d' },
} as const;
type StyleKey = keyof typeof STYLES;

type Props = FieldTerritoryMapProps & { onEngineFailure?: () => void };

type MarkerLike = { remove: () => void };

function ensureMapLibre(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).maplibregl) return resolve((window as any).maplibregl);
    if (!document.querySelector('link[data-ns-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = MAPLIBRE_CSS; link.dataset.nsMaplibre = 'true';
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${MAPLIBRE_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).maplibregl) return resolve((window as any).maplibregl);
      existing.addEventListener('load', () => resolve((window as any).maplibregl), { once: true });
      existing.addEventListener('error', () => reject(new Error('MapLibre failed to load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS; script.async = true; script.dataset.nsMaplibre = 'true';
    script.onload = () => (window as any).maplibregl ? resolve((window as any).maplibregl) : reject(new Error('MapLibre unavailable.'));
    script.onerror = () => reject(new Error('MapLibre failed to load.'));
    document.body.appendChild(script);
  });
}

function escapeText(value: string) {
  return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c] || c));
}

function circlePolygon(lat:number,lng:number,radiusMeters:number,steps=48) {
  const coords:number[][]=[];
  const earth=6378137;
  const latRad=lat*Math.PI/180;
  for(let i=0;i<=steps;i++){
    const angle=i/steps*Math.PI*2;
    const dLat=(radiusMeters*Math.sin(angle)/earth)*180/Math.PI;
    const dLng=(radiusMeters*Math.cos(angle)/(earth*Math.cos(latRad)))*180/Math.PI;
    coords.push([lng+dLng,lat+dLat]);
  }
  return coords;
}

function featureCollection(features:any[]){return {type:'FeatureCollection',features};}

export default function FieldTerritoryMapModern({
  territories, leads = [], doors = [], editable = false, selectedTerritoryId,
  initialPolygon = [], onPolygonChange, onDoorClick, onMapClick, onTerritoryClick,
  liveLocation, routeDoorIds = [], activeDoorId, statusFilter = [], showDoorLabels = false,
  className = '', autoFit = true, mobileGestureLock = true, fieldMode = false, onEngineFailure,
}: Props) {
  const wrap=useRef<HTMLDivElement|null>(null);
  const el=useRef<HTMLDivElement|null>(null);
  const map=useRef<any>(null);
  const maplibre=useRef<any>(null);
  const dataMarkers=useRef<MarkerLike[]>([]);
  const draftMarkers=useRef<MarkerLike[]>([]);
  const locationMarkers=useRef<MarkerLike[]>([]);
  const points=useRef<[number,number][]>([]);
  const editableRef=useRef(editable), onMapClickRef=useRef(onMapClick), onDoorClickRef=useRef(onDoorClick), onTerritoryClickRef=useRef(onTerritoryClick), onPolygonChangeRef=useRef(onPolygonChange);
  const [styleKey,setStyleKey]=useState<StyleKey>(()=>{try{const saved=localStorage.getItem('ns_map_style') as StyleKey|null;return saved&&saved in STYLES?saved:'liberty'}catch{return 'liberty'}});
  const [ready,setReady]=useState(false);
  const [fullscreen,setFullscreen]=useState(false);
  const [interactionEnabled,setInteractionEnabled]=useState(false);
  const [locating,setLocating]=useState(false);
  const [localLocation,setLocalLocation]=useState<{latitude:number;longitude:number;accuracy?:number|null}|null>(null);
  const [engineError,setEngineError]=useState('');
  const lastFitKey=useRef('');

  useEffect(()=>{editableRef.current=editable},[editable]);
  useEffect(()=>{onMapClickRef.current=onMapClick},[onMapClick]);
  useEffect(()=>{onDoorClickRef.current=onDoorClick},[onDoorClick]);
  useEffect(()=>{onTerritoryClickRef.current=onTerritoryClick},[onTerritoryClick]);
  useEffect(()=>{onPolygonChangeRef.current=onPolygonChange},[onPolygonChange]);
  useEffect(()=>{points.current=initialPolygon.map(p=>[Number(p[0]),Number(p[1])]); renderDraft();},[JSON.stringify(initialPolygon),ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleDoors=useMemo(()=>statusFilter.length?doors.filter(d=>statusFilter.includes(d.status||'unworked')):doors,[doors,statusFilter]);

  useEffect(()=>{
    let cancelled=false;
    setEngineError('');
    setReady(false);
    (async()=>{
      const m=await ensureMapLibre();
      if(cancelled||!el.current)return;
      maplibre.current=m;
      if(map.current){try{map.current.remove()}catch{} map.current=null;}
      const instance=new m.Map({
        container:el.current,
        style:STYLES[styleKey].url,
        center:[-78.6382,35.7796],zoom:13,minZoom:3,maxZoom:20,
        attributionControl:true,pitchWithRotate:false,dragRotate:false,
      });
      map.current=instance;
      instance.addControl(new m.NavigationControl({showCompass:false,visualizePitch:false}),'bottom-right');
      const startupTimer=window.setTimeout(()=>{if(!cancelled&&!instance.loaded?.()){setEngineError('Modern map service timed out. Switching to compatibility mode.');onEngineFailure?.()}},12000);
      instance.on('load',()=>{if(cancelled)return;window.clearTimeout(startupTimer);sessionStorage.removeItem('ns_map_engine');setReady(true);setTimeout(()=>instance.resize(),60)});
      instance.on('error',(e:any)=>{if(!instance.loaded?.() && e?.error){console.warn('MapLibre map error',e.error)}});
      instance.on('click',(event:any)=>{
        if(editableRef.current){
          points.current=[...points.current,[event.lngLat.lat,event.lngLat.lng]];
          renderDraft(); onPolygonChangeRef.current?.([...points.current]);
        }else onMapClickRef.current?.(event.lngLat.lat,event.lngLat.lng);
      });
    })().catch(err=>{
      console.error(err);setEngineError('Modern map engine could not start. Switching to compatibility mode.');
      window.setTimeout(()=>onEngineFailure?.(),350);
    });
    return()=>{cancelled=true;clearMarkers(dataMarkers.current);clearMarkers(draftMarkers.current);clearMarkers(locationMarkers.current);if(map.current){try{map.current.remove()}catch{}map.current=null;}};
  },[styleKey]);

  const setBaseStyle=(next:StyleKey)=>{try{localStorage.setItem('ns_map_style',next)}catch{}setStyleKey(next)};

  function upsertSource(id:string,data:any){
    const instance=map.current;if(!instance||!instance.isStyleLoaded?.())return;
    const source=instance.getSource(id);if(source?.setData)source.setData(data);else instance.addSource(id,{type:'geojson',data});
  }
  function ensureLayer(layer:any,beforeId?:string){const instance=map.current;if(!instance||instance.getLayer(layer.id))return;try{instance.addLayer(layer,beforeId)}catch{instance.addLayer(layer)}}

  function renderDraft(){
    const instance=map.current,m=maplibre.current;if(!instance||!m||!ready)return;
    clearMarkers(draftMarkers.current);
    const current=points.current;
    const coords=current.map(p=>[p[1],p[0]]);
    const geometry=current.length>=3?{type:'Polygon',coordinates:[[...coords,coords[0]]]}:current.length>=2?{type:'LineString',coordinates:coords}:null;
    upsertSource('ns-draft',featureCollection(geometry?[{type:'Feature',properties:{},geometry}]:[]));
    ensureLayer({id:'ns-draft-fill',type:'fill',source:'ns-draft',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#9d7651','fill-opacity':.14}});
    ensureLayer({id:'ns-draft-line',type:'line',source:'ns-draft',paint:{'line-color':'#9d7651','line-width':3,'line-dasharray':[2,1.5]}});
    current.forEach((point,index)=>{
      const node=document.createElement('button');node.type='button';node.className='ns-territory-vertex ns-maplibre-vertex';node.textContent=String(index+1);node.title='Drag to resize · right-click to remove';
      node.addEventListener('contextmenu',event=>{event.preventDefault();points.current=points.current.filter((_p,i)=>i!==index);onPolygonChangeRef.current?.([...points.current]);renderDraft()});
      const marker=new m.Marker({element:node,draggable:true,anchor:'center'}).setLngLat([point[1],point[0]]).addTo(instance);
      marker.on('drag',()=>{const ll=marker.getLngLat();points.current[index]=[ll.lat,ll.lng];renderDraftShapeOnly()});
      marker.on('dragend',()=>{const ll=marker.getLngLat();points.current[index]=[ll.lat,ll.lng];onPolygonChangeRef.current?.([...points.current]);renderDraft()});
      draftMarkers.current.push(marker);
    });
  }
  function renderDraftShapeOnly(){
    const current=points.current,coords=current.map(p=>[p[1],p[0]]);
    const geometry=current.length>=3?{type:'Polygon',coordinates:[[...coords,coords[0]]]}:current.length>=2?{type:'LineString',coordinates:coords}:null;
    upsertSource('ns-draft',featureCollection(geometry?[{type:'Feature',properties:{},geometry}]:[]));
  }

  useEffect(()=>{
    const instance=map.current,m=maplibre.current;if(!ready||!instance||!m)return;
    clearMarkers(dataMarkers.current);
    const bounds=new m.LngLatBounds();let hasBounds=false;
    const territoryFeatures:any[]=[];
    territories.forEach(territory=>{
      const raw=(territory.polygon_geojson as any)?.coordinates?.[0];
      let coords:number[][]=[];
      if(raw?.length)coords=raw.map((p:number[])=>[Number(p[0]),Number(p[1])]);
      else if(territory.center_lat!=null&&territory.center_lng!=null)coords=circlePolygon(Number(territory.center_lat),Number(territory.center_lng),Number(territory.radius_meters||1000));
      if(coords.length){coords.forEach(p=>{bounds.extend(p);hasBounds=true});territoryFeatures.push({type:'Feature',properties:{id:territory.id,name:territory.name,color:territory.color||'#9d7651',selected:territory.id===selectedTerritoryId?1:0},geometry:{type:'Polygon',coordinates:[coords[0][0]===coords[coords.length-1]?.[0]&&coords[0][1]===coords[coords.length-1]?.[1]?coords:[...coords,coords[0]] ]}})}
    });
    upsertSource('ns-territories',featureCollection(territoryFeatures));
    ensureLayer({id:'ns-territories-fill',type:'fill',source:'ns-territories',paint:{'fill-color':['get','color'],'fill-opacity':['case',['==',['get','selected'],1],.15,.065]}});
    ensureLayer({id:'ns-territories-line',type:'line',source:'ns-territories',paint:{'line-color':['case',['==',['get','selected'],1],'#6e4d32',['get','color']],'line-width':['case',['==',['get','selected'],1],4,2]}});
    try{instance.off('click','ns-territories-fill',territoryLayerClick)}catch{}
    try{instance.on('click','ns-territories-fill',territoryLayerClick)}catch{}

    const routeIndex=new Map(routeDoorIds.map((id,index)=>[id,index+1]));
    const routeCoordinates:number[][]=[];
    if(liveLocation)routeCoordinates.push([liveLocation.longitude,liveLocation.latitude]);
    routeDoorIds.forEach(id=>{const d=visibleDoors.find(x=>x.id===id);if(d)routeCoordinates.push([Number(d.longitude),Number(d.latitude)])});
    upsertSource('ns-route',featureCollection(routeCoordinates.length>1?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:routeCoordinates}}]:[]));
    ensureLayer({id:'ns-route-shadow',type:'line',source:'ns-route',paint:{'line-color':'rgba(255,255,255,.92)','line-width':8,'line-opacity':.88}});
    ensureLayer({id:'ns-route-line',type:'line',source:'ns-route',paint:{'line-color':'#6e4d32','line-width':4,'line-opacity':.9,'line-dasharray':[2,1.2]}});

    visibleDoors.forEach(door=>{
      const lat=Number(door.latitude),lng=Number(door.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const status=door.do_not_knock?doorStatus('do_not_knock'):doorStatus(door.status||'unworked');
      const selected=Boolean(activeDoorId&&door.id===activeDoorId);const order=door.id?routeIndex.get(door.id):undefined;
      const node=createDoorNode(door,status.color,status.label,selected,order,fieldMode,showDoorLabels);
      node.addEventListener('click',event=>{event.stopPropagation();onDoorClickRef.current?.(door)});
      const marker=new m.Marker({element:node,anchor:'bottom'}).setLngLat([lng,lat]).addTo(instance);dataMarkers.current.push(marker);bounds.extend([lng,lat]);hasBounds=true;
    });
    leads.forEach(lead=>{
      if(lead.latitude==null||lead.longitude==null)return;if(lead.territory_door_id&&visibleDoors.some(d=>d.id===lead.territory_door_id))return;
      const lat=Number(lead.latitude),lng=Number(lead.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const status=doorStatus(lead.status);const door:FieldDoor={latitude:lat,longitude:lng,address:lead.address,status:lead.status,territory_id:lead.territory_id,lead_id:lead.id};
      const node=createDoorNode(door,status.color,status.label,false,undefined,true,showDoorLabels,true,lead.customer_name||undefined);
      node.addEventListener('click',event=>{event.stopPropagation();onDoorClickRef.current?.(door)});
      const marker=new m.Marker({element:node,anchor:'bottom'}).setLngLat([lng,lat]).addTo(instance);dataMarkers.current.push(marker);bounds.extend([lng,lat]);hasBounds=true;
    });

    const fitKey=JSON.stringify({territories:territories.map(t=>[t.id,t.updated_at]),doors:visibleDoors.map(d=>d.id),route:routeDoorIds});
    if(autoFit&&!editable&&hasBounds&&visibleDoors.length<1200&&lastFitKey.current!==fitKey){lastFitKey.current=fitKey;try{instance.fitBounds(bounds,{padding:fieldMode?48:32,maxZoom:18,duration:0})}catch{}}
    if(editable)renderDraft();
    return()=>{try{instance.off('click','ns-territories-fill',territoryLayerClick)}catch{}};
  },[ready,territories,leads,visibleDoors,selectedTerritoryId,routeDoorIds,activeDoorId,showDoorLabels,autoFit,editable,fieldMode,liveLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  function territoryLayerClick(event:any){
    const id=event?.features?.[0]?.properties?.id;const territory=territories.find(t=>String(t.id)===String(id));if(territory)onTerritoryClickRef.current?.(territory);
  }

  useEffect(()=>{
    const instance=map.current,m=maplibre.current;if(!ready||!instance||!m)return;clearMarkers(locationMarkers.current);
    const location=liveLocation||localLocation;if(!location)return;
    const accuracy=document.createElement('div');accuracy.className='ns-user-location-accuracy';const radius=Math.max(42,Math.min(180,Math.sqrt(Math.max(0,Number(location.accuracy||0)))*12));accuracy.style.width=`${radius}px`;accuracy.style.height=`${radius}px`;
    const dot=document.createElement('div');dot.className='ns-user-location-dot';dot.innerHTML='<span></span>';
    const am=new m.Marker({element:accuracy,anchor:'center'}).setLngLat([location.longitude,location.latitude]).addTo(instance);
    const dm=new m.Marker({element:dot,anchor:'center'}).setLngLat([location.longitude,location.latitude]).addTo(instance);locationMarkers.current.push(am,dm);
  },[ready,liveLocation,localLocation]);

  useEffect(()=>{const onChange=()=>{const active=document.fullscreenElement===wrap.current;setFullscreen(active);setTimeout(()=>map.current?.resize?.(),80);setTimeout(()=>map.current?.resize?.(),240)};document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[]);
  useEffect(()=>{const resize=()=>setTimeout(()=>map.current?.resize?.(),80);window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('orientationchange',resize)}},[]);
  useEffect(()=>{const onCenter=(event:Event)=>{const d=(event as CustomEvent<{latitude:number;longitude:number;zoom?:number}>).detail;if(!d||!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude))return;const next={latitude:Number(d.latitude),longitude:Number(d.longitude),accuracy:null};setLocalLocation(next);map.current?.flyTo?.({center:[next.longitude,next.latitude],zoom:d.zoom||19,duration:800});setInteractionEnabled(true)};window.addEventListener('northsplash:center-map',onCenter as EventListener);return()=>window.removeEventListener('northsplash:center-map',onCenter as EventListener)},[]);
  useEffect(()=>{const instance=map.current;if(!instance||!mobileGestureLock||editable)return;const coarse=window.matchMedia?.('(pointer: coarse)').matches;if(!coarse)return;const enabled=interactionEnabled||fullscreen;['dragPan','touchZoomRotate','doubleClickZoom','scrollZoom','boxZoom','keyboard'].forEach(name=>{const c=instance[name];if(c)enabled?c.enable?.():c.disable?.()})},[interactionEnabled,mobileGestureLock,editable,ready,fullscreen]);

  const centerOnMe=()=>{
    if(!map.current)return;const known=liveLocation||localLocation;if(known)map.current.flyTo({center:[known.longitude,known.latitude],zoom:Math.max(18,map.current.getZoom?.()||18),duration:650});
    if(!navigator.geolocation){alert('Location is not available in this browser.');return}setLocating(true);
    navigator.geolocation.getCurrentPosition(position=>{const next={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};setLocalLocation(next);map.current?.flyTo?.({center:[next.longitude,next.latitude],zoom:19,duration:800});setInteractionEnabled(true);setLocating(false)},error=>{setLocating(false);const message=error.code===1?'Location permission is blocked. Allow location access for this site and try again.':error.code===3?'Location timed out. Move near a window or turn on precise location, then try again.':'Your current location could not be determined.';alert(message)},{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
  };
  const reset=()=>{points.current=[];onPolygonChange?.([]);renderDraft()};
  const undo=()=>{points.current=points.current.slice(0,-1);onPolygonChange?.([...points.current]);renderDraft()};
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement===wrap.current)await document.exitFullscreen();else if(wrap.current?.requestFullscreen)await wrap.current.requestFullscreen();else setFullscreen(v=>!v)}catch{setFullscreen(v=>!v)}setTimeout(()=>map.current?.resize?.(),120)};

  return <div ref={wrap} className={`field-map-wrap field-map-modern ${fullscreen?'field-map-fullscreen':''} ${fieldMode?'field-map-field-mode':''} ${className}`}>
    <div className="field-map-toolbar">
      <button type="button" className="map-tool-btn" onClick={toggleFullscreen}>{fullscreen?'Exit Full Screen':'Full Screen'}</button>
      <button type="button" className="map-tool-btn map-location-btn" onClick={centerOnMe} disabled={locating}>{locating?'Locating…':'Use Current Location'}</button>
      <div className="map-style-switcher" aria-label="Map style">{(Object.keys(STYLES) as StyleKey[]).map(key=><button type="button" key={key} className={styleKey===key?'active':''} onClick={()=>setBaseStyle(key)}>{STYLES[key].label}</button>)}</div>
      {editable&&<><button type="button" className="map-tool-btn" disabled={!points.current.length} onClick={undo}>Undo Point</button><button type="button" className="map-tool-btn" onClick={reset}>Clear</button></>}
    </div>
    {engineError&&<div className="map-engine-notice">{engineError}</div>}
    <div ref={el} className="field-map-canvas" />
    <div className="map-engine-badge"><span>FREE MAP</span> MapLibre + OpenFreeMap</div>
    {mobileGestureLock&&!editable&&!fullscreen&&<div className={`map-interaction-toggle ${interactionEnabled?'active':''}`}><button type="button" onClick={()=>setInteractionEnabled(v=>!v)}>{interactionEnabled?'Done · Scroll Page':'Tap to Use Map'}</button></div>}
    {editable&&<div className="field-map-tools"><span>Click the map to add boundary points. Drag numbered points to resize. Right-click a point to remove it.</span><strong>{points.current.length} points</strong></div>}
  </div>;
}

function clearMarkers(items:MarkerLike[]){items.splice(0).forEach(item=>{try{item.remove()}catch{}})}
function createDoorNode(door:FieldDoor,color:string,label:string,selected:boolean,routeIndex?:number,fieldMode=false,showLabel=false,leadOnly=false,leadName?:string){
  const node=document.createElement('button');node.type='button';node.className=`ns-maplibre-door ${fieldMode?'field-mode':''} ${selected?'selected':''} ${leadOnly?'lead-only':''}`;node.style.setProperty('--door-color',color);
  const address=door.address||leadName||'Mapped house';node.setAttribute('aria-label',`${address} · ${label}`);node.title=`${address} · ${label}`;
  node.innerHTML=`<span class="ns-door-marker ${selected?'selected':''}" style="--door-color:${color}"><span class="ns-door-pin-halo"></span><span class="ns-door-house-icon"><span class="ns-door-roof"></span><span class="ns-door-body">${routeIndex?`<b>${routeIndex}</b>`:'<i></i>'}</span></span><span class="ns-door-hover-card"><strong>${escapeText(address)}</strong><small>${escapeText(label)}</small><em>Tap house to mark</em></span></span>${showLabel&&door.address?`<span class="ns-map-address-label">${escapeText(door.address)}</span>`:''}`;
  return node;
}
