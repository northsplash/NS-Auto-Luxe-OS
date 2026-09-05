import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, House, MapPin, RefreshCw } from 'lucide-react';
import { googleMapsErrorMessage, loadGoogleMaps } from '@/lib/googleMaps';

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

function externalStreetViewUrl(house?: StreetViewHouse | null) {
  if (!house) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${house.latitude},${house.longitude}`)}`;
}

export default function TerritoryStreetView({ houses, activeHouse, onActiveHouseChange }: Props) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [captureDistance, setCaptureDistance] = useState<number | null>(null);
  const [internalActive, setInternalActive] = useState<StreetViewHouse | null>(activeHouse || houses[0] || null);

  useEffect(() => {
    if (activeHouse) setInternalActive(activeHouse);
    else if (!internalActive && houses.length) setInternalActive(houses[0]);
  }, [activeHouse, houses, internalActive]);

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
    setLoading(true); setError(''); setAvailable(null); setCaptureDistance(null);
    try {
      const google = await loadGoogleMaps();
      const service = new google.maps.StreetViewService();
      const request = { location: { lat: Number(house.latitude), lng: Number(house.longitude) }, radius: 180, source: google.maps.StreetViewSource.OUTDOOR };
      const result:any = await new Promise((resolve, reject) => {
        service.getPanorama(request, (data:any, status:any) => status === google.maps.StreetViewStatus.OK && data ? resolve(data) : reject(new Error('NO_GOOGLE_STREET_VIEW')));
      });
      const panoLocation = result?.location?.latLng;
      if (!panoLocation) throw new Error('NO_GOOGLE_STREET_VIEW');
      const target = new google.maps.LatLng(Number(house.latitude), Number(house.longitude));
      const distance = google.maps.geometry?.spherical?.computeDistanceBetween?.(target, panoLocation);
      if (Number.isFinite(distance)) setCaptureDistance(Math.round(distance));

      if (!panoramaRef.current) {
        panoramaRef.current = new google.maps.StreetViewPanorama(viewerRef.current, {
          addressControl: false,
          linksControl: true,
          panControl: true,
          enableCloseButton: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          zoomControl: true,
          visible: true,
        });
      }
      panoramaRef.current.setPano(result.location.pano);
      panoramaRef.current.setPosition(panoLocation);
      const heading = google.maps.geometry?.spherical?.computeHeading?.(panoLocation, target);
      panoramaRef.current.setPov({ heading: Number.isFinite(heading) ? heading : 0, pitch: 0 });
      panoramaRef.current.setVisible(true);
      setAvailable(true);
    } catch (err:any) {
      setAvailable(false);
      setError(err?.message === 'NO_GOOGLE_STREET_VIEW'
        ? 'Google Street View did not find outdoor imagery close enough to this property.'
        : googleMapsErrorMessage(err));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open || !current) return;
    const timer = window.setTimeout(() => positionPanorama(current), 60);
    return () => window.clearTimeout(timer);
  }, [open, current?.id, current?.latitude, current?.longitude]);

  return (
    <section className={`territory-streetview territory-google-streetview ${open ? 'is-open' : ''}`}>
      <button type="button" className="territory-streetview-toggle" onClick={() => setOpen(v => !v)}>
        <span className="streetview-toggle-icon"><Eye size={19} /></span>
        <span>
          <small>GOOGLE STREET VIEW PROPERTY REVIEW</small>
          <strong>{open ? 'Hide Street View' : 'Check Street View'}</strong>
          <em>{houses.length ? `${houses.length} mapped ${houses.length === 1 ? 'house' : 'houses'} ready to inspect · powered by Google Maps` : 'Load or preview houses to inspect available Google Street View imagery'}</em>
        </span>
        <span className="streetview-toggle-action">{open ? 'Close' : 'Open viewer'} <ChevronRight size={17} /></span>
      </button>

      {open && (
        <div className="territory-streetview-body">
          <header className="territory-streetview-head">
            <div>
              <span className="eyebrow">INTERACTIVE PROPERTY IMAGERY · GOOGLE STREET VIEW</span>
              <h3>{current?.address || 'Choose a mapped house'}</h3>
              <p>Look around the property and move through Google Street View without leaving North Splash OS.</p>
            </div>
            <div className="streetview-house-nav">
              <button type="button" className="btn-outline" disabled={!houses.length} onClick={() => shiftHouse(-1)}><ChevronLeft size={15}/>Previous House</button>
              <span>{currentIndex >= 0 ? currentIndex + 1 : 0} / {houses.length}</span>
              <button type="button" className="btn-outline" disabled={!houses.length} onClick={() => shiftHouse(1)}>Next House<ChevronRight size={15}/></button>
            </div>
          </header>

          <div className="territory-streetview-grid">
            <div className="streetview-viewer-shell">
              <div ref={viewerRef} className="streetview-viewer" />
              {available===true&&<div className="streetview-live-badge"><span/>Google Street View{captureDistance!=null?` · ${captureDistance}m from property`:''}</div>}
              {!current && <div className="streetview-overlay"><House size={34}/><strong>No house selected</strong><span>Preview or load houses first.</span></div>}
              {current && loading && <div className="streetview-overlay"><RefreshCw className="spin" size={28}/><strong>Finding Google Street View…</strong><span>{current.address || `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`}</span></div>}
              {current && !loading && available === false && <div className="streetview-overlay streetview-error"><MapPin size={28}/><strong>Street View unavailable</strong><span>{error}</span><a className="btn-primary" target="_blank" rel="noreferrer" href={externalStreetViewUrl(current)}>Open Google Maps <ExternalLink size={14}/></a></div>}
            </div>

            <aside className="streetview-house-list">
              <div className="streetview-house-list-head"><div><strong>Territory Houses</strong><small>Click a property to move Google Street View</small></div><span>{houses.length}</span></div>
              <div className="streetview-house-scroll">
                {houses.length === 0 && <div className="ns-empty compact">No mapped houses yet.</div>}
                {houses.slice(0,250).map((house,index)=>{
                  const active=current&&(house.id&&current.id?house.id===current.id:house.latitude===current.latitude&&house.longitude===current.longitude);
                  return <button type="button" key={house.id||`${house.latitude}-${house.longitude}-${index}`} className={`streetview-house-row ${active?'active':''}`} onClick={()=>selectHouse(house)}><span><MapPin size={15}/></span><div><strong>{house.address||`House ${index+1}`}</strong><small>{house.status?house.status.replaceAll('_',' '):'Mapped property'}</small></div><ChevronRight size={15}/></button>;
                })}
              </div>
            </aside>
          </div>
          {current&&<div className="streetview-footer"><div><strong>Google-powered property review</strong><span>Street View availability depends on Google coverage for the selected property.</span></div><a className="btn-outline" href={externalStreetViewUrl(current)} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={14}/></a></div>}
        </div>
      )}
    </section>
  );
}
