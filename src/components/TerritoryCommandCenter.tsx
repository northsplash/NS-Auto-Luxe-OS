import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';
import { supabase } from '@/lib/supabase';
import type { Appointment, Employee, Lead, LeadTerritory, SalesRecord, TerritoryDoor, TerritoryDoorHistory } from '@/lib/supabase';
import { CANVASS_FILTER_KEYS, canvassTerritoryStats, formatRelativeActivity } from '@/lib/canvass';
import { DOOR_STATUSES, doorStatus, doorStreetLabel, localDateTime } from '@/lib/fieldOps';
import { money } from '@/lib/data';
import { fetchTerritoryHouses, mapOsmHouses } from '@/lib/territoryHouses';

type Props = {
  employees: Employee[];
  leads?: Lead[];
  appointments?: Appointment[];
};

export default function TerritoryCommandCenter({ employees, leads = [], appointments = [] }: Props) {
  const [territories, setTerritories] = useState<LeadTerritory[]>([]);
  const [doors, setDoors] = useState<TerritoryDoor[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [history, setHistory] = useState<TerritoryDoorHistory[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDoor, setSelectedDoor] = useState<TerritoryDoor | null>(null);
  const [doorHistory, setDoorHistory] = useState<TerritoryDoorHistory[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [repId, setRepId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [t, d, s, h] = await Promise.all([
        supabase.from('lead_territories').select('*').eq('status', 'active').order('priority', { ascending: false }),
        supabase.from('territory_doors').select('*').order('updated_at', { ascending: false }).limit(12000),
        supabase.from('sales_records').select('*').eq('status', 'completed').order('sold_at', { ascending: false }).limit(4000),
        supabase.from('territory_door_history').select('*').order('created_at', { ascending: false }).limit(400),
      ]);
      setTerritories((t.data ?? []) as LeadTerritory[]);
      setDoors((d.data ?? []) as TerritoryDoor[]);
      setSales((s.data ?? []) as SalesRecord[]);
      setHistory((h.data ?? []) as TerritoryDoorHistory[]);
      if (!selectedId && t.data?.[0]?.id) setSelectedId(t.data[0].id);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const reps = employees.filter((e) => e.status === 'active' && (e.role === 'd2d_agent' || e.role === 'manager' || e.role === 'owner'));
  const selected = territories.find((t) => t.id === selectedId) || null;
  const visibleTerritories = territories.filter((t) => !repId || t.assigned_employee_id === repId);
  const territoryDoors = useMemo(() => {
    return doors.filter((d) => {
      if (selectedId && d.territory_id !== selectedId) return false;
      if (repId) {
        const t = territories.find((x) => x.id === d.territory_id);
        if (t && t.assigned_employee_id !== repId && d.last_employee_id !== repId) return false;
      }
      const lead = leads.find((l) => l.id === d.lead_id);
      const hay = `${d.address || ''} ${lead?.customer_name || ''}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      return true;
    });
  }, [doors, selectedId, repId, query, territories, leads]);

  const mapDoors = territoryDoors.map((d) => {
    const lead = d.lead_id ? leads.find((l) => l.id === d.lead_id) : null;
    const rep = employees.find((e) => e.id === (d.last_employee_id || selected?.assigned_employee_id));
    return { ...d, customer_name: lead?.customer_name || null, assigned_name: rep?.name || 'Unassigned' };
  });
  const stats = canvassTerritoryStats(territoryDoors, leads.filter((l) => !selectedId || l.territory_id === selectedId), sales);
  const territoryAppts = appointments.filter((a) => a.source_channel === 'd2d' && (!selectedId || a.lead_id && leads.some((l) => l.id === a.lead_id && l.territory_id === selectedId)));

  const openDoor = async (door: any) => {
    const full = doors.find((d) => d.id === door.id) || door;
    setSelectedDoor(full);
    if (full.id) {
      const h = await supabase.from('territory_door_history').select('*').eq('door_id', full.id).order('created_at', { ascending: false }).limit(40);
      setDoorHistory((h.data ?? []) as TerritoryDoorHistory[]);
    } else setDoorHistory([]);
  };

  const refreshHouses = async () => {
    if (!selected) return;
    const raw = (selected.polygon_geojson as any)?.coordinates?.[0] ?? [];
    const points = raw.map((p: number[]) => [Number(p[1]), Number(p[0])] as [number, number]).filter((p: number[]) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (points.length < 3) return alert('This territory needs a saved boundary.');
    setRefreshing(true);
    try {
      const lats = points.map((p: number[]) => p[0]); const lngs = points.map((p: number[]) => p[1]);
      const elements = await fetchTerritoryHouses({ south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs), points, residentialOnly: true });
      const houses = mapOsmHouses(elements, points, { residentialOnly: true });
      const existing = doors.filter((d) => d.territory_id === selected.id);
      const rows = houses.filter((h) => !existing.some((d) => Math.abs(Number(d.latitude) - h.lat) < 0.000012 && Math.abs(Number(d.longitude) - h.lng) < 0.000012))
        .map((h) => ({ territory_id: selected.id, latitude: h.lat, longitude: h.lng, address: h.address, house_number: h.house_number, street_name: h.street_name, status: 'unworked', source: h.source }));
      for (let i = 0; i < rows.length; i += 250) {
        const { error } = await supabase.from('territory_doors').insert(rows.slice(i, i + 250));
        if (error) throw error;
      }
      await supabase.from('lead_territories').update({ houses_imported_at: new Date().toISOString() }).eq('id', selected.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Unable to refresh houses.');
    } finally {
      setRefreshing(false);
    }
  };

  const selectedLead = selectedDoor?.lead_id ? leads.find((l) => l.id === selectedDoor.lead_id) : null;
  const assigned = employees.find((e) => e.id === (selectedDoor?.last_employee_id || selected?.assigned_employee_id));

  return (
    <div className="tab-content v2-page territory-cc">
      <div className="v2-page-head">
        <div>
          <span className="eyebrow">Field command</span>
          <h2>Territory command center</h2>
          <p>Live property statuses, progress, and knock history from the same records D2D reps use in the field.</p>
        </div>
        <button type="button" className="btn-outline" onClick={() => void refreshHouses()} disabled={!selected || refreshing}><RefreshCw size={15} />{refreshing ? 'Refreshing…' : 'Refresh houses'}</button>
      </div>
      <div className="territory-cc-kpis">
        <article><span>Properties</span><strong>{stats.total}</strong></article>
        <article><span>Worked</span><strong>{stats.worked}</strong></article>
        <article><span>Remaining</span><strong>{stats.remaining}</strong></article>
        <article><span>Contacted</span><strong>{stats.contacted}</strong></article>
        <article><span>Interested</span><strong>{stats.interested}</strong></article>
        <article><span>Follow-ups</span><strong>{stats.followUps}</strong></article>
        <article><span>Estimates</span><strong>{stats.estimates}</strong></article>
        <article><span>Appointments</span><strong>{stats.appointments}</strong></article>
        <article><span>Sales</span><strong>{stats.sales}</strong></article>
        <article><span>Conversion</span><strong>{stats.conversion}%</strong></article>
        <article><span>Revenue</span><strong>{money(stats.revenue)}</strong></article>
        <article><span>D2D jobs</span><strong>{territoryAppts.length}</strong></article>
      </div>
      <div className="territory-cc-filters">
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setSelectedDoor(null); }}>
          {visibleTerritories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={repId} onChange={(e) => setRepId(e.target.value)}>
          <option value="">All reps</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label className="d2d-canvass-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search address or customer" /></label>
      </div>
      <div className="d2d-filter-row v2-status-scroller">
        {DOOR_STATUSES.filter((x) => CANVASS_FILTER_KEYS.includes(x.key)).map((s) => (
          <button key={s.key} type="button" className={filters.includes(s.key) ? 'status-filter active dim-mode' : 'status-filter'} onClick={() => setFilters((p) => p.includes(s.key) ? p.filter((x) => x !== s.key) : [...p, s.key])}>
            <i style={{ background: s.color }} /><b>{s.short}</b><span className="status-filter-name">{s.label}</span>
          </button>
        ))}
      </div>
      {busy && <div className="d2d-house-discovery"><span className="live-dot" /> Loading territory properties…</div>}
      <div className="territory-cc-layout">
        <section className="territory-cc-map">
          <FieldTerritoryMap
            className="territory-admin-map"
            territories={visibleTerritories.filter((t) => !selectedId || t.id === selectedId)}
            doors={mapDoors}
            leads={leads.filter((l) => !selectedId || l.territory_id === selectedId)}
            selectedTerritoryId={selectedId || undefined}
            statusFilter={filters}
            filterMode="dim"
            searchQuery={query}
            activeDoorId={selectedDoor?.id || null}
            onDoorClick={openDoor}
            onTerritoryClick={(t) => setSelectedId(t.id)}
            showDoorLabels={false}
          />
        </section>
        <aside className="territory-cc-side">
          {selectedDoor ? (
            <>
              <span className="eyebrow">Property</span>
              <h3>{doorStreetLabel(selectedDoor)}</h3>
              <p>{assigned?.name || 'Unassigned'} · {doorStatus(selectedDoor.status).label}</p>
              <p>{formatRelativeActivity(selectedDoor.last_visited_at)}</p>
              {selectedLead && <p>{selectedLead.customer_name || 'Household'} · {selectedLead.phone || 'No phone'}</p>}
              <h4>Complete history</h4>
              <div className="territory-cc-activity">
                {doorHistory.map((h) => (
                  <article key={h.id}>
                    <strong>{doorStatus(h.new_status).label}</strong>
                    <small>{localDateTime(h.created_at)} · {employees.find((e) => e.id === h.employee_id)?.name || 'Rep'}</small>
                    <span>{h.notes || 'Status updated'}</span>
                  </article>
                ))}
                {!doorHistory.length && <div className="ns-empty compact">No knock history yet.</div>}
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow">{selected?.name || 'Territory'}</span>
              <h3>Recent knocks</h3>
              <div className="territory-cc-activity">
                {history.filter((h) => !selectedId || doors.find((d) => d.id === h.door_id)?.territory_id === selectedId).slice(0, 18).map((h) => (
                  <article key={h.id}>
                    <strong>{doorStatus(h.new_status).label}</strong>
                    <small>{localDateTime(h.created_at)} · {employees.find((e) => e.id === h.employee_id)?.name || 'Rep'}</small>
                  </article>
                ))}
                {!history.length && <div className="ns-empty compact">Knocks from the field appear here.</div>}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
