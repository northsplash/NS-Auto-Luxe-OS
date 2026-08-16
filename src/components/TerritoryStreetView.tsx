import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, House, KeyRound, MapPin, RefreshCw, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react';

type StreetViewHouse = {
  id?: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  status?: string | null;
  source?: string | null;
};

type Props = {
  houses: StreetViewHouse[];
  activeHouse?: StreetViewHouse | null;
  onActiveHouseChange?: (house: StreetViewHouse) => void;
};

declare global {
  interface Window {
    mapillary?: any;
    __northSplashMapillaryPromise?: Promise<any>;
  }
}

const MAPILLARY_TOKEN = (import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN || '').trim();
const MAPILLARY_JS = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.js';
const MAPILLARY_CSS = 'https://unpkg.com/mapillary-js@4.1.2/dist/mapillary.css';

function loadMapillary() {
  if (window.mapillary?.Viewer) return Promise.resolve(window.mapillary);
  if (window.__northSplashMapillaryPromise) return window.__northSplashMapillaryPromise;
  if (!MAPILLARY_TOKEN) return Promise.reject(new Error('MAPILLARY_TOKEN_MISSING'));

  window.__northSplashMapillaryPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-ns-mapillary="true"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = MAPILLARY_CSS;
      css.dataset.nsMapillary = 'true';
      document.head.appendChild(css);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-ns-mapillary="true"]');
    if (existing) {
      const wait = window.setInterval(() => {
        if (window.mapillary?.Viewer) {
          window.clearInterval(wait);
          resolve(window.mapillary);
        }
      }, 80);
      window.setTimeout(() => {
        window.clearInterval(wait);
        if (!window.mapillary?.Viewer) reject(new Error('Mapillary viewer failed to load.'));
      }, 12000);
      return;
    }

    const script = document.createElement('script');
    script.src = MAPILLARY_JS;
    script.async = true;
    script.dataset.nsMapillary = 'true';
    script.onload = () => window.mapillary?.Viewer ? resolve(window.mapillary) : reject(new Error('Mapillary viewer failed to initialize.'));
    script.onerror = () => reject(new Error('Mapillary viewer failed to load.'));
    document.head.appendChild(script);
  });

  return window.__northSplashMapillaryPromise;
}

function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number) {
  const r=6371000, rad=Math.PI/180;
  const dLat=(bLat-aLat)*rad, dLng=(bLng-aLng)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(aLat*rad)*Math.cos(bLat*rad)*Math.sin(dLng/2)**2;
  return 2*r*Math.asin(Math.sqrt(x));
}

async function nearestMapillaryImage(house: StreetViewHouse) {
  const lat=Number(house.latitude), lng=Number(house.longitude);
  // Search farther than a single property frontage so houses with sparse Mapillary coverage can still use the nearest capture.
  const latPad=0.00225;
  const lngPad=0.00225/Math.max(0.25,Math.cos(lat*Math.PI/180));
  const bbox=[lng-lngPad,lat-latPad,lng+lngPad,lat+latPad].join(',');
  const url=`https://graph.mapillary.com/images?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}&fields=id,geometry,captured_at,compass_angle,thumb_2048_url,sequence,camera_type&bbox=${bbox}&limit=100`;
  const response=await fetch(url);
  if(!response.ok) throw new Error(response.status===401||response.status===403?'MAPILLARY_TOKEN_INVALID':'Mapillary imagery lookup failed.');
  const json=await response.json();
  const images=(json?.data||[]).filter((x:any)=>x?.id&&Array.isArray(x?.geometry?.coordinates));
  if(!images.length) return null;
  const ranked=images.map((image:any)=>({
    ...image,
    distance:distanceMeters(lat,lng,Number(image.geometry.coordinates[1]),Number(image.geometry.coordinates[0])),
    spherical:['spherical','equirectangular'].includes(String(image.camera_type||'').toLowerCase()),
  }));
  // Prefer a nearby true panorama. Otherwise use the closest capture so we do not jump far away just to get 360 imagery.
  ranked.sort((a:any,b:any)=>{
    const aNearby360=a.spherical&&a.distance<=110;
    const bNearby360=b.spherical&&b.distance<=110;
    if(aNearby360!==bNearby360) return aNearby360?-1:1;
    return a.distance-b.distance;
  });
  return ranked[0];
}

function externalMapillaryUrl(house?: StreetViewHouse | null, imageId?: string | null) {
  if (imageId) return `https://www.mapillary.com/app/?pKey=${encodeURIComponent(imageId)}&focus=photo`;
  if (!house) return 'https://www.mapillary.com/app/';
  return `https://www.mapillary.com/app/?lat=${house.latitude}&lng=${house.longitude}&z=17`;
}

export default function TerritoryStreetView({ houses, activeHouse, onActiveHouseChange }: Props) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const mapillaryViewerRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [imageId,setImageId]=useState<string|null>(null);
  const [fallbackImage,setFallbackImage]=useState<string>('');
  const [captureDate,setCaptureDate]=useState<string>('');
  const [cameraType,setCameraType]=useState<string>('');
  const [captureDistance,setCaptureDistance]=useState<number|null>(null);
  const [internalActive, setInternalActive] = useState<StreetViewHouse | null>(activeHouse || houses[0] || null);

  useEffect(() => {
    if (activeHouse) setInternalActive(activeHouse);
    else if (!internalActive && houses.length) setInternalActive(houses[0]);
  }, [activeHouse, houses, internalActive]);

  useEffect(()=>()=>{try{mapillaryViewerRef.current?.remove?.()}catch{} mapillaryViewerRef.current=null},[]);

  const current = activeHouse || internalActive || houses[0] || null;
  const currentIndex = useMemo(() => {
    if (!current) return -1;
    return houses.findIndex(h => (h.id && current.id ? h.id === current.id : h.latitude === current.latitude && h.longitude === current.longitude));
  }, [houses, current]);

  const selectHouse = (house: StreetViewHouse) => {
    setInternalActive(house);
    onActiveHouseChange?.(house);
  };

  const shiftHouse = (delta: number) => {
    if (!houses.length) return;
    const index = currentIndex < 0 ? 0 : currentIndex;
    const next = houses[(index + delta + houses.length) % houses.length];
    if (next) selectHouse(next);
  };

  const positionPanorama = async (house: StreetViewHouse) => {
    if (!viewerRef.current) return;
    setLoading(true); setError(''); setAvailable(null); setImageId(null); setFallbackImage(''); setCaptureDate(''); setCameraType(''); setCaptureDistance(null);
    try {
      if(!MAPILLARY_TOKEN) throw new Error('MAPILLARY_TOKEN_MISSING');
      const [mly,image]=await Promise.all([loadMapillary(),nearestMapillaryImage(house)]);
      if(!image?.id) throw new Error('NO_MAPILLARY_IMAGERY');
      setImageId(String(image.id));
      setFallbackImage(String(image.thumb_2048_url||''));
      setCaptureDate(image.captured_at ? new Date(Number(image.captured_at)).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '');
      setCameraType(String(image.camera_type||'perspective').toLowerCase());
      setCaptureDistance(Number.isFinite(image.distance)?Math.round(image.distance):null);
      if(!mapillaryViewerRef.current){
        mapillaryViewerRef.current=new mly.Viewer({
          accessToken:MAPILLARY_TOKEN,
          container:'north-splash-mapillary-viewer',
          imageId:String(image.id),
          combinedPanning:true,
          cameraControls:mly.CameraControls?.Street,
          component:{cover:false,sequence:true,zoom:true,bearing:true,direction:true,pointer:true,keyboard:true},
        });
        mapillaryViewerRef.current?.activateCombinedPanning?.();
        window.requestAnimationFrame(()=>mapillaryViewerRef.current?.resize?.());
        window.setTimeout(()=>mapillaryViewerRef.current?.resize?.(),250);
        window.setTimeout(()=>mapillaryViewerRef.current?.resize?.(),900);
      }else{
        await mapillaryViewerRef.current.moveTo(String(image.id));
        mapillaryViewerRef.current.resize?.();
      }
      setAvailable(true);
    } catch (err:any) {
      setAvailable(false);
      const code=err?.message||'';
      setError(code==='MAPILLARY_TOKEN_MISSING'
        ? 'Add the free Mapillary client access token in Vercel as VITE_MAPILLARY_ACCESS_TOKEN.'
        : code==='MAPILLARY_TOKEN_INVALID'
          ? 'The Mapillary token was rejected. Check the Vercel environment variable and redeploy.'
          : code==='NO_MAPILLARY_IMAGERY'
            ? 'No Mapillary street imagery was found close to this property. Coverage varies by street.'
            : 'Street imagery could not be loaded for this property.');
    } finally { setLoading(false); }
  };

  const lookSide = async (delta: number) => {
    const viewer=mapillaryViewerRef.current;
    if(!viewer) return;
    try {
      const center=await viewer.getCenter();
      const nextX=Math.max(0.08,Math.min(0.92,Number(center?.[0]??0.5)+delta));
      viewer.setCenter([nextX,Number(center?.[1]??0.5)]);
    } catch {}
  };

  const moveCapture = async (direction: 'prev'|'next') => {
    const viewer=mapillaryViewerRef.current;
    if(!viewer) return;
    try {
      const mly=await loadMapillary();
      const dir=direction==='next'?mly.NavigationDirection?.Next:mly.NavigationDirection?.Prev;
      if(dir==null) return;
      const image=await viewer.moveDir(dir);
      if(image?.id) setImageId(String(image.id));
    } catch {}
  };

  useEffect(() => {
    if (!open || !current) return;
    const timer = window.setTimeout(() => positionPanorama(current), 60);
    return () => window.clearTimeout(timer);
  }, [open, current?.id, current?.latitude, current?.longitude]);

  return (
    <section className={`territory-streetview ${open ? 'is-open' : ''}`}>
      <button type="button" className="territory-streetview-toggle" onClick={() => setOpen(v => !v)}>
        <span className="streetview-toggle-icon"><Eye size={19} /></span>
        <span>
          <small>FREE STREET-LEVEL PROPERTY REVIEW</small>
          <strong>{open ? 'Hide Street View' : 'Check Street View'}</strong>
          <em>{houses.length ? `${houses.length} mapped ${houses.length === 1 ? 'house' : 'houses'} ready to inspect · powered by Mapillary` : 'Load or preview houses to inspect available street imagery'}</em>
        </span>
        <span className="streetview-toggle-action">{open ? 'Close' : 'Open viewer'} <ChevronRight size={17} /></span>
      </button>

      {open && (
        <div className="territory-streetview-body">
          <header className="territory-streetview-head">
            <div>
              <span className="eyebrow">INTERACTIVE STREET IMAGERY · MAPILLARY</span>
              <h3>{current?.address || 'Choose a mapped house'}</h3>
              <p>Look around and move through available street captures without leaving North Splash. Imagery coverage depends on community captures.</p>
            </div>
            <div className="streetview-house-nav">
              <button type="button" className="btn-outline" disabled={!houses.length} onClick={() => shiftHouse(-1)}><ChevronLeft size={15}/>Previous House</button>
              <span>{currentIndex >= 0 ? currentIndex + 1 : 0} / {houses.length}</span>
              <button type="button" className="btn-outline" disabled={!houses.length} onClick={() => shiftHouse(1)}>Next House<ChevronRight size={15}/></button>
            </div>
          </header>

          <div className="territory-streetview-grid">
            <div className="streetview-viewer-shell">
              {fallbackImage&&<img className="streetview-static-fallback" src={fallbackImage} alt={current?.address?`Street imagery near ${current.address}`:'Mapillary street imagery'} />}
              <div id="north-splash-mapillary-viewer" ref={viewerRef} className="streetview-viewer" />
              {available===true&&<div className="streetview-live-badge"><span/>{['spherical','equirectangular'].includes(cameraType)?'360° Panorama':'Standard Street Photo'}{captureDate?` · ${captureDate}`:''}{captureDistance!=null?` · ${captureDistance}m away`:''}</div>}
              {available===true&&<div className="streetview-camera-controls"><button type="button" onClick={()=>lookSide(-.22)} title="Look left"><RotateCcw size={16}/>Look left</button><button type="button" onClick={()=>moveCapture('prev')} title="Previous street capture"><SkipBack size={16}/>Previous capture</button><button type="button" onClick={()=>moveCapture('next')} title="Next street capture">Next capture<SkipForward size={16}/></button><button type="button" onClick={()=>lookSide(.22)} title="Look right">Look right<RotateCw size={16}/></button></div>}
              {!current && <div className="streetview-overlay"><House size={34}/><strong>No house selected</strong><span>Preview or load houses first.</span></div>}
              {current && loading && <div className="streetview-overlay"><RefreshCw className="spin" size={28}/><strong>Finding nearest free street imagery…</strong><span>{current.address || `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`}</span></div>}
              {current && !loading && available === false && <div className="streetview-overlay streetview-error"><KeyRound size={28}/><strong>Street imagery unavailable</strong><span>{error}</span><a className="btn-primary" target="_blank" rel="noreferrer" href={externalMapillaryUrl(current,imageId)}>Check Mapillary <ExternalLink size={14}/></a></div>}
            </div>

            <aside className="streetview-house-list">
              <div className="streetview-house-list-head"><div><strong>Territory Houses</strong><small>Click a property to move the viewer</small></div><span>{houses.length}</span></div>
              <div className="streetview-house-scroll">
                {houses.length === 0 && <div className="ns-empty compact">No mapped houses yet.</div>}
                {houses.slice(0,250).map((house,index)=>{
                  const active=current&&(house.id&&current.id?house.id===current.id:house.latitude===current.latitude&&house.longitude===current.longitude);
                  return <button type="button" key={house.id||`${house.latitude}-${house.longitude}-${index}`} className={`streetview-house-row ${active?'active':''}`} onClick={()=>selectHouse(house)}><span><MapPin size={15}/></span><div><strong>{house.address||`House ${index+1}`}</strong><small>{house.status?house.status.replaceAll('_',' '):'Mapped property'}</small></div><ChevronRight size={15}/></button>;
                })}
              </div>
            </aside>
          </div>
          {current&&<div className="streetview-footer"><div><strong>Free street-level review</strong><span>If WebGL is unavailable, the latest Mapillary capture remains visible as a photo fallback.</span></div><a className="btn-outline" href={externalMapillaryUrl(current,imageId)} target="_blank" rel="noreferrer">Open full Mapillary <ExternalLink size={14}/></a></div>}
        </div>
      )}
    </section>
  );
}
