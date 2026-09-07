import { useEffect, useMemo, useState } from 'react';
import {
  Archive, ArchiveRestore, CalendarPlus, ExternalLink, Eye, Plus, Search, Target, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { money, prettyLabel } from '@/lib/data';
import { notifyCustomer } from '@/lib/communications';
import { ServiceMenuSelect } from '@/components/DetailSelfPicker';
import { DOOR_STATUSES, doorStatus } from '@/lib/fieldOps';
import { employeeCanD2D } from '@/lib/workCapabilities';
import type { Appointment, Employee, Lead, TerritoryDoor } from '@/lib/supabase';
import WorkspaceHero from '@/components/WorkspaceHero';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';

type View = 'pipeline' | 'map' | 'list' | 'archive';
type Attention = 'all' | 'due' | 'unassigned' | 'hot' | 'dupes';
type Props = {
  employees: Employee[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onNavigate?: (view: string) => void;
};

const STAGES = [
  { key: 'unworked', label: 'New', statuses: ['new', 'unworked'] },
  { key: 'contacted', label: 'Contacted', statuses: ['contacted', 'no_answer', 'revisit'] },
  { key: 'interested', label: 'Interested', statuses: ['interested'] },
  { key: 'follow_up', label: 'Follow-up', statuses: ['follow_up'] },
  { key: 'estimate', label: 'Estimate', statuses: ['estimate', 'estimate_sent'] },
  { key: 'appointment_set', label: 'Appointment', statuses: ['appointment_set'] },
  { key: 'sold', label: 'Sold', statuses: ['sold', 'existing_customer'] },
] as const;

const CLOSED = new Set(['sold', 'lost', 'not_interested', 'do_not_knock', 'existing_customer']);
const COMPOSE_KEY = 'ns-compose-lead';
const emptyDraft = () => ({
  customer_name: '',
  phone: '',
  address: '',
  service_interest: 'Luxe Signature',
  estimated_value: '275',
  assigned_employee_id: '',
  notes: '',
});

const humanStatus = (s?: string | null) => prettyLabel(s).replace(/\b\w/g, (c) => c.toUpperCase());
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

export default function OwnerLeadPipeline({ employees, setAppointments, onNavigate }: Props) {
  const reps = employees.filter((e) => e.status === 'active' && (employeeCanD2D(e) || e.role === 'manager'));
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
    if (query && ![l.customer_name, l.address, l.phone, l.service_interest].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())) return false;
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
    if (!draft.customer_name.trim() && !draft.address.trim() && !draft.phone.trim()) {
      return alert('Add a name, address, or phone.');
    }
    setSaving(true);
    const payload = {
      customer_name: draft.customer_name.trim() || null,
      phone: draft.phone.trim() || null,
      address: draft.address.trim() || null,
      service_interest: draft.service_interest.trim() || null,
      estimated_value: Number(draft.estimated_value || 0),
      assigned_employee_id: draft.assigned_employee_id || null,
      notes: draft.notes.trim() || null,
      status: 'unworked',
      source: 'owner',
      lead_temperature: 'warm',
    };
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
          <div className="owner-lead-compose-grid">
            <label>Name<input value={draft.customer_name} onChange={(e) => setDraft((p) => ({ ...p, customer_name: e.target.value }))} placeholder="Resident" /></label>
            <label>Phone<input value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="919-555-0100" /></label>
            <label className="wide">Address<input value={draft.address} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} placeholder="Street, city" /></label>
            <label>Service<ServiceMenuSelect value={draft.service_interest} onChange={(name,pkg)=>setDraft((p)=>({...p,service_interest:name,estimated_value:String(pkg?.price||p.estimated_value)}))}/></label>
            <label>Value<input type="number" min="0" value={draft.estimated_value} onChange={(e) => setDraft((p) => ({ ...p, estimated_value: e.target.value }))} /></label>
            <label>Rep
              <select value={draft.assigned_employee_id} onChange={(e) => setDraft((p) => ({ ...p, assigned_employee_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="wide">Notes<input value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="How they found us, vehicle, gate code" /></label>
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
          {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
            <div className="lead-map-legend">{DOOR_STATUSES.slice(0, 10).map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
          </div>
          <LeadInspector
            selected={selected}
            reps={reps}
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

      {view === 'pipeline' && !busy && (
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
                  {shown.map((l) => (
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
                      <strong>{l.customer_name || l.address || 'Unnamed lead'}</strong>
                      <small>{l.address || 'No address'}</small>
                      <p>{reps.find((r) => r.id === l.assigned_employee_id)?.name || 'Unassigned'}</p>
                      <footer>
                        <span>{l.service_interest || 'Service TBD'}</span>
                        <b>{money(Number(l.estimated_value || 0))}</b>
                      </footer>
                    </button>
                  ))}
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
              <span><strong>{l.customer_name || 'Unnamed lead'}</strong><small>{l.address || 'No address'} · {l.service_interest || 'No service selected'}</small></span>
              <span>{reps.find((r) => r.id === l.assigned_employee_id)?.name || 'Unassigned'}</span>
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
              <div><Archive size={17} /><strong>{l.customer_name || l.address || 'Archived lead'}</strong></div>
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
  selected, reps, setAppointments, onNavigate, updateStatus, patchLead, archiveLead, restoreLead, clear,
}: {
  selected: Lead | null;
  reps: Employee[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onNavigate?: (view: string) => void;
  updateStatus: (l: Lead, s: string) => void;
  patchLead: (l: Lead, patch: Record<string, unknown>, activity?: { type: string; notes?: string; previous?: string; next?: string }) => Promise<Lead | void>;
  archiveLead: (l: Lead, reason?: string) => void;
  restoreLead: (l: Lead) => void;
  clear: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [service, setService] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [bookAt, setBookAt] = useState('');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setName(selected.customer_name || '');
    setPhone(selected.phone || '');
    setAddress(selected.address || '');
    setService(selected.service_interest || '');
    setValue(String(selected.estimated_value || 0));
    setNotes(selected.notes || '');
    setFollowUp(toLocalInput(selected.follow_up_at));
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

  const archived = Boolean(selected.archived_at || selected.cooldown_until || selected.status === 'do_not_knock');
  const lat = selected.latitude;
  const lng = selected.longitude;
  const streetViewUrl = lat != null && lng != null
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
    : selected.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address)}`
      : '';
  const overdue = Boolean(selected.follow_up_at && new Date(selected.follow_up_at) <= new Date());

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await patchLead(selected, {
      customer_name: name.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      service_interest: service.trim() || null,
      estimated_value: Number(value || 0),
      notes: notes.trim() || null,
      follow_up_at: followUp ? new Date(followUp).toISOString() : null,
    }, { type: 'updated', notes: 'Owner updated lead details' });
  };

  const bookJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookAt) return alert('Pick a date and time.');
    setBooking(true);
    const { data, error } = await supabase.from('appointments').insert({
      customer_name: name || selected.customer_name,
      customer_email: selected.email,
      customer_phone: phone || selected.phone,
      service_name: service || selected.service_interest || 'Detailing Service',
      package_name: service || selected.service_interest || null,
      add_ons: [],
      vehicle_info: selected.vehicle_info || '',
      scheduled_at: new Date(bookAt).toISOString(),
      status: 'scheduled',
      price: Number(value || selected.estimated_value || 0),
      notes: notes || selected.notes || '',
      service_address: address || selected.address,
      latitude: selected.latitude,
      longitude: selected.longitude,
      sales_rep_employee_id: selected.assigned_employee_id,
      lead_id: selected.id,
      source_channel: 'owner',
      dispatch_status: 'unassigned',
      field_status: 'scheduled',
    }).select().single();
    setBooking(false);
    if (error) return alert(error.message);
    setAppointments?.((p) => [...p, data].sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()));
    await patchLead(selected, { status: 'appointment_set', appointment_id: data.id }, { type: 'status_change', previous: selected.status, next: 'appointment_set', notes: 'Booked from owner pipeline' });
    void notifyCustomer('booking_received', data);
    onNavigate?.('appointments');
  };

  return (
    <aside className="lead-inspector phase-panel caramel">
      <div className="phase-panel-head">
        <div><span className="eyebrow">LEAD DETAILS</span><h3>{selected.address || selected.customer_name || 'Lead'}</h3></div>
        <button className="icon-btn" type="button" onClick={clear}><XCircle size={18} /></button>
      </div>
      <div className="lead-inspector-status">
        <span>{humanStatus(selected.status)}</span>
        <strong>{money(Number(selected.actual_sale_amount || selected.estimated_value || 0))}</strong>
      </div>
      <div className="lead-health-row">
        <span className={isHot(selected) ? 'lead-score hot' : 'lead-score'}>Lead Score {leadScore(selected)}</span>
        {overdue && <span className="overdue-pill">Follow-up overdue</span>}
        {archived && <span className="archive-pill">Archived / protected</span>}
      </div>
      {streetViewUrl && (
        <div className="property-preview-card">
          <div><Eye size={17} /><div><strong>Property Preview</strong><small>Open Street View to confirm the property before contact.</small></div></div>
          <a href={streetViewUrl} target="_blank" rel="noreferrer">Street View <ExternalLink size={14} /></a>
        </div>
      )}
      <form className="owner-lead-edit" onSubmit={saveDetails}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>Address<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label>Service<input value={service} onChange={(e) => setService(e.target.value)} /></label>
        <label>Value<input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label>Follow-up<input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></label>
        <label>Rep
          <select
            value={selected.assigned_employee_id || ''}
            onChange={(e) => patchLead(selected, { assigned_employee_id: e.target.value || null }, { type: 'assigned', notes: e.target.value ? 'Rep assigned' : 'Rep cleared' })}
          >
            <option value="">Unassigned</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="wide">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
        <button className="btn-primary" type="submit">Save details</button>
      </form>
      <div className="lead-direct-actions">
        {selected.phone && <><a href={`tel:${selected.phone}`}>Call</a><a href={`sms:${selected.phone}`}>Text</a></>}
        {selected.address && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address)}`}>Map</a>}
      </div>
      {!archived && (
        <div className="lead-status-actions">
          {['interested', 'follow_up', 'estimate', 'appointment_set', 'sold', 'not_interested', 'do_not_knock', 'lost'].map((s) => (
            <button type="button" key={s} className={selected.status === s ? 'active' : ''} onClick={() => updateStatus(selected, s)}>{humanStatus(s)}</button>
          ))}
        </div>
      )}
      {!archived && (
        <form className="owner-lead-book" onSubmit={bookJob}>
          <div className="phase-panel-head"><div><span className="eyebrow">BOOK</span><h3>Put it on the calendar</h3></div></div>
          <label>Window<input type="datetime-local" value={bookAt} onChange={(e) => setBookAt(e.target.value)} required /></label>
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
