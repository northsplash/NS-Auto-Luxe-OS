import { useState } from 'react';
import {
  ChevronDown, Crosshair, History, MapPin, MessageCircle, Navigation, Phone,
  Presentation, Target, UserRound, X,
} from 'lucide-react';
import { CANVASS_KNOCK_KEYS, NEEDS_TIME_KEYS } from '@/lib/canvass';
import { MARKET } from '@/lib/market';
import { composedLeadIdentity } from '@/lib/salesRabbitLeads';
import { doorStatus, doorStreetLabel, localDateTime } from '@/lib/fieldOps';
import { ServiceMenuSelect } from '@/components/DetailSelfPicker';
import type { TerritoryDoorHistory } from '@/lib/supabase';

type FormShape = Record<string, any>;

type Props = {
  mode?: 'rep' | 'manager';
  door: any;
  form: FormShape;
  setForm: (next: any) => void;
  history: TerritoryDoorHistory[];
  manual: boolean;
  saving: boolean;
  assignedName?: string;
  onClose: () => void;
  onKnock: (status: string) => void | Promise<void>;
  onSave: (e?: React.FormEvent, status?: string) => Promise<boolean> | void;
  onSaveNext: () => Promise<void> | void;
  onEstimate: () => void;
  onLocation: () => void;
  onPitch: () => void;
  onQuote: () => void;
  onAccount: () => void;
};

export default function CanvassInspector({
  mode = 'rep',
  door,
  form,
  setForm,
  history,
  manual,
  saving,
  assignedName,
  onClose,
  onKnock,
  onSave,
  onSaveNext,
  onEstimate,
  onLocation,
  onPitch,
  onQuote,
  onAccount,
}: Props) {
  const [detailsOpen, setDetails] = useState(mode === 'manager' || manual);
  const [historyOpen, setHistoryOpen] = useState(mode === 'manager');
  const protectedDNK = door?.do_not_knock || door?.status === 'do_not_knock';
  const statusMeta = doorStatus(form.status);
  const address = composedLeadIdentity(form, form.customer_name, form.address).address || doorStreetLabel(door, manual ? 'New lead' : 'Mapped house');
  const title = composedLeadIdentity(form, form.customer_name, form.address).name || address;
  const setField = (patch: Record<string, string>) => setForm((p: FormShape) => ({ ...p, ...patch }));
  const mapsUrl = Number.isFinite(Number(door?.latitude)) && Number.isFinite(Number(door?.longitude))
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${door.latitude},${door.longitude}`)}`
    : '';

  return (
    <div className={`house-drawer-backdrop canvass-inspector-backdrop ${mode}`} onClick={onClose}>
      <form className={`house-drawer field-house-sheet canvass-inspector ${mode}`} onSubmit={(e) => onSave(e)} onClick={(e) => e.stopPropagation()}>
        <div className="house-drawer-handle" />
        <div className="house-drawer-head field-house-head">
          <div className="field-house-address">
            <span className="eyebrow">{manual ? 'New lead' : mode === 'manager' ? 'Property' : 'Canvass'}</span>
            <h2>{title}</h2>
            <p>{address}</p>
            <div className="house-title-meta">
              <div className="house-status-pill" style={{ background: statusMeta.color }}>{statusMeta.label}</div>
              {assignedName && <span className="house-visit-pill">{assignedName}</span>}
              {history.length > 0 && <span className="house-visit-pill">{history.length} visit{history.length === 1 ? '' : 's'}</span>}
            </div>
          </div>
          <button type="button" className="icon-btn light" onClick={onClose} aria-label="Close property"><X /></button>
        </div>

        <div className="field-house-actions canvass-quick-links">
          {form.phone && <a href={`tel:${form.phone}`}><Phone size={15} />Call</a>}
          {form.phone && <a href={`sms:${form.phone}`}><MessageCircle size={15} />Text</a>}
          {mapsUrl && <a target="_blank" rel="noreferrer" href={mapsUrl}><Navigation size={15} />Navigate</a>}
          {manual && <button type="button" onClick={onLocation}><Crosshair size={15} />Pin GPS</button>}
          <button type="button" className="house-pitch-btn" onClick={onPitch}><Presentation size={15} />Present</button>
          <button type="button" className="house-quote-btn" onClick={onQuote}><Target size={15} />Quote</button>
          <button type="button" onClick={onAccount}><UserRound size={15} />Account</button>
        </div>

        {!manual && (
          <>
            <div className="field-quick-label">
              <span>Disposition</span>
              <small>Tap a result. You do not need to fill the form to mark this door.</small>
            </div>
            <div className="house-quick-grid field-quick-grid canvass-knock-grid">
              {CANVASS_KNOCK_KEYS.map((status) => {
                const meta = doorStatus(status);
                return (
                  <button
                    type="button"
                    key={status}
                    disabled={saving || (protectedDNK && status !== 'do_not_knock')}
                    className={form.status === status ? 'active' : ''}
                    style={{ '--status-color': meta.color } as React.CSSProperties}
                    onClick={() => void onKnock(status)}
                  >
                    <strong>{meta.label}</strong>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {form.status === 'appointment_set' && (
          <div className="field-book-now">
            <label><span>Appointment time</span><input type="datetime-local" value={form.appointment_at} onChange={(e) => setForm((p: FormShape) => ({ ...p, appointment_at: e.target.value }))} /></label>
            <p>Set the window, then Save. Dispatch receives this stop unassigned.</p>
          </div>
        )}
        {(form.status === 'follow_up' || form.status === 'revisit') && NEEDS_TIME_KEYS.has(form.status) && (
          <div className="field-book-now">
            <label><span>Follow-up</span><input type="datetime-local" value={form.follow_up_at} onChange={(e) => setForm((p: FormShape) => ({ ...p, follow_up_at: e.target.value }))} /></label>
          </div>
        )}

        {protectedDNK && <div className="dnk-warning">Do Not Knock. A manager must clear this property before it can be canvassed again.</div>}

        <div className="field-save-bar">
          {manual
            ? <button type="submit" className="btn-primary field-save-next" disabled={saving || protectedDNK}>{saving ? 'Saving…' : 'Save lead'}</button>
            : <>
              <button type="button" className="btn-primary field-save-next" disabled={saving || protectedDNK} onClick={() => void onSaveNext()}>{saving ? 'Saving…' : 'Save & Next Best House'}</button>
              <button type="submit" className="btn-outline" disabled={saving || protectedDNK}>Save</button>
            </>}
        </div>

        <button type="button" className={`canvass-details-toggle ${detailsOpen ? 'open' : ''}`} onClick={() => setDetails((v) => !v)}>
          <span>Add Details</span>
          <small>Name, contact, vehicle, notes, appointment</small>
          <ChevronDown size={16} />
        </button>

        {detailsOpen && (
          <div className="canvass-details">
            <div className="field-contact-strip sr-lead-sheet">
              <label><span>First name</span><input autoComplete="given-name" placeholder="First" value={form.first_name} onChange={(e) => setField({ first_name: e.target.value, customer_name: composedLeadIdentity({ ...form, first_name: e.target.value }, form.customer_name).name })} /></label>
              <label><span>Last name</span><input autoComplete="family-name" placeholder="Last" value={form.last_name} onChange={(e) => setField({ last_name: e.target.value, customer_name: composedLeadIdentity({ ...form, last_name: e.target.value }, form.customer_name).name })} /></label>
              <label><span>Phone</span><input autoComplete="tel" type="tel" inputMode="tel" placeholder={MARKET.phonePlaceholder} value={form.phone} onChange={(e) => setField({ phone: e.target.value })} /></label>
              <label><span>Alt phone</span><input type="tel" inputMode="tel" placeholder="Optional" value={form.alt_phone} onChange={(e) => setField({ alt_phone: e.target.value })} /></label>
              <label className="wide"><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={(e) => setField({ email: e.target.value })} /></label>
              <label className="wide"><span>Street 1</span><input autoComplete="address-line1" placeholder="210 Forest Pines Dr" value={form.street1} onChange={(e) => setField({ street1: e.target.value, address: composedLeadIdentity({ ...form, street1: e.target.value }, '', form.address).address })} /></label>
              <label><span>Street 2</span><input autoComplete="address-line2" placeholder="Apt / unit" value={form.street2} onChange={(e) => setField({ street2: e.target.value })} /></label>
              <label><span>City</span><input autoComplete="address-level2" value={form.city} onChange={(e) => setField({ city: e.target.value })} /></label>
              <label><span>State</span><input autoComplete="address-level1" value={form.state} onChange={(e) => setField({ state: e.target.value })} /></label>
              <label><span>ZIP</span><input autoComplete="postal-code" value={form.postal_code} onChange={(e) => setField({ postal_code: e.target.value })} /></label>
            </div>
            <div className="house-form-grid sr-custom-fields">
              <label><span>Vehicle</span><input value={form.vehicle_info} onChange={(e) => setField({ vehicle_info: e.target.value, vehicle: e.target.value })} /></label>
              <label><span>Service interest</span><ServiceMenuSelect allowEmpty value={form.service_interest} onChange={(name, pkg) => setForm((p: FormShape) => ({ ...p, service_interest: name, service: name, ...(pkg ? { estimated_value: String(pkg.price), value: String(pkg.price) } : {}) }))} /></label>
              <label><span>Estimated value</span><input type="number" min="0" value={form.estimated_value} onChange={(e) => setField({ estimated_value: e.target.value, value: e.target.value })} /></label>
              <label><span>Follow-up</span><input type="datetime-local" value={form.follow_up_at} onChange={(e) => setField({ follow_up_at: e.target.value })} /></label>
              <label><span>Appointment</span><input type="datetime-local" value={form.appointment_at} onChange={(e) => setField({ appointment_at: e.target.value })} /></label>
              <label><span>Lead source</span>
                <select value={form.lead_source || 'd2d'} onChange={(e) => setField({ lead_source: e.target.value })}>
                  <option value="d2d">Door to door</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="repeat">Existing customer</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="wide"><span>Notes</span><textarea value={form.notes} onChange={(e) => setField({ notes: e.target.value })} /></label>
            </div>
            <div className="house-drawer-actions">
              <button type="button" className="btn-outline" onClick={onEstimate}>Create Estimate</button>
              {form.status === 'appointment_set' && form.appointment_at && <span className="field-inline-note">Saving will create the appointment.</span>}
            </div>
          </div>
        )}

        <button type="button" className={`canvass-details-toggle ${historyOpen ? 'open' : ''}`} onClick={() => setHistoryOpen((v) => !v)}>
          <History size={15} />
          <span>Activity history</span>
          <ChevronDown size={16} />
        </button>
        {historyOpen && (
          <div className="house-history-list canvass-history">
            {history.map((h) => (
              <div key={h.id}>
                <i style={{ background: doorStatus(h.new_status).color }} />
                <div>
                  <strong>{doorStatus(h.new_status).label}</strong>
                  <span>{localDateTime(h.created_at)}</span>
                  <p>{h.notes || 'Status updated'}</p>
                </div>
              </div>
            ))}
            {!history.length && <div className="ns-empty compact">No previous activity at this house.</div>}
          </div>
        )}
      </form>
    </div>
  );
}