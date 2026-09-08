import { useEffect, useMemo, useRef, useState } from 'react';
import { doorStatus, doorStreetLabel } from '@/lib/fieldOps';
import {
  applyCanvasFullscreen, clusterCanvassDoors, doorIsDimmed, doorMatchesSearch, doorsInBounds,
  formatRelativeActivity, houseMarkerDataUrl, type MapBounds,
} from '@/lib/canvass';
import { GOOGLE_MAPS_MAP_ID, googleMapsErrorMessage, loadGoogleMaps, shouldUseGoogleMaps, watchGoogleMapError } from '@/lib/googleMaps';
import { MARKET } from '@/lib/market';
import type { FieldDoor, FieldTerritoryMapProps } from './FieldTerritoryMap.types';

type MarkerLike = { setMap?: (map: any) => void };

type Props = FieldTerritoryMapProps & { onUnavailable?: () => void };

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

function clusterIconUrl(count: number, color: string) {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : '#9d7651';
  const label = count > 99 ? '99+' : String(count);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="${safe}" stroke="#fffdf8" stroke-width="2.2"/><text x="17" y="21" text-anchor="middle" font-family="Georgia,serif" font-size="${label.length>2?11:13}" font-weight="700" fill="#fffdf8">${label}</text></svg>`)}`;
}

function canHoverPreview() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}

export default function FieldTerritoryMapModern({
  territories, leads = [], doors = [], editable = false, selectedTerritoryId,
  initialPolygon = [], onPolygonChange, onDoorClick, onMapClick, onTerritoryClick,
  liveLocation, routeDoorIds = [], activeDoorId, statusFilter = [], showDoorLabels = false,
  className = '', autoFit = true, mobileGestureLock = true, fieldMode = false,
  filterMode = 'dim', searchQuery = '', onViewportChange, onUnavailable,
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
  const [viewBounds, setViewBounds] = useState<MapBounds | null>(null);
  const hoverWindow = useRef<any>(null);
  const lastFitKey = useRef('');
  const canvasFs = useRef(false);

  const matchedDoors = useMemo(() => {
    const q = searchQuery.trim();
    return doors.filter((d) => doorMatchesSearch(d, q, d.customer_name));
  }, [doors, searchQuery]);

  const visibleDoors = useMemo(() => {
    if (filterMode === 'hide' && statusFilter.length) {
      return matchedDoors.filter((d) => statusFilter.includes(d.do_not_knock ? 'do_not_knock' : (d.status || 'unworked')));
    }
    return matchedDoors;
  }, [doors, matchedDoors, statusFilter, filterMode]);

  const renderItems = useMemo(() => {
    const inView = doorsInBounds(visibleDoors, viewBounds);
    return clusterCanvassDoors(inView, viewBounds?.zoom ?? 16);
  }, [visibleDoors, viewBounds]);

  useEffect(() => {
    points.current = initialPolygon.map(p => [Number(p[0]), Number(p[1])]);
    if (ready) renderDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialPolygon), ready]);

  useEffect(() => {
    if (!shouldUseGoogleMaps()) {
      onUnavailable?.();
      return;
    }
    let cancelled = false;
    let stopWatch: (() => void) | undefined;
    setReady(false); setEngineError('');
    loadGoogleMaps().then(google => {
      if (cancelled || !el.current) return;
      googleRef.current = google;
      const instance = new google.maps.Map(el.current, {
        center: { lat: MARKET.lat, lng: MARKET.lng },
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
      stopWatch = watchGoogleMapError(el.current, () => {
        if (cancelled) return;
        if (onUnavailable) onUnavailable();
        else setEngineError(googleMapsErrorMessage('GOOGLE_MAPS_AUTH_FAILURE'));
      });
    }).catch(err => {
      if (cancelled) return;
      if (onUnavailable) onUnavailable();
      else setEngineError(googleMapsErrorMessage(err));
    });
    return () => {
      cancelled = true;
      stopWatch?.();
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
    if (!ready || !map.current) return;
    const instance = map.current;
    let timer = 0;
    const publish = () => {
      const b = instance.getBounds?.();
      if (!b) return;
      const ne = b.getNorthEast(); const sw = b.getSouthWest();
      const next = { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng(), zoom: instance.getZoom?.() || 16 };
      setViewBounds(next);
      onViewportChange?.(next);
    };
    const listener = instance.addListener('idle', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(publish, 160);
    });
    publish();
    return () => { window.clearTimeout(timer); listener?.remove?.(); };
  }, [ready, onViewportChange]);

  useEffect(() => {
    if (!ready || !map.current || !googleRef.current) return;
    clearData();
    const google = googleRef.current, instance = map.current;
    const bounds = new google.maps.LatLngBounds(); let hasBounds = false;
    if (!hoverWindow.current) hoverWindow.current = new google.maps.InfoWindow({ disableAutoPan: true, pixelOffset: new google.maps.Size(0, -12) });

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

    const doorIndex = new Map(visibleDoors.map((d) => [d.id, d]));
    const routeMap = new Map(routeDoorIds.map((id,index)=>[id,index+1]));
    const routePath = routeDoorIds.map(id=>doorIndex.get(id)||visibleDoors.find(d=>d.id===id)).filter(Boolean).map((d:any)=>({lat:Number(d.latitude),lng:Number(d.longitude)}));
    if (routePath.length > 1) {
      overlays.current.push(new google.maps.Polyline({map:instance,path:routePath,strokeColor:'#6e4d32',strokeWeight:4,strokeOpacity:.82,icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:1,scale:3},offset:'0',repeat:'18px'}]}));
    }

    const attachHover = (marker: any, door: FieldDoor) => {
      if (!canHoverPreview()) return;
      const status = doorStatus(door.do_not_knock ? 'do_not_knock' : door.status);
      marker.addListener('mouseover', () => {
        hoverWindow.current?.setContent(`<div class="ns-house-preview"><strong>${doorStreetLabel(door,'Mapped house')}</strong><span class="ns-house-hover-status" style="--pin:${status.color}">${status.label}</span><small>${formatRelativeActivity(door.last_visited_at)}</small><small>${door.assigned_name || 'Unassigned'}</small></div>`);
        hoverWindow.current?.open(instance, marker);
      });
      marker.addListener('mouseout', () => hoverWindow.current?.close());
    };

    renderItems.forEach((item) => {
      if (item.type === 'cluster') {
        const marker = new google.maps.Marker({
          map: instance, position: { lat: item.lat, lng: item.lng },
          title: `${item.count} houses`,
          icon: { url: clusterIconUrl(item.count, item.color), scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) },
          zIndex: 70,
        });
        marker.addListener('click', () => {
          instance.setCenter({ lat: item.lat, lng: item.lng });
          instance.setZoom(Math.min(20, (instance.getZoom?.() || 14) + 2));
        });
        dataMarkers.current.push(marker);
        bounds.extend({ lat: item.lat, lng: item.lng }); hasBounds = true;
        return;
      }
      const door = item.door;
      const lat=Number(door.latitude),lng=Number(door.longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      const status=door.do_not_knock ? doorStatus('do_not_knock') : doorStatus(door.status);
      const selected=door.id===activeDoorId; const routeIndex=door.id?routeMap.get(door.id):undefined;
      const dim = doorIsDimmed(door, statusFilter);
      const size = selected ? 26 : 22;
      const marker = new google.maps.Marker({
        map:instance, position:{lat,lng},
        icon:{url:houseMarkerDataUrl(status.color,{selected, dim}),scaledSize:new google.maps.Size(size, selected?30:26),anchor:new google.maps.Point(size/2, selected?30:26)},
        label: showDoorLabels && door.address ? {text:String(door.address),color:'#17120d',fontSize:'10px',fontWeight:'700',className:'ns-google-address-label'} : (routeIndex ? {text:String(routeIndex),color:'#17120d',fontSize:'9px',fontWeight:'800'} : undefined),
        zIndex:selected?160:routeIndex?120: dim?20:40,
        opacity: dim ? 0.42 : 1,
      });
      marker.addListener('click',()=>{ hoverWindow.current?.close(); onDoorClick?.(door); });
      attachHover(marker, door);
      dataMarkers.current.push(marker); bounds.extend({lat,lng}); hasBounds=true;
    });

    leads.forEach(lead => {
      if(lead.latitude==null||lead.longitude==null)return;
      if(lead.territory_door_id&&visibleDoors.some(d=>d.id===lead.territory_door_id))return;
      const lat=Number(lead.latitude),lng=Number(lead.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      if (viewBounds && (lat < viewBounds.south || lat > viewBounds.north || lng < viewBounds.west || lng > viewBounds.east)) return;
      const status=doorStatus(lead.status); const door:FieldDoor={latitude:lat,longitude:lng,address:lead.address,status:lead.status,territory_id:lead.territory_id,lead_id:lead.id,customer_name:lead.customer_name,last_visited_at:lead.last_contacted_at};
      const marker=new google.maps.Marker({map:instance,position:{lat,lng},icon:{url:houseMarkerDataUrl(status.color),scaledSize:new google.maps.Size(22,26),anchor:new google.maps.Point(11,26)},zIndex:55});
      marker.addListener('click',()=>onDoorClick?.(door));
      attachHover(marker, door);
      dataMarkers.current.push(marker);bounds.extend({lat,lng});hasBounds=true;
    });

    const fitKey=JSON.stringify({territories:territories.map(t=>[t.id,t.updated_at]),count:visibleDoors.length,route:routeDoorIds,selected:selectedTerritoryId});
    if(autoFit&&!editable&&hasBounds&&visibleDoors.length<1200&&lastFitKey.current!==fitKey){lastFitKey.current=fitKey;instance.fitBounds(bounds,fieldMode?52:38);const once=google.maps.event.addListenerOnce(instance,'idle',()=>{if(instance.getZoom()>18)instance.setZoom(18);once?.remove?.()})}
    if(editable)renderDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,territories,leads,renderItems,visibleDoors,selectedTerritoryId,routeDoorIds,activeDoorId,showDoorLabels,autoFit,editable,fieldMode,statusFilter]);

  useEffect(()=>{
    if(!ready||!map.current||!googleRef.current)return; clearLocation();
    const location=liveLocation||localLocation;if(!location)return; const google=googleRef.current,instance=map.current;
    const center={lat:Number(location.latitude),lng:Number(location.longitude)};
    locationOverlays.current.push(new google.maps.Circle({map:instance,center,radius:Math.max(8,Number(location.accuracy||20)),strokeColor:'#2b77ff',strokeOpacity:.32,strokeWeight:1,fillColor:'#2b77ff',fillOpacity:.12}));
    locationOverlays.current.push(new google.maps.Marker({map:instance,position:center,title:'Current location',icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:'#2b77ff',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3},zIndex:200}));
  },[ready,liveLocation,localLocation]);

  useEffect(()=>{if(!map.current)return;map.current.setMapTypeId(mapType);if(mapType==='roadmap')map.current.setOptions({styles:ROADMAP_STYLES});else map.current.setOptions({styles:null})},[mapType,ready]);
  useEffect(()=>{if(!map.current||editable)return;map.current.setOptions({gestureHandling:mobileGestureLock&&!interactionEnabled&&!fullscreen?'cooperative':'greedy'})},[interactionEnabled,mobileGestureLock,editable,ready,fullscreen]);
  useEffect(()=>{
    const invalidate=()=>window.setTimeout(()=>googleRef.current?.maps?.event?.trigger(map.current,'resize'),80);
    const onChange=()=>{if(document.fullscreenElement===wrap.current){setFullscreen(true);invalidate()}};
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape' && (canvasFs.current || document.fullscreenElement===wrap.current)) { e.preventDefault(); exitCanvasFs(); } };
    document.addEventListener('fullscreenchange',onChange);
    window.addEventListener('keydown', onKey);
    return()=>{document.removeEventListener('fullscreenchange',onChange);window.removeEventListener('keydown',onKey);applyCanvasFullscreen(false)};
  },[]);
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
  const invalidateMap=()=>{window.setTimeout(()=>googleRef.current?.maps?.event?.trigger(map.current,'resize'),80);window.setTimeout(()=>googleRef.current?.maps?.event?.trigger(map.current,'resize'),260)};
  const exitCanvasFs=()=>{canvasFs.current=false;setFullscreen(false);applyCanvasFullscreen(false);if(document.fullscreenElement===wrap.current) document.exitFullscreen().catch(()=>{});invalidateMap()};
  const toggleFullscreen=async()=>{
    const next=!fullscreen;
    canvasFs.current=next;
    setFullscreen(next);
    applyCanvasFullscreen(next);
    setInteractionEnabled(true);
    invalidateMap();
  };

  return <div ref={wrap} className={`field-map-wrap field-map-modern field-map-google ${fullscreen?'field-map-fullscreen field-map-canvas-fs':''} ${fieldMode?'field-map-field-mode':''} ${className}`}>
    <div className="field-map-toolbar google-map-toolbar">
      <div className="google-map-search"><span>⌕</span><input ref={searchInput} type="search" placeholder="Search address, neighborhood or place" aria-label="Search Google Maps" /></div>
      <button type="button" className="map-tool-btn" onClick={toggleFullscreen}>{fullscreen?'Exit Full Screen':'Full Screen'}</button>
      <button type="button" className="map-tool-btn map-location-btn" onClick={centerOnMe} disabled={locating}>{locating?'Locating…':'Use Current Location'}</button>
      <div className="map-style-switcher" aria-label="Google map style"><button type="button" className={mapType==='roadmap'?'active':''} onClick={()=>setMapType('roadmap')}>Map</button><button type="button" className={mapType==='satellite'?'active':''} onClick={()=>setMapType('satellite')}>Satellite</button><button type="button" className={mapType==='hybrid'?'active':''} onClick={()=>setMapType('hybrid')}>Hybrid</button></div>
      {editable&&<><button type="button" className="map-tool-btn" disabled={!points.current.length} onClick={undo}>Undo Point</button><button type="button" className="map-tool-btn" onClick={reset}>Clear</button></>}
    </div>
    {engineError&&<div className="map-engine-notice google-map-error"><strong>Google Maps setup needed</strong><span>{engineError}</span></div>}
    <div ref={el} className="field-map-canvas" />
    {fullscreen&&<button type="button" className="ns-canvas-exit" onClick={exitCanvasFs}>Exit Full Screen</button>}
    <div className="map-engine-badge google-map-badge"><span>GOOGLE MAPS</span> Territory + Leads</div>
    {mobileGestureLock&&!editable&&!fullscreen&&<div className={`map-interaction-toggle ${interactionEnabled?'active':''}`}><button type="button" onClick={()=>setInteractionEnabled(v=>!v)}>{interactionEnabled?'Done · Scroll Page':'Tap to Use Map'}</button></div>}
    {editable&&<div className="field-map-tools"><span>Click Google Maps to add boundary points. Drag numbered points to resize. Right-click a point to remove it.</span><strong>{points.current.length} points</strong></div>}
  </div>;
}
