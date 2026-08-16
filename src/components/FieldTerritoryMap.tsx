import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lead, LeadTerritory } from '@/lib/supabase';
import { doorStatus } from '@/lib/fieldOps';

type Door = {
  id?: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  status?: string;
  territory_id?: string | null;
  lead_id?: string | null;
  do_not_knock?: boolean;
};

type Props = {
  territories: LeadTerritory[];
  leads?: Lead[];
  doors?: Door[];
  editable?: boolean;
  selectedTerritoryId?: string;
  initialPolygon?: [number, number][];
  onPolygonChange?: (points: [number, number][]) => void;
  onDoorClick?: (door: Door) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onTerritoryClick?: (territory: LeadTerritory) => void;
  liveLocation?: { latitude: number; longitude: number; accuracy?: number | null } | null;
  routeDoorIds?: string[];
  activeDoorId?: string | null;
  statusFilter?: string[];
  showDoorLabels?: boolean;
  className?: string;
  autoFit?: boolean;
  mobileGestureLock?: boolean;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export default function FieldTerritoryMap({
  territories,
  leads = [],
  doors = [],
  editable = false,
  selectedTerritoryId,
  initialPolygon = [],
  onPolygonChange,
  onDoorClick,
  onMapClick,
  onTerritoryClick,
  liveLocation,
  routeDoorIds = [],
  activeDoorId,
  statusFilter = [],
  showDoorLabels = false,
  className = '',
  autoFit = true,
  mobileGestureLock = true,
}: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const layers = useRef<any>(null);
  const drawLayer = useRef<any>(null);
  const locationLayer = useRef<any>(null);
  const points = useRef<[number, number][]>([]);
  const editableRef = useRef(editable);
  const onMapClickRef = useRef(onMapClick);
  const onDoorClickRef = useRef(onDoorClick);
  const onTerritoryClickRef = useRef(onTerritoryClick);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [interactionEnabled, setInteractionEnabled] = useState(false);
  const lastFitKey = useRef('');

  useEffect(() => { editableRef.current = editable; }, [editable]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onDoorClickRef.current = onDoorClick; }, [onDoorClick]);
  useEffect(() => { onTerritoryClickRef.current = onTerritoryClick; }, [onTerritoryClick]);
  useEffect(() => { onPolygonChangeRef.current = onPolygonChange; }, [onPolygonChange]);

  useEffect(() => {
    points.current = initialPolygon.map(p => [Number(p[0]), Number(p[1])]);
    redrawDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialPolygon)]);

  useEffect(() => {
    (async () => {
      if (!document.querySelector('link[data-ns-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.dataset.nsLeaflet = 'true';
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Unable to load map.')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = LEAFLET_JS;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Unable to load map.'));
          document.body.appendChild(script);
        });
      }
      setReady(true);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!ready || !el.current || map.current) return;
    const L = (window as any).L;
    const instance = L.map(el.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      minZoom: 3,
      maxZoom: 20,
      scrollWheelZoom: true,
      touchZoom: true,
      dragging: true,
    }).setView([35.7796, -78.6382], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    drawLayer.current = L.layerGroup().addTo(instance);
    locationLayer.current = L.layerGroup().addTo(instance);
    instance.on('click', (event: any) => {
      if (editableRef.current) {
        points.current = [...points.current, [event.latlng.lat, event.latlng.lng]];
        redrawDraft();
        onPolygonChangeRef.current?.([...points.current]);
      } else {
        onMapClickRef.current?.(event.latlng.lat, event.latlng.lng);
      }
    });
    map.current = instance;
    setTimeout(() => instance.invalidateSize(), 80);
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [ready]);

  function redrawDraft() {
    if (!map.current || !drawLayer.current || !(window as any).L) return;
    const L = (window as any).L;
    drawLayer.current.clearLayers();
    const current = points.current;
    if (current.length > 1) {
      const shape = current.length >= 3 ? L.polygon(current, {
        color: '#9d7651', weight: 3, fillColor: '#9d7651', fillOpacity: .14, dashArray: '7 5',
      }) : L.polyline(current, { color: '#9d7651', weight: 3, dashArray: '7 5' });
      shape.addTo(drawLayer.current);
    }
    current.forEach((point, index) => {
      const marker = L.marker(point, {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({
          className: 'ns-territory-vertex-wrap',
          html: `<span class="ns-territory-vertex">${index + 1}</span>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      });
      marker.on('drag', (event: any) => {
        const ll = event.target.getLatLng();
        points.current[index] = [ll.lat, ll.lng];
        // Redrawing on drag gives immediate polygon resizing feedback.
        const saved = [...points.current];
        drawLayer.current.clearLayers();
        if (saved.length > 1) {
          (saved.length >= 3 ? L.polygon(saved, { color:'#9d7651',weight:3,fillColor:'#9d7651',fillOpacity:.14,dashArray:'7 5' }) : L.polyline(saved,{color:'#9d7651',weight:3,dashArray:'7 5'})).addTo(drawLayer.current);
        }
        saved.forEach((p, i) => {
          if (i === index) return;
          const m = L.marker(p, { draggable:false, keyboard:false, icon:L.divIcon({className:'ns-territory-vertex-wrap',html:`<span class="ns-territory-vertex">${i+1}</span>`,iconSize:[28,28],iconAnchor:[14,14]}) });
          m.addTo(drawLayer.current);
        });
        event.target.addTo(drawLayer.current);
      });
      marker.on('dragend', (event: any) => {
        const ll = event.target.getLatLng();
        points.current[index] = [ll.lat, ll.lng];
        onPolygonChangeRef.current?.([...points.current]);
        redrawDraft();
      });
      marker.on('contextmenu', () => {
        points.current = points.current.filter((_p, i) => i !== index);
        onPolygonChangeRef.current?.([...points.current]);
        redrawDraft();
      });
      marker.addTo(drawLayer.current);
    });
  }

  const visibleDoors = useMemo(() => {
    if (!statusFilter.length) return doors;
    return doors.filter(d => statusFilter.includes(d.status || 'unworked'));
  }, [doors, statusFilter]);

  useEffect(() => {
    if (!map.current || !layers.current || !(window as any).L) return;
    const L = (window as any).L;
    layers.current.clearLayers();
    const bounds: any[] = [];

    territories.forEach(territory => {
      const poly = (territory.polygon_geojson as any)?.coordinates?.[0];
      let layer: any;
      if (poly?.length) {
        const pts = poly.map((p: number[]) => [Number(p[1]), Number(p[0])]);
        layer = L.polygon(pts, {
          color: territory.id === selectedTerritoryId ? '#6e4d32' : (territory.color || '#9d7651'),
          fillColor: territory.color || '#9d7651',
          weight: territory.id === selectedTerritoryId ? 4 : 2,
          fillOpacity: territory.id === selectedTerritoryId ? .17 : .08,
        });
        bounds.push(...pts);
      } else if (territory.center_lat != null && territory.center_lng != null) {
        layer = L.circle([Number(territory.center_lat), Number(territory.center_lng)], {
          radius: territory.radius_meters || 1000,
          color: territory.color || '#9d7651', weight: 2, fillOpacity: .06,
        });
        bounds.push([Number(territory.center_lat), Number(territory.center_lng)]);
      }
      if (layer) {
        layer.bindTooltip(`<strong>${escapeText(territory.name)}</strong>`, { sticky: true });
        layer.on('click', (e: any) => { L.DomEvent.stopPropagation(e); onTerritoryClickRef.current?.(territory); });
        layer.addTo(layers.current);
      }
    });

    const routeMap = new Map(routeDoorIds.map((id, index) => [id, index + 1]));
    const routePoints: [number, number][] = [];
    routeDoorIds.forEach(id => {
      const door = visibleDoors.find(d => d.id === id);
      if (door) routePoints.push([door.latitude, door.longitude]);
    });
    if (routePoints.length > 1) {
      L.polyline(routePoints, { color:'#6e4d32', weight:4, opacity:.82, dashArray:'8 8' }).addTo(layers.current);
    }

    visibleDoors.forEach(door => {
      if (!Number.isFinite(Number(door.latitude)) || !Number.isFinite(Number(door.longitude))) return;
      const status = door.do_not_knock ? doorStatus('do_not_knock') : doorStatus(door.status || 'unworked');
      const selected = activeDoorId && door.id === activeDoorId;
      const routeIndex = door.id ? routeMap.get(door.id) : undefined;
      const marker = L.marker([Number(door.latitude), Number(door.longitude)], {
        keyboard: false,
        riseOnHover: true,
        icon: L.divIcon({
          className: 'ns-door-marker-wrap',
          html: `<span class="ns-door-marker ${selected ? 'selected' : ''}" style="--door-color:${status.color}"><span class="ns-door-roof"></span><span class="ns-door-body">${routeIndex ? `<b>${routeIndex}</b>` : '<i></i>'}</span></span>`,
          iconSize: [30, 34],
          iconAnchor: [15, 31],
          popupAnchor: [0, -29],
        }),
      });
      marker.on('click', (e: any) => { L.DomEvent.stopPropagation(e); onDoorClickRef.current?.(door); });
      const address = door.address || 'House';
      marker.bindTooltip(`${routeIndex ? `<b>#${routeIndex}</b> · ` : ''}${escapeText(address)} · ${escapeText(status.label)}`, {
        direction: 'top', sticky: true, permanent: showDoorLabels && Boolean(door.address), className: 'ns-house-tooltip',
      });
      marker.addTo(layers.current);
      bounds.push([Number(door.latitude), Number(door.longitude)]);
    });

    // Leads without a loaded door remain visible as slightly larger rings.
    leads.forEach(lead => {
      if (lead.latitude == null || lead.longitude == null) return;
      if (lead.territory_door_id && visibleDoors.some(d => d.id === lead.territory_door_id)) return;
      const status = doorStatus(lead.status);
      const marker = L.circleMarker([Number(lead.latitude), Number(lead.longitude)], {
        radius: 9, color:'#fffdf9', weight:2, fillColor:status.color, fillOpacity:1,
      });
      marker.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onDoorClickRef.current?.({ latitude:Number(lead.latitude), longitude:Number(lead.longitude), address:lead.address, status:lead.status, territory_id:lead.territory_id, lead_id:lead.id });
      });
      marker.bindTooltip(`${escapeText(lead.address || lead.customer_name || 'Lead')} · ${escapeText(status.label)}`, { sticky:true });
      marker.addTo(layers.current);
      bounds.push([Number(lead.latitude), Number(lead.longitude)]);
    });

    // Only auto-fit when the underlying territory/door dataset changes.
    // State changes such as selecting a house must NEVER reset the rep's zoom/center.
    const fitKey = JSON.stringify({
      territories: territories.map(t => [t.id, t.updated_at]),
      doors: visibleDoors.map(d => d.id),
      route: routeDoorIds,
    });
    if (autoFit && !editable && bounds.length && bounds.length < 900 && lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      try { map.current.fitBounds(bounds, { padding:[32,32], maxZoom:17, animate:false }); } catch { /* noop */ }
    }
  }, [territories, leads, visibleDoors, selectedTerritoryId, routeDoorIds, activeDoorId, showDoorLabels, autoFit, editable]);

  useEffect(() => {
    if (!map.current || !locationLayer.current || !(window as any).L) return;
    const L = (window as any).L;
    locationLayer.current.clearLayers();
    if (!liveLocation) return;
    L.circleMarker([liveLocation.latitude, liveLocation.longitude], {
      radius: 10, color:'#fff', weight:4, fillColor:'#9d7651', fillOpacity:1,
    }).bindTooltip('Your current location').addTo(locationLayer.current);
    if (liveLocation.accuracy && liveLocation.accuracy > 10) {
      L.circle([liveLocation.latitude, liveLocation.longitude], { radius:liveLocation.accuracy, color:'#9d7651', fillOpacity:.04, weight:1 }).addTo(locationLayer.current);
    }
  }, [liveLocation]);

  useEffect(() => {
    if (!map.current) return;
    const timer = setTimeout(() => map.current?.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [fullscreen]);

  useEffect(() => {
    const resize = () => setTimeout(() => map.current?.invalidateSize({ animate:false }), 80);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); };
  }, []);

  useEffect(() => {
    if (!map.current || !mobileGestureLock || editable) return;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (!coarse) return;
    const set = interactionEnabled;
    const controls = ['dragging','touchZoom','doubleClickZoom','scrollWheelZoom','boxZoom','keyboard'];
    controls.forEach(name => { const control = map.current?.[name]; if (control) set ? control.enable?.() : control.disable?.(); });
  }, [interactionEnabled, mobileGestureLock, editable, ready]);

  const reset = () => {
    points.current = [];
    drawLayer.current?.clearLayers();
    onPolygonChange?.([]);
  };
  const undo = () => {
    points.current = points.current.slice(0, -1);
    onPolygonChange?.([...points.current]);
    redrawDraft();
  };
  const centerOnMe = () => {
    if (liveLocation && map.current) map.current.setView([liveLocation.latitude, liveLocation.longitude], 18, { animate:true });
  };

  return (
    <div className={`field-map-wrap ${fullscreen ? 'field-map-fullscreen' : ''} ${className}`}>
      <div className="field-map-toolbar">
        <button type="button" className="map-tool-btn" onClick={() => setFullscreen(v => !v)}>{fullscreen ? 'Exit Full Screen' : 'Full Screen'}</button>
        {liveLocation && <button type="button" className="map-tool-btn" onClick={centerOnMe}>My Location</button>}
        {editable && <><button type="button" className="map-tool-btn" disabled={!points.current.length} onClick={undo}>Undo Point</button><button type="button" className="map-tool-btn" onClick={reset}>Clear</button></>}
      </div>
      <div ref={el} className="field-map-canvas" />
      {mobileGestureLock && !editable && <div className={`map-interaction-toggle ${interactionEnabled?'active':''}`}><button type="button" onClick={()=>setInteractionEnabled(v=>!v)}>{interactionEnabled?'Done · Scroll Page':'Tap to Use Map'}</button></div>}
      {editable && <div className="field-map-tools"><span>Click the map to add boundary points. Drag numbered points to resize. Right-click a point to remove it.</span><strong>{points.current.length} points</strong></div>}
    </div>
  );
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c] || c));
}
