import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Archive, ArchiveRestore, CalendarPlus, ExternalLink, Eye, Plus, Search, Target, XCircle,
} from 'lucide-react';
import { supabase, type Appointment, type Employee, type Lead, type TerritoryDoor } from '@/lib/supabase';
import { money } from '@/lib/data';
import { notifyCustomer } from '@/lib/communications';
import { ServiceMenuSelect } from '@/components/DetailSelfPicker';
import { DOOR_STATUSES, doorStatus } from '@/lib/fieldOps';
import {
  composedLeadIdentity, emptySrLeadFields, fieldsFromLead, leadDisplayName, leadNextAction, notesWithAltPhone, SR_KNOCK_KEYS, SR_PIPELINE_KEYS, srStatus,
  type SrLeadFields, type SrStatusKey,
} from '@/lib/salesRabbitLeads';
import { osmDirectionsUrl, osmPropertyUrl } from '@/lib/osmGeocode';
import { leadAssignableEmployees, leadRepLabel, selfEmployeeForUser } from '@/lib/workCapabilities';
import { ensureOwnerFieldEmployee } from '@/lib/ownerFieldMode';
import { useAuth } from '@/hooks/useAuth';
import { minutesForService } from '@/lib/detailCatalog';
import { planAppointmentTiming } from '@/lib/scheduling';
import WorkspaceHero from '@/components/WorkspaceHero';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';

type View = 'pipeline' | 'map' | 'list' | 'archive';
type Attention = 'all' | 'due' | 'unassigned' | 'hot' | 'dupes';
type Props = {
  employees: Employee[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onNavigate?: (view: string) => void;
};

const PIPELINE_KEYS: SrStatusKey[] = (() => {
  const keys = [...SR_PIPELINE_KEYS];
  if (!keys.includes('contacted')) {
    const i = keys.indexOf('unworked');
    keys.splice(i >= 0 ? i + 1 : 1, 0, 'contacted');
  }
  return keys;
})();
const STAGES = PIPELINE_KEYS.map((key) => ({
  key,
  label: srStatus(key).name,
  statuses: key === 'unworked' ? ['new', 'unworked'] : [key],
})) as Array<{ key: string; label: string; statuses: readonly string[] }>;

const CLOSED = new Set(['sold', 'lost', 'not_interested', 'do_not_knock', 'existing_customer']);
const COMPOSE_KEY = 'ns-compose-lead';
const emptyDraft = (): SrLeadFields & { assigned_employee_id: string } => ({
  ...emptySrLeadFields(),
  service: 'Luxe Signature',
  value: '275',
  assigned_employee_id: '',
});

function persistFromFields(fields: SrLeadFields, extra: Record<string, unknown> = {}) {
  const identity = composedLeadIdentity(fields);
  return {
    customer_name: identity.name || null,
    phone: fields.phone.trim() || null,
    email: fields.email.trim() || null,
    address: identity.address || null,
    city: fields.city.trim() || null,
    state: fields.state.trim() || null,
    postal_code: fields.postal_code.trim() || null,
    service_interest: fields.service.trim() || null,
    vehicle_info: fields.vehicle.trim() || null,
    estimated_value: Number(fields.value || 0),
    notes: notesWithAltPhone(fields.notes, fields.alt_phone) || null,
    follow_up_at: fields.follow_up_at ? new Date(fields.follow_up_at).toISOString() : null,
    ...extra,
  };
}

const humanStatus = (s?: string | null) => {
  const pin = srStatus(s);
  return `${pin.abbr} · ${pin.name}`;
};
const when = (v?: string | null) => v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
function toLocalInput(value?: string | Date | null) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (!d || Number.isNaN(+d)) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function leadScore(l: Lead) {
  if (Number(l.lead_score || 0) > 0) return Number(l.lead_score);
  return Math.min(100,
    20
    + (l.phone ? 15 : 0)
    + (l.email ? 10 : 0)
    + (l.service_interest ? 10 : 0)
    + (Number(l.estimated_value || 0) >= 300 ? 15 : 0)
    + (['interested', 'estimate', 'estimate_sent', 'appointment_set'].includes(l.status) ? 25 : 0)
    + (l.follow_up_at && new Date(l.follow_up_at) <= new Date() ? 10 : 0),
  );
}

function isHot(l: Lead) {
  return String(l.lead_temperature || '').toLowerCase() === 'hot' || leadScore(l) >= 70;
}

function isArchived(l: Lead, now: Date) {
  return Boolean(l.archived_at || (l.cooldown_until && new Date(l.cooldown_until) > now) || l.status === 'do_not_knock');
}

function dupeKey(l: Lead) {
  const phone = String(l.phone || '').replace(/\D/g, '');
  const address = String(l.address || '').trim().toLowerCase();
  if (phone.length >= 7) return `p:${phone}`;
  if (address) return `a:${address}`;
  return '';
}

function assignedName(reps: Employee[], id?: string | null) {
  const rep = reps.find((r) => r.id === id);
  return rep ? leadRepLabel(rep) : 'Unassigned';
}

export default function OwnerLeadPipeline({ employees, setAppointments, onNavigate }: Props) {
  const { user, profile } = useAuth();
  const [claimedSelf, setClaimedSelf] = useState<Employee | null>(null);
  const [claimingSelf, setClaimingSelf] = useState(false);
  const linkedSelf = selfEmployeeForUser(employees, user?.id, user?.email || profile?.email);
  const self = claimedSelf || linkedSelf;
  const reps = useMemo(() => {
    const list = leadAssignableEmployees(employees);
    if (self && !list.some((rep) => rep.id === self.id)) return [self, ...list];
    return list;
  }, [employees, self]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [doors, setDoors] = useState<TerritoryDoor[]>([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [repFilter, setRepFilter] = useState('all');
  const [attention, setAttention] = useState<Attention>('all');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [view, setView] = useState<View>(() => window.matchMedia?.('(max-width: 620px)').matches ? 'list' : 'pipeline');
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [dropStage, setDropStage] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const now = new Date();

  const loadLeads = async () => {
    const { data, error } = await supabase.from('leads').select('*').order('updated_at', { ascending: false }).limit(2000);
    if (error) { setLoadError(error.message); setLeads([]); }
    else { setLoadError(''); setLeads((data ?? []) as Lead[]); }
    setBusy(false);
  };

  useEffect(() => { loadLeads(); }, []);
  useEffect(() => {
    supabase.from('territory_doors').select('*').limit(8000).then(({ data }) => setDoors((data ?? []) as TerritoryDoor[]));
  }, []);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(COMPOSE_KEY) === '1') {
        sessionStorage.removeItem(COMPOSE_KEY);
        setCompose(true);
      }
    } catch { /* private mode */ }
  }, []);

  const archivedLeads = leads.filter((l) => isArchived(l, now));
  const activeLeads = leads.filter((l) => !isArchived(l, now));
  const baseLeads = view === 'archive' ? archivedLeads : activeLeads;
  const dupeKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) {
      const k = dupeKey(l);
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [leads]);

  const overdue = activeLeads.filter((l) => l.follow_up_at && new Date(l.follow_up_at) <= now && !CLOSED.has(l.status));
  const unassigned = activeLeads.filter((l) => !l.assigned_employee_id && !CLOSED.has(l.status));
  const hot = activeLeads.filter((l) => isHot(l) && !CLOSED.has(l.status));
  const dupes = activeLeads.filter((l) => dupeKeys.has(dupeKey(l)));
  const openCount = activeLeads.filter((l) => !CLOSED.has(l.status)).length;
  const pipelineValue = activeLeads.filter((l) => !CLOSED.has(l.status)).reduce((n, l) => n + Number(l.estimated_value || 0), 0);
  const won = leads.filter((l) => ['sold', 'existing_customer'].includes(l.status)).reduce((s, l) => s + Number(l.actual_sale_amount || l.estimated_value || 0), 0);

  const filtered = baseLeads.filter((l) => {
    if (status !== 'all' && l.status !== status && !(status === 'unworked' && ['new', 'unworked'].includes(l.status))) return false;
    if (repFilter !== 'all' && l.assigned_employee_id !== repFilter) return false;
    if (attention === 'due' && !(l.follow_up_at && new Date(l.follow_up_at) <= now && !CLOSED.has(l.status))) return false;
    if (attention === 'unassigned' && (l.assigned_employee_id || CLOSED.has(l.status))) return false;
    if (attention === 'hot' && !(isHot(l) && !CLOSED.has(l.status))) return false;
    if (attention === 'dupes' && !dupeKeys.has(dupeKey(l))) return false;
    if (query && ![l.customer_name, l.address, l.city, l.phone, l.email, l.service_interest, l.notes].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const patchLead = async (l: Lead, patch: Record<string, unknown>, activity?: { type: string; notes?: string; previous?: string; next?: string }) => {
    const { data, error } = await supabase.from('leads').update(patch).eq('id', l.id).select().single();
    if (error) return alert(error.message);
    if (activity) {
      await supabase.from('lead_activities').insert({
        lead_id: l.id,
        employee_id: l.assigned_employee_id,
        activity_type: activity.type,
        previous_status: activity.previous ?? l.status,
        new_status: activity.next ?? String(patch.status || l.status),
        notes: activity.notes || null,
      });
    }
    setLeads((p) => p.map((x) => x.id === l.id ? data : x));
    setSelected(data);
    return data as Lead;
  };

  const updateStatus = (l: Lead, newStatus: string) => patchLead(
    l,
    { status: newStatus, last_contacted_at: new Date().toISOString() },
    { type: 'status_change', previous: l.status, next: newStatus },
  );

  const archiveLead = async (l: Lead, reason = 'manager_archive') => {
    if (!confirm(`Archive ${l.customer_name || l.address || 'this lead'} for 6 months?`)) return;
    const cooldown = new Date();
    cooldown.setMonth(cooldown.getMonth() + 6);
    await patchLead(l, {
      archived_at: new Date().toISOString(),
      archive_reason: reason,
      cooldown_until: cooldown.toISOString(),
      reactivation_status: 'cooldown',
    }, { type: 'archived', notes: `Archived until ${cooldown.toLocaleDateString()}` });
  };

  const restoreLead = async (l: Lead) => {
    if (l.status === 'do_not_knock' && !confirm('This lead is permanently Do Not Knock. Reactivate anyway?')) return;
    await patchLead(l, {
      archived_at: null,
      archive_reason: null,
      cooldown_until: null,
      reactivation_status: 'reactivated',
      reactivated_at: new Date().toISOString(),
    }, { type: 'reactivated', notes: 'Lead reactivated by owner' });
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const identity = composedLeadIdentity(draft);
    if (!identity.name && !identity.address && !draft.phone.trim()) {
      return alert('Add a name, address, or phone.');
    }
    setSaving(true);
    const payload = persistFromFields(draft, {
      assigned_employee_id: draft.assigned_employee_id || null,
      status: 'unworked',
      source: 'owner',
      lead_temperature: 'warm',
    });
    const { data, error } = await supabase.from('leads').insert(payload).select().single();
    setSaving(false);
    if (error) return alert(error.message);
    await supabase.from('lead_activities').insert({ lead_id: data.id, employee_id: data.assigned_employee_id, activity_type: 'created', new_status: 'unworked', notes: 'Owner logged this lead' });
    setLeads((p) => [data as Lead, ...p]);
    setSelected(data as Lead);
    setDraft(emptyDraft());
    setCompose(false);
    setView('pipeline');
  };

  const dropOnStage = async (stage: string, leadId: string) => {
    setDropStage('');
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === stage) return;
    await updateStatus(lead, stage);
  };

  const claimSelf = async () => {
    if (self) return self;
    if (!user) {
      alert('Sign in to assign this lead to yourself.');
      return null;
    }
    setClaimingSelf(true);
    try {
      const field = await ensureOwnerFieldEmployee(
        user.id,
        profile?.full_name || user.email?.split('@')[0] || 'Owner',
        user.email || profile?.email,
      );
      if (!field) {
        alert('Could not create an owner field profile to assign this lead to.');
        return null;
      }
      setClaimedSelf(field);
      return field;
    } finally {
      setClaimingSelf(false);
    }
  };

  return (
    <div className="tab-content phase300 v2-page owner-leads-v39">
      <WorkspaceHero
        tab="leads"
        actions={(
          <div className="owner-leads-head-actions">
            <button type="button" className="btn-primary" onClick={() => setCompose((v) => !v)}>
              <Plus size={15} />{compose ? 'Close form' : 'New Lead'}
            </button>
            <div className="segmented-control">
              {(['pipeline', 'map', 'list', 'archive'] as View[]).map((id) => (
                <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)}>{id[0].toUpperCase() + id.slice(1)}</button>
              ))}
            </div>
          </div>
        )}
      />

      {compose && (
        <form className="phase-panel owner-lead-compose" onSubmit={createLead}>
          <div className="phase-panel-head">
            <div><span className="eyebrow">NEW LEAD</span><h3>Log a household</h3></div>
          </div>
          <div className="owner-lead-compose-grid sr-lead-sheet">
            <label>First name<input value={draft.first_name} onChange={(e) => setDraft((p) => ({ ...p, first_name: e.target.value }))} placeholder="First" autoComplete="given-name" /></label>
            <label>Last name<input value={draft.last_name} onChange={(e) => setDraft((p) => ({ ...p, last_name: e.target.value }))} placeholder="Last" autoComplete="family-name" /></label>
            <label>Phone<input value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="919-555-0100" inputMode="tel" autoComplete="tel" /></label>
            <label>Alt phone<input value={draft.alt_phone} onChange={(e) => setDraft((p) => ({ ...p, alt_phone: e.target.value }))} placeholder="Optional" inputMode="tel" /></label>
            <label className="wide">Email<input value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} placeholder="name@email.com" autoComplete="email" /></label>
            <label className="wide">Street 1<input value={draft.street1} onChange={(e) => setDraft((p) => ({ ...p, street1: e.target.value }))} placeholder="210 Forest Pines Dr" autoComplete="address-line1" /></label>
            <label>Street 2<input value={draft.street2} onChange={(e) => setDraft((p) => ({ ...p, street2: e.target.value }))} placeholder="Apt / unit" autoComplete="address-line2" /></label>
            <label>City<input value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} autoComplete="address-level2" /></label>
            <label>State<input value={draft.state} onChange={(e) => setDraft((p) => ({ ...p, state: e.target.value }))} autoComplete="address-level1" /></label>
            <label>ZIP<input value={draft.postal_code} onChange={(e) => setDraft((p) => ({ ...p, postal_code: e.target.value }))} autoComplete="postal-code" /></label>
            <label>Service<ServiceMenuSelect value={draft.service} onChange={(name, pkg) => setDraft((p) => ({ ...p, service: name, value: String(pkg?.price || p.value) }))} /></label>
            <label>Value<input type="number" min="0" value={draft.value} onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))} /></label>
            <label className="wide">Rep
              <AssignRepControls
                value={draft.assigned_employee_id}
                reps={reps}
                selfId={self?.id}
                claiming={claimingSelf}
                onChange={(id) => setDraft((p) => ({ ...p, assigned_employee_id: id }))}
                onAssignToMe={async () => {
                  const me = await claimSelf();
                  if (me) setDraft((p) => ({ ...p, assigned_employee_id: me.id }));
                }}
              />
            </label>
            <label className="wide">Notes<textarea value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="How they found us, vehicle, gate code" rows={3} /></label>
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add to pipeline'}</button>
        </form>
      )}

      <div className="nsos-alerts owner-lead-exceptions" id="lead-exceptions">
        {overdue.length > 0 && (
          <button type="button" className={`nsos-alert hot ${attention === 'due' ? 'selected' : ''}`} onClick={() => setAttention((v) => v === 'due' ? 'all' : 'due')}>
            <em>{overdue.length}</em><span><b>Follow-ups due</b><small>Call or knock before they cool</small></span>
          </button>
        )}
        {unassigned.length > 0 && (
          <button type="button" className={`nsos-alert hot ${attention === 'unassigned' ? 'selected' : ''}`} onClick={() => setAttention((v) => v === 'unassigned' ? 'all' : 'unassigned')}>
            <em>{unassigned.length}</em><span><b>Unassigned</b><small>Need a rep on the door</small></span>
          </button>
        )}
        {hot.length > 0 && (
          <button type="button" className={`nsos-alert ${attention === 'hot' ? 'selected' : ''}`} onClick={() => setAttention((v) => v === 'hot' ? 'all' : 'hot')}>
            <em>{hot.length}</em><span><b>Hot leads</b><small>Ready to quote or book</small></span>
          </button>
        )}
        {dupes.length > 0 && (
          <button type="button" className={`nsos-alert ${attention === 'dupes' ? 'selected' : ''}`} onClick={() => setAttention((v) => v === 'dupes' ? 'all' : 'dupes')}>
            <em>{dupes.length}</em><span><b>Possible duplicates</b><small>Same phone or address</small></span>
          </button>
        )}
        {!overdue.length && !unassigned.length && !hot.length && !dupes.length && view !== 'archive' && (
          <div className="ns-empty">Nothing needs you in the pipeline. Log a door or wait on the next knock.</div>
        )}
      </div>

      <div className="phase-kpi-row">
        <div className="phase-kpi"><span>Open leads</span><strong>{openCount}</strong><small>{filtered.length} in this view</small></div>
        <div className="phase-kpi"><span>Hot</span><strong>{hot.length}</strong></div>
        <div className="phase-kpi"><span>Pipeline value</span><strong>{money(pipelineValue)}</strong></div>
        <div className="phase-kpi"><span>Won</span><strong>{money(won)}</strong></div>
        <div className="phase-kpi"><span>Follow-ups due</span><strong>{overdue.length}</strong></div>
      </div>

      <div className="lead-command-bar">
        <div className="search-control search-box"><Search size={16} /><input placeholder="Search name, address, phone or service" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
          <option value="all">All reps</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{leadRepLabel(r)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STAGES.map((s) => <option value={s.key} key={s.key}>{s.label}</option>)}
          {DOOR_STATUSES.filter((s) => !STAGES.some((st) => st.statuses.includes(s.key as never))).map((s) => <option value={s.key} key={s.key}>{s.label}</option>)}
        </select>
      </div>

      {busy && <div className="ns-empty">Loading live pipeline…</div>}
      {loadError && (
        <div className="ns-empty">
          Could not load leads. {loadError}
          <button type="button" className="btn-outline" onClick={() => { setBusy(true); loadLeads(); }}>Retry</button>
        </div>
      )}
      {!busy && !loadError && !filtered.length && (
        <div className="ns-empty">
          <Target size={28} />
          <h3>{query || attention !== 'all' || status !== 'all' ? 'No leads match these filters' : 'No leads yet'}</h3>
          <p>{query || attention !== 'all' ? 'Clear search or exceptions to see the rest of the board.' : 'Add a household from New Lead. D2D knocks also land here.'}</p>
          {(query || attention !== 'all' || status !== 'all') && (
            <button type="button" className="btn-outline" onClick={() => { setQuery(''); setAttention('all'); setStatus('all'); setRepFilter('all'); }}>Clear filters</button>
          )}
        </div>
      )}

      {view === 'map' && (
        <div className="lead-command-layout v2-lead-map-layout">
          <div className="lead-map-card">
            <FieldTerritoryMap
                territories={[]}
                leads={filtered}
                doors={doors}
                onDoorClick={(d) => {
                  const l = leads.find((x) => x.id === d.lead_id);
                  if (l) setSelected(l);
                }}
                className="lead-command-map"
              />
            <div className="lead-map-legend">{DOOR_STATUSES.slice(0, 12).map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.short} {s.label}</span>)}</div>
          </div>
          <LeadInspector
            selected={selected}
            reps={reps}
            selfId={self?.id}
            claiming={claimingSelf}
            onAssignToMe={claimSelf}
            setAppointments={setAppointments}
            onNavigate={onNavigate}
            updateStatus={updateStatus}
            patchLead={patchLead}
            archiveLead={archiveLead}
            restoreLead={restoreLead}
            clear={() => setSelected(null)}
          />
        </div>
      )}

      {view === 'pipeline' && !busy && filtered.length > 0 && (
        <div className="admin-lead-kanban">
          {STAGES.map((stage) => {
            const rows = filtered.filter((l) => (stage.statuses as readonly string[]).includes(l.status)).sort((a, b) => leadScore(b) - leadScore(a));
            const shown = expanded[stage.key] ? rows : rows.slice(0, 40);
            return (
              <section
                key={stage.key}
                className={dropStage === stage.key ? 'drop-ready' : ''}
                onDragOver={(e) => { e.preventDefault(); setDropStage(stage.key); }}
                onDragLeave={() => setDropStage((v) => v === stage.key ? '' : v)}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOnStage(stage.key, e.dataTransfer.getData('lead'));
                }}
              >
                <header><span>{stage.label}</span><strong>{rows.length}</strong></header>
                <div>
                  {shown.map((l) => {
                    const next = leadNextAction(l);
                    return (
                    <button
                      key={l.id}
                      type="button"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('lead', l.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onClick={() => setSelected(l)}
                      className={selected?.id === l.id ? 'selected' : ''}
                    >
                      <div>
                        <i style={{ background: doorStatus(l.status).color }} />
                        <span className={isHot(l) ? 'lead-score hot' : 'lead-score'}>{leadScore(l)}</span>
                      </div>
                      <strong>{leadDisplayName(l)}</strong>
                      <small>{l.address || 'No address'}</small>
                      <p>{assignedName(reps, l.assigned_employee_id)}</p>
                      <footer>
                        <span className={next.overdue ? 'overdue-text' : ''}>{next.text}</span>
                        <b>{money(Number(l.estimated_value || 0))}</b>
                      </footer>
                    </button>
                    );
                  })}
                  {!rows.length && <div className="lead-column-empty">Drop a card here, or add a lead.</div>}
                  {rows.length > shown.length && (
                    <button type="button" className="btn-outline btn-sm" onClick={() => setExpanded((p) => ({ ...p, [stage.key]: true }))}>
                      Show {rows.length - shown.length} more
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'list' && !busy && filtered.length > 0 && (
        <div className="lead-command-table v2-admin-lead-list">
          <div className="lead-command-head"><span>Lead</span><span>Rep</span><span>Score</span><span>Status</span><span>Value</span><span>Follow-up</span></div>
          {filtered.sort((a, b) => leadScore(b) - leadScore(a)).map((l) => (
            <button className="lead-command-row" type="button" key={l.id} onClick={() => setSelected(l)}>
              <span><strong>{leadDisplayName(l)}</strong><small>{l.address || 'No address'} · {l.service_interest || 'No service selected'}</small></span>
              <span>{assignedName(reps, l.assigned_employee_id)}</span>
              <span><b className={isHot(l) ? 'lead-score hot' : 'lead-score'}>{leadScore(l)}</b></span>
              <span><b className="status-lozenge">{humanStatus(l.status)}</b></span>
              <span>{money(Number(l.actual_sale_amount || l.estimated_value || 0))}</span>
              <span>{when(l.follow_up_at)}</span>
            </button>
          ))}
        </div>
      )}

      {view === 'archive' && !busy && (
        <div className="lead-archive-grid">
          {filtered.map((l) => (
            <button className="archive-lead-card" type="button" key={l.id} onClick={() => setSelected(l)}>
              <div><Archive size={17} /><strong>{leadDisplayName(l, 'Archived door')}</strong></div>
              <small>{l.address || 'No address'}</small>
              <div className="archive-meta">
                <span>{humanStatus(l.status)}</span>
                <span>{l.cooldown_until ? `Eligible ${new Date(l.cooldown_until).toLocaleDateString()}` : l.status === 'do_not_knock' ? 'Permanent DNK' : 'Archived'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {view !== 'map' && selected && (
        <div className="admin-lead-drawer">
          <LeadInspector
            selected={selected}
            reps={reps}
            selfId={self?.id}
            claiming={claimingSelf}
            onAssignToMe={claimSelf}
            setAppointments={setAppointments}
            onNavigate={onNavigate}
            updateStatus={updateStatus}
            patchLead={patchLead}
            archiveLead={archiveLead}
            restoreLead={restoreLead}
            clear={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

function LeadInspector({
  selected, reps, selfId, claiming, onAssignToMe, setAppointments, onNavigate, updateStatus, patchLead, archiveLead, restoreLead, clear,
}: {
  selected: Lead | null;
  reps: Employee[];
  selfId?: string;
  claiming?: boolean;
  onAssignToMe: () => Promise<Employee | null>;
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onNavigate?: (view: string) => void;
  updateStatus: (l: Lead, s: string) => void;
  patchLead: (l: Lead, patch: Record<string, unknown>, activity?: { type: string; notes?: string; previous?: string; next?: string }) => Promise<Lead | void>;
  archiveLead: (l: Lead, reason?: string) => void;
  restoreLead: (l: Lead) => void;
  clear: () => void;
}) {
  const [fields, setFields] = useState(emptySrLeadFields);
  const [bookAt, setBookAt] = useState('');
  const [booking, setBooking] = useState(false);
  const setField = (patch: Partial<SrLeadFields>) => setFields((p) => ({ ...p, ...patch }));

  useEffect(() => {
    if (!selected) return;
    setFields({
      ...fieldsFromLead(selected),
      follow_up_at: toLocalInput(selected.follow_up_at),
    });
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(10, 0, 0, 0);
    setBookAt(toLocalInput(next));
  }, [selected?.id]);

  if (!selected) {
    return (
      <aside className="lead-inspector phase-panel caramel">
        <div className="empty-inspector"><Target size={32} /><h3>Select a lead or house</h3><p>Inspect details, assign a rep, and book the job from here.</p></div>
      </aside>
    );
  }

  const pin = srStatus(selected.status);
  const archived = Boolean(selected.archived_at || selected.cooldown_until || selected.status === 'do_not_knock');
  const mapUrl = osmPropertyUrl({ lat: selected.latitude, lng: selected.longitude, query: selected.address });
  const directionsUrl = osmDirectionsUrl({ lat: selected.latitude, lng: selected.longitude, query: selected.address });
  const overdue = Boolean(selected.follow_up_at && new Date(selected.follow_up_at) <= new Date());
  const identity = composedLeadIdentity(fields, selected.customer_name || '', selected.address || '');

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await patchLead(selected, persistFromFields(fields), { type: 'updated', notes: 'Owner updated lead details' });
  };

  const bookJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookAt) return alert('Pick a date and time.');
    setBooking(true);
    try {
      const service = fields.service || selected.service_interest || 'Detailing Service';
      const duration = minutesForService(service, 120);
      const requested = new Date(bookAt);
      const dayStart = new Date(requested); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const { data: dayJobs } = await supabase.from('appointments').select('*').gte('scheduled_at', dayStart.toISOString()).lt('scheduled_at', dayEnd.toISOString());
      const plan = await planAppointmentTiming({
        appointments: (dayJobs || []) as Appointment[],
        durationMinutes: duration,
        destination: { lat: selected.latitude, lng: selected.longitude, address: identity.address || selected.address },
        requestedStart: requested,
        shopLane: true,
      });
      if (plan.previous) await supabase.from('appointments').update({ travel_buffer_minutes: plan.inboundMinutes }).eq('id', plan.previous.id);
      const { data, error } = await supabase.from('appointments').insert({
        customer_name: identity.name || selected.customer_name,
        customer_email: fields.email || selected.email,
        customer_phone: fields.phone || selected.phone,
        service_name: service,
        package_name: fields.service || selected.service_interest || null,
        add_ons: [],
        vehicle_info: fields.vehicle || selected.vehicle_info || '',
        scheduled_at: plan.start.toISOString(),
        estimated_duration_minutes: duration,
        travel_buffer_minutes: plan.travelBufferMinutes,
        status: 'scheduled',
        price: Number(fields.value || selected.estimated_value || 0),
        notes: notesWithAltPhone(fields.notes, fields.alt_phone) || selected.notes || '',
        service_address: identity.address || selected.address,
        latitude: selected.latitude,
        longitude: selected.longitude,
        sales_rep_employee_id: selected.assigned_employee_id,
        lead_id: selected.id,
        source_channel: 'owner',
        dispatch_status: 'unassigned',
        field_status: 'scheduled',
      }).select().single();
      if (error) {
        alert(error.message);
        return;
      }
      if (plan.snapped) setBookAt(toLocalInput(plan.start));
      setAppointments?.((p) => [...p, data as Appointment].sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()));
      await patchLead(selected, { status: 'appointment_set', appointment_id: data.id }, { type: 'status_change', previous: selected.status, next: 'appointment_set', notes: 'Booked from owner pipeline' });
      void notifyCustomer('booking_received', data as Appointment);
      onNavigate?.('appointments');
    } catch {
      alert('Unable to book this job. Try another window.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <aside className="lead-inspector phase-panel caramel">
      <div className="phase-panel-head">
        <div><span className="eyebrow">LEAD DETAILS</span><h3>{identity.address || identity.name || 'Lead'}</h3></div>
        <button className="icon-btn" type="button" onClick={clear}><XCircle size={18} /></button>
      </div>
      <div className="lead-inspector-status">
        <span style={{ color: pin.color }}>{pin.abbr} · {pin.name}</span>
        <strong>{money(Number(selected.actual_sale_amount || selected.estimated_value || 0))}</strong>
      </div>
      <div className="lead-health-row">
        <span className={isHot(selected) ? 'lead-score hot' : 'lead-score'}>Lead Score {leadScore(selected)}</span>
        {overdue && <span className="overdue-pill">Follow-up overdue</span>}
        {archived && <span className="archive-pill">Archived / protected</span>}
      </div>
      {mapUrl && (
        <div className="property-preview-card">
          <div><Eye size={17} /><div><strong>Property Preview</strong><small>Open the street map to confirm the property before contact.</small></div></div>
          <a href={mapUrl} target="_blank" rel="noreferrer">Open map <ExternalLink size={14} /></a>
        </div>
      )}
      <form className="owner-lead-edit sr-lead-sheet" onSubmit={saveDetails}>
        <label>First name<input value={fields.first_name} onChange={(e) => setField({ first_name: e.target.value })} autoComplete="given-name" /></label>
        <label>Last name<input value={fields.last_name} onChange={(e) => setField({ last_name: e.target.value })} autoComplete="family-name" /></label>
        <label>Phone<input value={fields.phone} onChange={(e) => setField({ phone: e.target.value })} inputMode="tel" autoComplete="tel" /></label>
        <label>Alt phone<input value={fields.alt_phone} onChange={(e) => setField({ alt_phone: e.target.value })} inputMode="tel" /></label>
        <label className="wide">Email<input value={fields.email} onChange={(e) => setField({ email: e.target.value })} autoComplete="email" /></label>
        <label className="wide">Street 1<input value={fields.street1} onChange={(e) => setField({ street1: e.target.value })} autoComplete="address-line1" /></label>
        <label>Street 2<input value={fields.street2} onChange={(e) => setField({ street2: e.target.value })} autoComplete="address-line2" /></label>
        <label>City<input value={fields.city} onChange={(e) => setField({ city: e.target.value })} autoComplete="address-level2" /></label>
        <label>State<input value={fields.state} onChange={(e) => setField({ state: e.target.value })} autoComplete="address-level1" /></label>
        <label>ZIP<input value={fields.postal_code} onChange={(e) => setField({ postal_code: e.target.value })} autoComplete="postal-code" /></label>
        <label>Service<input value={fields.service} onChange={(e) => setField({ service: e.target.value })} /></label>
        <label>Value<input type="number" min="0" value={fields.value} onChange={(e) => setField({ value: e.target.value })} /></label>
        <label>Follow-up<input type="datetime-local" value={fields.follow_up_at} onChange={(e) => setField({ follow_up_at: e.target.value })} /></label>
        <label>Vehicle<input value={fields.vehicle} onChange={(e) => setField({ vehicle: e.target.value })} placeholder="Year / make / model" /></label>
        <label className="wide">Rep
          <AssignRepControls
            value={selected.assigned_employee_id || ''}
            reps={reps}
            selfId={selfId}
            claiming={claiming}
            onChange={(id) => patchLead(selected, { assigned_employee_id: id || null }, { type: 'assigned', notes: id ? 'Rep assigned' : 'Rep cleared' })}
            onAssignToMe={async () => {
              const me = await onAssignToMe();
              if (me) await patchLead(selected, { assigned_employee_id: me.id }, { type: 'assigned', notes: 'Owner assigned this lead to themselves' });
            }}
          />
        </label>
        <label className="wide">Notes<textarea value={fields.notes} onChange={(e) => setField({ notes: e.target.value })} rows={3} /></label>
        <button className="btn-primary" type="submit">Save details</button>
      </form>
      <div className="lead-direct-actions">
        {fields.phone && <><a href={`tel:${fields.phone}`}>Call</a><a href={`sms:${fields.phone}`}>Text</a></>}
        {mapUrl && <a target="_blank" rel="noreferrer" href={directionsUrl || mapUrl}>Map</a>}
      </div>
      {!archived && (
        <div className="lead-status-actions sr-knock-grid">
          {SR_KNOCK_KEYS.map((key) => {
            const s = srStatus(key);
            return (
              <button type="button" key={key} className={selected.status === key ? 'active' : ''} style={{ '--status-color': s.color } as CSSProperties} onClick={() => updateStatus(selected, key)}>
                <strong>{s.abbr}</strong>
                <small>{s.name}</small>
              </button>
            );
          })}
        </div>
      )}
      {!archived && (
        <form className="owner-lead-book" onSubmit={bookJob}>
          <div className="phase-panel-head"><div><span className="eyebrow">BOOK</span><h3>Put it on the calendar</h3></div></div>
          <label>Window<input type="datetime-local" value={bookAt} onChange={(e) => setBookAt(e.target.value)} required /></label>
          <p className="owner-book-travel">Drive time and traffic set a buffer after the last job, then this snaps to the next open 30-minute slot.</p>
          <button className="btn-primary" disabled={booking}><CalendarPlus size={15} />{booking ? 'Booking…' : 'Book job'}</button>
        </form>
      )}
      <div className="lead-archive-actions">
        {archived
          ? <button className="btn-primary" type="button" onClick={() => restoreLead(selected)}><ArchiveRestore size={15} />Reactivate Lead</button>
          : <button className="btn-outline" type="button" onClick={() => archiveLead(selected)}><Archive size={15} />Archive 6 Months</button>}
      </div>
    </aside>
  );
}

function AssignRepControls({
  value,
  reps,
  selfId,
  claiming,
  onChange,
  onAssignToMe,
}: {
  value: string;
  reps: Employee[];
  selfId?: string;
  claiming?: boolean;
  onChange: (id: string) => void;
  onAssignToMe: () => void | Promise<void>;
}) {
  const mine = Boolean(selfId && value === selfId);
  return (
    <div className="owner-lead-assign">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Unassigned</option>
        {reps.map((r) => <option key={r.id} value={r.id}>{leadRepLabel(r)}</option>)}
      </select>
      <button type="button" className="btn-outline" disabled={Boolean(claiming) || mine} onClick={() => void onAssignToMe()}>
        {mine ? 'Assigned to you' : claiming ? 'Assigning…' : 'Assign to me'}
      </button>
    </div>
  );
}
