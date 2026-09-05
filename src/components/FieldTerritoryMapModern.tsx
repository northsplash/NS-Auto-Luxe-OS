import { useEffect, useMemo, useRef, useState } from 'react';
import { doorStatus } from '@/lib/fieldOps';
import { GOOGLE_MAPS_MAP_ID, googleMapsErrorMessage, loadGoogleMaps } from '@/lib/googleMaps';
import type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

type MarkerLike = { setMap?: (map: any) => void };

type Props = FieldTerritoryMapProps;

const ROADMAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f4f1e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4b4438' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8e1d2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#eee7d8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dfd0ae' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c7d9df' }] },
];

function clearMarkers(items: MarkerLike[]) {
  items.splice(0).forEach(item => { try { item.setMap?.(null); } catch {} });
}

function markerSvg(color: string, selected = false, routeIndex?: number, leadOnly = false) {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : '#9d7651';
  const stroke = selected ? '#111111' : '#ffffff';
  const number = routeIndex ? `<text x="28" y="35" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700" fill="#fff">${routeIndex}</text>` : '';
  const inner = leadOnly
    ? `<circle cx="28" cy="28" r="11" fill="#fff" opacity=".96"/><circle cx="28" cy="28" r="5" fill="${safe}"/>`
    : `<path d="M17 30V20l11-9 11 9v10h-7v-7h-8v7z" fill="#fff"/>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="66" viewBox="0 0 56 66"><path d="M28 2C14.7 2 4 12.5 4 25.5 4 43 28 64 28 64s24-21 24-38.5C52 12.5 41.3 2 28 2z" fill="${safe}" stroke="${stroke}" stroke-width="${selected ? 4 : 2}"/>${inner}${number}</svg>`)}`;
}

export default function FieldTerritoryMapModern({
  territories, leads = [], doors = [], editable = false, selectedTerritoryId,
  initialPolygon = [], onPolygonChange, onDoorClick, onMapClick, onTerritoryClick,
  liveLocation, routeDoorIds = [], activeDoorId, statusFilter = [], showDoorLabels = false,
  className = '', autoFit = true, mobileGestureLock = true, fieldMode = false,
}: Props) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const el = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const map = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const dataMarkers = useRef<MarkerLike[]>([]);
  const draftMarkers = useRef<MarkerLike[]>([]);
  const locationOverlays = useRef<any[]>([]);
  const points = useRef<[number, number][]>([]);
  const [ready, setReady] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [interactionEnabled, setInteractionEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapType, setMapType] = useState<'roadmap'|'satellite'|'hybrid'>('roadmap');
  const [localLocation, setLocalLocation] = useState<{latitude:number;longitude:number;accuracy?:number|null}|null>(null);
  const lastFitKey = useRef('');

  const visibleDoors = useMemo(() => statusFilter.length ? doors.filter(d => statusFilter.includes(d.status || 'unworked')) : doors, [doors, statusFilter]);

  useEffect(() => {
    points.current = initialPolygon.map(p => [Number(p[0]), Number(p[1])]);
    if (ready) renderDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialPolygon), ready]);

  useEffect(() => {
    let cancelled = false;
    setReady(false); setEngineError('');
    loadGoogleMaps().then(google => {
      if (cancelled || !el.current) return;
      googleRef.current = google;
      const instance = new google.maps.Map(el.current, {
        center: { lat: 35.7796, lng: -78.6382 },
        zoom: 13,
        minZoom: 3,
        maxZoom: 21,
        mapTypeId: 'roadmap',
        ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : { styles: ROADMAP_STYLES }),
        streetViewControl: true,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: true,
        gestureHandling: mobileGestureLock && !editable ? 'cooperative' : 'greedy',
      });
      map.current = instance;
      instance.addListener('click', (event:any) => {
        const lat = event.latLng?.lat?.(); const lng = event.latLng?.lng?.();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (editable) {
          points.current = [...points.current, [lat, lng]];
          onPolygonChange?.([...points.current]);
          renderDraft();
        } else onMapClick?.(lat, lng);
      });
      setReady(true);
    }).catch(err => setEngineError(googleMapsErrorMessage(err)));
    return () => {
      cancelled = true;
      clearAll();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current || !googleRef.current) return;
    const google = googleRef.current;
    const instance = map.current;
    if (!searchInput.current || !google.maps.places?.Autocomplete) return;
    const autocomplete = new google.maps.places.Autocomplete(searchInput.current, {
      fields: ['geometry', 'formatted_address', 'name'],
      componentRestrictions: { country: 'us' },
    });
    autocomplete.bindTo('bounds', instance);
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place?.geometry?.location;
      if (!location) return;
      if (place.geometry.viewport) instance.fitBounds(place.geometry.viewport);
      else { instance.setCenter(location); instance.setZoom(18); }
      setInteractionEnabled(true);
    });
    return () => listener?.remove?.();
  }, [ready]);

  useEffect(() => {
    if (!ready || !map.current || !googleRef.current) return;
    clearData();
    const google = googleRef.current, instance = map.current;
    const bounds = new google.maps.LatLngBounds(); let hasBounds = false;

    territories.forEach(territory => {
      const poly = (territory.polygon_geojson as any)?.coordinates?.[0];
      let overlay:any = null;
      if (poly?.length) {
        const path = poly.map((p:number[]) => ({lat:Number(p[1]), lng:Number(p[0])})).filter((p:any)=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
        overlay = new google.maps.Polygon({
          map: instance, paths: path,
          strokeColor: territory.id === selectedTerritoryId ? '#6e4d32' : (territory.color || '#9d7651'),
          strokeWeight: territory.id === selectedTerritoryId ? 4 : 2,
          strokeOpacity: .95, fillColor: territory.color || '#9d7651',
          fillOpacity: territory.id === selectedTerritoryId ? .14 : .07,
          clickable: true,
        });
        path.forEach((p:any)=>{bounds.extend(p);hasBounds=true});
      } else if (territory.center_lat != null && territory.center_lng != null) {
        const center = {lat:Number(territory.center_lat),lng:Number(territory.center_lng)};
        overlay = new google.maps.Circle({map:instance,center,radius:Number(territory.radius_meters||1000),strokeColor:territory.color||'#9d7651',strokeWeight:2,fillColor:territory.color||'#9d7651',fillOpacity:.06});
        bounds.extend(center); hasBounds = true;
      }
      if (overlay) {
        overlay.addListener('click', (e:any) => { e?.stop?.(); onTerritoryClick?.(territory); });
        overlays.current.push(overlay);
      }
    });

    const routeMap = new Map(routeDoorIds.map((id,index)=>[id,index+1]));
    const routePath = routeDoorIds.map(id=>visibleDoors.find(d=>d.id===id)).filter(Boolean).map((d:any)=>({lat:Number(d.latitude),lng:Number(d.longitude)}));
    if (routePath.length > 1) {
      overlays.current.push(new google.maps.Polyline({map:instance,path:routePath,strokeColor:'#6e4d32',strokeWeight:4,strokeOpacity:.82,icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:1,scale:3},offset:'0',repeat:'18px'}]}));
    }

    visibleDoors.forEach(door => {
      const lat=Number(door.latitude),lng=Number(door.longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      const status=doorStatus(door.status); const selected=door.id===activeDoorId; const routeIndex=door.id?routeMap.get(door.id):undefined;
      const marker = new google.maps.Marker({
        map:instance, position:{lat,lng}, title:`${door.address||'Mapped house'} · ${status.label}`,
        icon:{url:markerSvg(status.color,selected,routeIndex,false),scaledSize:new google.maps.Size(selected?46:38,selected?54:45),anchor:new google.maps.Point(selected?23:19,selected?54:45)},
        label: showDoorLabels && door.address ? {text:String(door.address),color:'#17120d',fontSize:'10px',fontWeight:'700',className:'ns-google-address-label'} : undefined,
        zIndex:selected?120:routeIndex?100:40,
      });
      marker.addListener('click',()=>onDoorClick?.(door)); dataMarkers.current.push(marker); bounds.extend({lat,lng}); hasBounds=true;
    });

    leads.forEach(lead => {
      if(lead.latitude==null||lead.longitude==null)return;
      if(lead.territory_door_id&&visibleDoors.some(d=>d.id===lead.territory_door_id))return;
      const lat=Number(lead.latitude),lng=Number(lead.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const status=doorStatus(lead.status); const door:FieldDoor={latitude:lat,longitude:lng,address:lead.address,status:lead.status,territory_id:lead.territory_id,lead_id:lead.id};
      const marker=new google.maps.Marker({map:instance,position:{lat,lng},title:`${lead.customer_name||lead.address||'Lead'} · ${status.label}`,icon:{url:markerSvg(status.color,false,undefined,true),scaledSize:new google.maps.Size(34,40),anchor:new google.maps.Point(17,40)},zIndex:55});
      marker.addListener('click',()=>onDoorClick?.(door));dataMarkers.current.push(marker);bounds.extend({lat,lng});hasBounds=true;
    });

    const fitKey=JSON.stringify({territories:territories.map(t=>[t.id,t.updated_at]),doors:visibleDoors.map(d=>d.id),route:routeDoorIds});
    if(autoFit&&!editable&&hasBounds&&visibleDoors.length<1200&&lastFitKey.current!==fitKey){lastFitKey.current=fitKey;instance.fitBounds(bounds,fieldMode?52:38);const once=google.maps.event.addListenerOnce(instance,'idle',()=>{if(instance.getZoom()>18)instance.setZoom(18);once?.remove?.()})}
    if(editable)renderDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,territories,leads,visibleDoors,selectedTerritoryId,routeDoorIds,activeDoorId,showDoorLabels,autoFit,editable,fieldMode]);

  useEffect(()=>{
    if(!ready||!map.current||!googleRef.current)return; clearLocation();
    const location=liveLocation||localLocation;if(!location)return; const google=googleRef.current,instance=map.current;
    const center={lat:Number(location.latitude),lng:Number(location.longitude)};
    locationOverlays.current.push(new google.maps.Circle({map:instance,center,radius:Math.max(8,Number(location.accuracy||20)),strokeColor:'#2b77ff',strokeOpacity:.32,strokeWeight:1,fillColor:'#2b77ff',fillOpacity:.12}));
    locationOverlays.current.push(new google.maps.Marker({map:instance,position:center,title:'Current location',icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:'#2b77ff',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3},zIndex:200}));
  },[ready,liveLocation,localLocation]);

  useEffect(()=>{if(!map.current)return;map.current.setMapTypeId(mapType);if(mapType==='roadmap')map.current.setOptions({styles:ROADMAP_STYLES});else map.current.setOptions({styles:null})},[mapType,ready]);
  useEffect(()=>{if(!map.current||editable)return;map.current.setOptions({gestureHandling:mobileGestureLock&&!interactionEnabled&&!fullscreen?'cooperative':'greedy'})},[interactionEnabled,mobileGestureLock,editable,ready,fullscreen]);
  useEffect(()=>{const onChange=()=>{const active=document.fullscreenElement===wrap.current;setFullscreen(active);window.setTimeout(()=>googleRef.current?.maps?.event?.trigger(map.current,'resize'),100)};document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[]);
  useEffect(()=>{const onCenter=(event:Event)=>{const d=(event as CustomEvent<{latitude:number;longitude:number;zoom?:number}>).detail;if(!d||!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude))return;setLocalLocation({latitude:Number(d.latitude),longitude:Number(d.longitude),accuracy:null});map.current?.panTo?.({lat:Number(d.latitude),lng:Number(d.longitude)});map.current?.setZoom?.(d.zoom||19);setInteractionEnabled(true)};window.addEventListener('northsplash:center-map',onCenter as EventListener);return()=>window.removeEventListener('northsplash:center-map',onCenter as EventListener)},[]);

  function clearData(){clearMarkers(dataMarkers.current);overlays.current.splice(0).forEach(o=>{try{o.setMap?.(null)}catch{}})}
  function clearLocation(){locationOverlays.current.splice(0).forEach(o=>{try{o.setMap?.(null)}catch{}})}
  function clearAll(){clearData();clearMarkers(draftMarkers.current);clearLocation()}

  function renderDraft(){
    if(!ready||!map.current||!googleRef.current)return;const google=googleRef.current,instance=map.current;
    clearMarkers(draftMarkers.current); overlays.current.filter((x:any)=>x.__draft).forEach((x:any)=>x.setMap?.(null)); overlays.current=overlays.current.filter((x:any)=>!x.__draft);
    const path=points.current.map(([lat,lng])=>({lat,lng}));
    if(path.length>1){const shape=path.length>=3?new google.maps.Polygon({map:instance,paths:path,strokeColor:'#9d7651',strokeWeight:3,strokeOpacity:.95,fillColor:'#9d7651',fillOpacity:.14}):new google.maps.Polyline({map:instance,path:path,strokeColor:'#9d7651',strokeWeight:3,strokeOpacity:.95});shape.__draft=true;overlays.current.push(shape)}
    points.current.forEach((point,index)=>{
      const marker=new google.maps.Marker({map:instance,position:{lat:point[0],lng:point[1]},draggable:true,label:{text:String(index+1),color:'#17120d',fontWeight:'900'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:14,fillColor:'#e8d9bf',fillOpacity:1,strokeColor:'#9d7651',strokeWeight:3},zIndex:300});
      marker.addListener('drag',()=>{const p=marker.getPosition();points.current[index]=[p.lat(),p.lng()];renderDraftShapeOnly()});
      marker.addListener('dragend',()=>{const p=marker.getPosition();points.current[index]=[p.lat(),p.lng()];onPolygonChange?.([...points.current]);renderDraft()});
      marker.addListener('rightclick',()=>{points.current=points.current.filter((_p,i)=>i!==index);onPolygonChange?.([...points.current]);renderDraft()});
      draftMarkers.current.push(marker);
    });
  }
  function renderDraftShapeOnly(){
    if(!ready||!map.current||!googleRef.current)return;const google=googleRef.current,instance=map.current;
    overlays.current.filter((x:any)=>x.__draft).forEach((x:any)=>x.setMap?.(null));overlays.current=overlays.current.filter((x:any)=>!x.__draft);const path=points.current.map(([lat,lng])=>({lat,lng}));
    if(path.length>1){const shape=path.length>=3?new google.maps.Polygon({map:instance,paths:path,strokeColor:'#9d7651',strokeWeight:3,fillColor:'#9d7651',fillOpacity:.14}):new google.maps.Polyline({map:instance,path:path,strokeColor:'#9d7651',strokeWeight:3});shape.__draft=true;overlays.current.push(shape)}
  }

  const centerOnMe=()=>{if(!navigator.geolocation){alert('Location is not available in this browser.');return}setLocating(true);navigator.geolocation.getCurrentPosition(position=>{const next={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};setLocalLocation(next);map.current?.panTo?.({lat:next.latitude,lng:next.longitude});map.current?.setZoom?.(19);setInteractionEnabled(true);setLocating(false)},error=>{setLocating(false);alert(error.code===1?'Location permission is blocked. Allow location access for this site and try again.':'Your current location could not be determined.')},{enableHighAccuracy:true,timeout:15000,maximumAge:5000})};
  const reset=()=>{points.current=[];onPolygonChange?.([]);renderDraft()};
  const undo=()=>{points.current=points.current.slice(0,-1);onPolygonChange?.([...points.current]);renderDraft()};
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement===wrap.current)await document.exitFullscreen();else await wrap.current?.requestFullscreen?.()}catch{}window.setTimeout(()=>googleRef.current?.maps?.event?.trigger(map.current,'resize'),120)};

  return <div ref={wrap} className={`field-map-wrap field-map-modern field-map-google ${fullscreen?'field-map-fullscreen':''} ${fieldMode?'field-map-field-mode':''} ${className}`}>
    <div className="field-map-toolbar google-map-toolbar">
      <div className="google-map-search"><span>⌕</span><input ref={searchInput} type="search" placeholder="Search address, neighborhood or place" aria-label="Search Google Maps" /></div>
      <button type="button" className="map-tool-btn" onClick={toggleFullscreen}>{fullscreen?'Exit Full Screen':'Full Screen'}</button>
      <button type="button" className="map-tool-btn map-location-btn" onClick={centerOnMe} disabled={locating}>{locating?'Locating…':'Use Current Location'}</button>
      <div className="map-style-switcher" aria-label="Google map style"><button type="button" className={mapType==='roadmap'?'active':''} onClick={()=>setMapType('roadmap')}>Map</button><button type="button" className={mapType==='satellite'?'active':''} onClick={()=>setMapType('satellite')}>Satellite</button><button type="button" className={mapType==='hybrid'?'active':''} onClick={()=>setMapType('hybrid')}>Hybrid</button></div>
      {editable&&<><button type="button" className="map-tool-btn" disabled={!points.current.length} onClick={undo}>Undo Point</button><button type="button" className="map-tool-btn" onClick={reset}>Clear</button></>}
    </div>
    {engineError&&<div className="map-engine-notice google-map-error"><strong>Google Maps setup needed</strong><span>{engineError}</span></div>}
    <div ref={el} className="field-map-canvas" />
    <div className="map-engine-badge google-map-badge"><span>GOOGLE MAPS</span> Territory + Leads</div>
    {mobileGestureLock&&!editable&&!fullscreen&&<div className={`map-interaction-toggle ${interactionEnabled?'active':''}`}><button type="button" onClick={()=>setInteractionEnabled(v=>!v)}>{interactionEnabled?'Done · Scroll Page':'Tap to Use Map'}</button></div>}
    {editable&&<div className="field-map-tools"><span>Click Google Maps to add boundary points. Drag numbered points to resize. Right-click a point to remove it.</span><strong>{points.current.length} points</strong></div>}
  </div>;
}
