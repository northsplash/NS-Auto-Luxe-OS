import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Link2, Search, Star, Trash2, Upload, X } from 'lucide-react';
import WorkspaceHero from '@/components/WorkspaceHero';
import type { Appointment, ClientPhoto, ClientPhotoKind, Profile } from '@/lib/supabase';
import {
  CLIENT_PHOTO_KINDS,
  importClientPhotoFiles,
  importClientPhotoUrl,
  jobsForCustomer,
  listClientPhotos,
  photoCustomers,
  removeClientPhoto,
  setClientPhotoFeatured,
  type PhotoCustomer,
} from '@/lib/clientPhotos';

type Props = {
  customers: Profile[];
  appointments: Appointment[];
  currentEmployeeId?: string | null;
  compactCustomer?: Profile | null;
};

export default function ClientPhotosSection({
  customers,
  appointments,
  currentEmployeeId,
  compactCustomer,
}: Props) {
  const people = useMemo(() => photoCustomers(customers, appointments), [customers, appointments]);
  const locked = compactCustomer
    ? people.find(p => p.profileId === compactCustomer.id) || {
        key: compactCustomer.id,
        profileId: compactCustomer.id,
        name: compactCustomer.full_name || compactCustomer.email || 'Customer',
        email: compactCustomer.email,
        phone: compactCustomer.phone,
        vehicle: compactCustomer.vehicle_info,
      }
    : null;
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(locked?.key || people[0]?.key || '');
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<ClientPhotoKind>('after');
  const [jobId, setJobId] = useState('');
  const [caption, setCaption] = useState('');
  const [url, setUrl] = useState('');
  const [filter, setFilter] = useState<'all' | ClientPhotoKind>('all');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = locked || people.find(p => p.key === selectedKey) || null;
  const jobs = jobsForCustomer(selected, appointments);
  const filteredPeople = people.filter(p =>
    !query || [p.name, p.email, p.phone, p.vehicle].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()),
  );

  const load = async (customer = selected) => {
    setLoading(true);
    setError('');
    try {
      setPhotos(await listClientPhotos(customer, appointments));
    } catch (err: any) {
      setError(err?.message || 'Could not load client photos.');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selected); }, [selected?.key, appointments.length]);
  useEffect(() => {
    if (locked) setSelectedKey(locked.key);
  }, [locked?.key]);
  useEffect(() => {
    if (jobId && !jobs.some(j => j.id === jobId)) setJobId('');
  }, [jobs, jobId]);

  const visible = photos.filter(p => filter === 'all' || p.kind === filter);

  const ingest = async (files: File[]) => {
    if (!selected) return setError('Select a client first.');
    if (!files.length) return;
    setBusy(true);
    setError('');
    const result = await importClientPhotoFiles(files, {
      customer: selected,
      appointmentId: jobId || null,
      kind,
      caption: caption.trim() || undefined,
      vehicleInfo: selected.vehicle,
      employeeId: currentEmployeeId || null,
      featured: kind === 'portfolio',
    });
    setBusy(false);
    setCaption('');
    await load(selected);
    if (result.errors.length) setError(result.errors.slice(0, 4).join('\n'));
  };

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return setError('Select a client first.');
    setBusy(true);
    setError('');
    try {
      await importClientPhotoUrl(url, {
        customer: selected,
        appointmentId: jobId || null,
        kind,
        caption: caption.trim() || undefined,
        vehicleInfo: selected.vehicle,
        employeeId: currentEmployeeId || null,
        featured: kind === 'portfolio',
      });
      setUrl('');
      await load(selected);
    } catch (err: any) {
      setError(err?.message || 'Could not import that URL.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    ingest(Array.from(e.dataTransfer.files || []));
  };

  const toggleFeatured = async (photo: ClientPhoto) => {
    await setClientPhotoFeatured(photo, !photo.featured);
    setPhotos(p => p.map(x => x.id === photo.id ? { ...x, featured: !photo.featured } : x));
  };

  const destroy = async (photo: ClientPhoto) => {
    if (!confirm('Remove this photo from the client library?')) return;
    await removeClientPhoto(photo);
    setPhotos(p => p.filter(x => x.id !== photo.id));
  };

  const counts = {
    all: photos.length,
    before: photos.filter(p => p.kind === 'before').length,
    after: photos.filter(p => p.kind === 'after').length,
    damage: photos.filter(p => p.kind === 'damage').length,
    portfolio: photos.filter(p => p.kind === 'portfolio' || p.featured).length,
  };

  const importer = (
    <section className="client-photo-import">
      <div className="client-photo-import-head">
        <div>
          <span className="eyebrow">Import</span>
          <h3>Client photos</h3>
          <p>Drop a folder of before/after shots, or paste a public image URL. Attach to a job if this visit already exists.</p>
        </div>
      </div>
      <div className="client-photo-kind-row" role="radiogroup" aria-label="Photo type">
        {CLIENT_PHOTO_KINDS.map(k => (
          <button key={k.id} type="button" className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}>
            <strong>{k.label}</strong>
            <small>{k.hint}</small>
          </button>
        ))}
      </div>
      {jobs.length > 0 && (
        <label className="client-photo-field">
          Attach to job
          <select value={jobId} onChange={e => setJobId(e.target.value)}>
            <option value="">Library only — not tied to a visit</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {(j.scheduled_at ? new Date(j.scheduled_at).toLocaleDateString() : 'Unscheduled')} · {j.service_name}
                {j.vehicle_info ? ` · ${j.vehicle_info}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="client-photo-field">
        Caption (optional)
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Front 3/4, interior, wheels…" />
      </label>
      <div
        className={`client-photo-drop ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={busy || !selected}
          className="client-photo-file"
          onChange={e => {
            ingest(Array.from(e.target.files || []));
            e.currentTarget.value = '';
          }}
        />
        <Upload size={22} />
        <strong>{busy ? 'Importing…' : 'Drop photos here or browse'}</strong>
        <span>JPG, PNG, HEIC, WebP · up to 12 MB each · phone camera works too</span>
        <div className="client-photo-drop-actions">
          <button type="button" className="btn-primary" disabled={busy || !selected} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={15} /> Choose files
          </button>
          <button type="button" className="btn-outline" disabled={busy || !selected} onClick={() => {
            const el = document.createElement('input');
            el.type = 'file';
            el.accept = 'image/*';
            el.setAttribute('capture', 'environment');
            el.onchange = () => ingest(Array.from(el.files || []));
            el.click();
          }}>
            <Camera size={15} /> Camera
          </button>
        </div>
      </div>
      <form className="client-photo-url" onSubmit={addUrl}>
        <Link2 size={16} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Or paste a public photo URL" />
        <button className="btn-outline" disabled={busy || !url.trim() || !selected}>Import URL</button>
      </form>
      {error && <p className="client-photo-error">{error}</p>}
    </section>
  );

  const gallery = (
    <section className="client-photo-gallery">
      <div className="client-photo-gallery-head">
        <div>
          <span className="eyebrow">{selected ? selected.name : 'Library'}</span>
          <h3>{loading ? 'Loading photos…' : visible.length ? `${visible.length} photo${visible.length === 1 ? '' : 's'}` : 'No photos yet'}</h3>
        </div>
        <div className="client-photo-filters">
          {(['all', 'before', 'after', 'damage', 'portfolio'] as const).map(id => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
              {id === 'all' ? 'All' : CLIENT_PHOTO_KINDS.find(k => k.id === id)?.label} · {counts[id]}
            </button>
          ))}
        </div>
      </div>
      {loading && <div className="client-photo-empty"><p>Loading the library…</p></div>}
      {!loading && !visible.length && (
        <div className="client-photo-empty">
          <Camera size={36} />
          <h3>{selected ? `No ${filter === 'all' ? '' : filter + ' '}photos for ${selected.name}` : 'Select a client'}</h3>
          <p>{selected ? 'Import a before/after set from this visit or an older album.' : 'Pick a client, then drop photos into the importer.'}</p>
        </div>
      )}
      <div className="client-photo-grid">
        {visible.map(photo => (
          <figure key={photo.id} className={photo.featured ? 'featured' : ''}>
            <a href={photo.file_url} target="_blank" rel="noreferrer">
              <img src={photo.file_url} alt={photo.caption || photo.kind} />
            </a>
            <figcaption>
              <span className={`client-photo-kind kind-${photo.kind}`}>{photo.kind}</span>
              <strong>{photo.caption || photo.file_name || selected?.name}</strong>
              <small>{photo.vehicle_info || selected?.vehicle || 'Vehicle not listed'} · {new Date(photo.created_at).toLocaleDateString()}</small>
            </figcaption>
            <div className="client-photo-card-actions">
              <button type="button" title={photo.featured ? 'Remove from portfolio' : 'Mark as portfolio'} onClick={() => toggleFeatured(photo)}>
                <Star size={14} fill={photo.featured ? 'currentColor' : 'none'} />
              </button>
              <button type="button" title="Remove photo" onClick={() => destroy(photo)}><Trash2 size={14} /></button>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );

  if (compactCustomer) {
    return (
      <div className="client-photos-compact">
        {importer}
        {gallery}
      </div>
    );
  }

  return (
    <div className="tab-content client-photos-page">
      <WorkspaceHero
        tab="client_photos"
        metrics={[
          { label: 'In library', value: String(photos.length) },
          { label: 'Clients', value: String(people.length) },
          { label: 'After shots', value: String(counts.after) },
          { label: 'Portfolio', value: String(counts.portfolio) },
        ]}
      />
      <div className="client-photos-layout">
        <aside className="client-photo-list">
          <div className="search-control">
            <Search size={16} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search clients" aria-label="Search clients" />
            {query && <button type="button" className="icon-btn" onClick={() => setQuery('')}><X size={14} /></button>}
          </div>
          {filteredPeople.map(p => (
            <button key={p.key} type="button" className={selected?.key === p.key ? 'selected' : ''} onClick={() => setSelectedKey(p.key)}>
              <span className="crm-avatar">{p.name[0]?.toUpperCase()}</span>
              <span>
                <strong>{p.name}</strong>
                <small>{p.email || p.phone || 'No contact'}{p.vehicle ? ` · ${p.vehicle}` : ''}</small>
              </span>
            </button>
          ))}
          {!filteredPeople.length && (
            <div className="client-photo-empty tight">
              <h3>No matching clients</h3>
              <p>Bookings and customer records show up here. Add a customer, then import their album.</p>
            </div>
          )}
        </aside>
        <div className="client-photo-main">
          {!selected ? (
            <div className="client-photo-empty">
              <Camera size={40} />
              <h3>Select a client</h3>
              <p>Import before/after photos onto their record. Portfolio shots can be starred for marketing.</p>
            </div>
          ) : (
            <>
              {importer}
              {gallery}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
