import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Briefcase, CheckCircle2, ClipboardCheck, FileText, Gauge, MapPin,
  PackageCheck, Plus, Save, ShieldCheck, Target, Trash2, UserCog, Users,
  Wrench, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  Appointment, AuditLog, BusinessNotification, BusinessTask, Employee,
  EmployeeDocument, EquipmentAsset, Lead, LeadTerritory, PayrollRun, Profile,
  TimeEntry, TimeOffRequest
} from '@/lib/supabase';
import { money } from '@/lib/data';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_GROUPS, PortalRole } from '@/lib/permissions';
import FieldTerritoryMap from '@/components/FieldTerritoryMap';

export type EnterpriseSection =
  | 'job_assignments'
  | 'leads'
  | 'territories'
  | 'tasks'
  | 'equipment'
  | 'documents'
  | 'reports'
  | 'permissions'
  | 'notifications'
  | 'time_off'
  | 'payroll_approval'
  | 'audit';

type Props = {
  section: EnterpriseSection;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
};

const LEAD_STATUSES = [
  ['new', 'New'], ['not_home', 'Not Home'], ['no_answer', 'No Answer'],
  ['interested', 'Interested'], ['follow_up', 'Follow Up'], ['appointment_set', 'Appointment Set'],
  ['estimate_sent', 'Estimate Sent'], ['sold', 'Sold'], ['not_interested', 'Not Interested'],
  ['do_not_knock', 'Do Not Knock'], ['existing_customer', 'Existing Customer'],
  ['bad_address', 'Bad Address'], ['lost', 'Lost'],
] as const;

const roleLabel = (r?: string | null) => ({ owner: 'Owner / Admin', manager: 'Manager', employee: 'Employee', d2d: 'D2D Sales', recruiter: 'Recruiter', finance: 'Finance', customer: 'Customer' }[r || 'customer'] || r || 'Customer');
const dt = (v?: string | null) => v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const day = (v?: string | null) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const card: React.CSSProperties = { background: '#fffdf9', color: '#211811', border: '1px solid #e3d6ca', borderRadius: 18, padding: 20, boxShadow: '0 12px 34px rgba(48,32,21,.055)' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 };
const reverseAddress=async(lat:number,lng:number)=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,{headers:{'Accept-Language':'en-US,en'}});if(!r.ok)return'';const d=await r.json();const a=d.address||{};const street=[a.house_number,a.road||a.residential||a.pedestrian].filter(Boolean).join(' ');const city=a.city||a.town||a.village||a.municipality;const region=[city,a.state,a.postcode].filter(Boolean).join(', ').replace(/, ([0-9]{5})$/, ' $1');return [street,region].filter(Boolean).join(', ')||d.display_name||''}catch{return''}};

async function audit(action: string, entityType: string, entityId?: string, details: Record<string, unknown> = {}) {
  await supabase.from('audit_logs').insert({ action, entity_type: entityType, entity_id: entityId || null, details }).then(() => undefined);
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="tab-header enterprise-page-header"><div><span className="eyebrow">NORTH SPLASH OS</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function LeadMap({ leads, territories, onMapPoint }: { leads: Lead[]; territories: LeadTerritory[]; onMapPoint: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leaflet = 'true';
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Map library could not load'));
          document.body.appendChild(script);
        });
      }
      setReady(true);
    };
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (!ready || !ref.current || mapRef.current) return;
    const L = (window as any).L;
    const map = L.map(ref.current).setView([35.7796, -78.6382], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: any) => onMapPoint(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
  }, [ready, onMapPoint]);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const L = (window as any).L;
    layerRef.current.clearLayers();
    territories.forEach(t => {
      if (t.center_lat != null && t.center_lng != null) {
        L.circle([Number(t.center_lat), Number(t.center_lng)], { radius: t.radius_meters || 1200, color: '#c9a96e', weight: 2, fillOpacity: .05 })
          .bindPopup(`<strong>${t.name}</strong>`).addTo(layerRef.current);
      }
    });
    leads.forEach(l => {
      if (l.latitude != null && l.longitude != null) {
        const color = l.status === 'sold' ? '#35b36b' : l.status === 'not_interested' || l.status === 'do_not_knock' ? '#b94d4d' : '#c9a96e';
        L.circleMarker([Number(l.latitude), Number(l.longitude)], { radius: 7, color, fillColor: color, fillOpacity: .9 })
          .bindPopup(`<strong>${l.customer_name || 'Lead'}</strong><br>${l.address || ''}<br>${l.status.replaceAll('_',' ')}`).addTo(layerRef.current);
      }
    });
  }, [leads, territories, ready]);

  return <div ref={ref} style={{ height: 460, borderRadius: 14, overflow: 'hidden', border: '1px solid #292929', background: '#0a0a0a' }} />;
}

export default function EnterpriseSuite({ section, employees, setEmployees, appointments, setAppointments }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [territories, setTerritories] = useState<LeadTerritory[]>([]);
  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [equipment, setEquipment] = useState<EquipmentAsset[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [leadForm, setLeadForm] = useState({ assigned_employee_id: '', territory_id: '', customer_name: '', address: '', city: 'Raleigh', state: 'NC', postal_code: '', phone: '', email: '', latitude: '', longitude: '', status: 'new', service_interest: '', vehicle_info: '', estimated_value: '', follow_up_at: '', notes: '' });
  const [territoryForm, setTerritoryForm] = useState({ name: '', assigned_employee_id: '', center_lat: '', center_lng: '', radius_meters: 1200, notes: '', polygon_points: [] as [number,number][] });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_employee_id: '', priority: 'normal', due_at: '' });
  const [equipmentForm, setEquipmentForm] = useState({ name: '', category: 'Equipment', serial_number: '', purchase_date: '', purchase_cost: '', assigned_employee_id: '', condition: 'good', status: 'available', next_maintenance_at: '', notes: '' });
  const [docForm, setDocForm] = useState({ employee_id: '', document_type: 'training', title: '', file_url: '', expires_at: '', notes: '' });
  const [notificationForm, setNotificationForm] = useState({ target_employee_id: '', target_portal_role: '', title: '', message: '', notification_type: 'info', link: '' });
  const [payrollForm, setPayrollForm] = useState({ period_start: '', period_end: '', notes: '' });

  const load = async () => {
    const [p, l, t, tk, eq, docs, notifs, off, times, payroll, logs, pays, ex] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('lead_territories').select('*').order('name'),
      supabase.from('business_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('equipment_assets').select('*').order('name'),
      supabase.from('employee_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('business_notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('time_off_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('time_entries').select('*').order('clock_in', { ascending: false }).limit(500),
      supabase.from('payroll_runs').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(1000),
    ]);
    setProfiles(p.data ?? []); setLeads(l.data ?? []); setTerritories(t.data ?? []); setTasks(tk.data ?? []);
    setEquipment(eq.data ?? []); setDocuments(docs.data ?? []); setNotifications(notifs.data ?? []);
    setTimeOff(off.data ?? []); setTimeEntries(times.data ?? []); setPayrollRuns(payroll.data ?? []);
    setAuditLogs(logs.data ?? []); setPayments(pays.data ?? []); setExpenses(ex.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const empName = (id?: string | null) => employees.find(e => e.id === id)?.name ?? 'Unassigned';
  const customerName = (id: string) => profiles.find(p => p.id === id)?.full_name ?? profiles.find(p => p.id === id)?.email ?? 'Customer';

  const leadMetrics = useMemo(() => {
    const sold = leads.filter(l => l.status === 'sold');
    const contacted = leads.filter(l => !['new','bad_address'].includes(l.status));
    return {
      total: leads.length,
      sold: sold.length,
      value: sold.reduce((s, l) => s + Number(l.actual_sale_amount || l.estimated_value || 0), 0),
      conversion: contacted.length ? (sold.length / contacted.length) * 100 : 0,
      followups: leads.filter(l => l.follow_up_at && new Date(l.follow_up_at) <= new Date(Date.now() + 86400000)).length,
    };
  }, [leads]);

  const addLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...leadForm, assigned_employee_id: leadForm.assigned_employee_id || null, territory_id: leadForm.territory_id || null, latitude: leadForm.latitude ? Number(leadForm.latitude) : null, longitude: leadForm.longitude ? Number(leadForm.longitude) : null, estimated_value: Number(leadForm.estimated_value || 0), follow_up_at: leadForm.follow_up_at ? new Date(leadForm.follow_up_at).toISOString() : null };
    const { data, error } = await supabase.from('leads').insert(payload).select().single();
    if (error) return alert(error.message);
    setLeads(p => [data, ...p]); await audit('lead.created', 'lead', data.id, { status: data.status });
    setLeadForm(p => ({ ...p, customer_name: '', address: '', postal_code: '', phone: '', email: '', service_interest: '', vehicle_info: '', estimated_value: '', follow_up_at: '', notes: '' }));
  };

  const updateLeadStatus = async (lead: Lead, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString(), last_contacted_at: new Date().toISOString() };
    if (status === 'sold' && !lead.actual_sale_amount) updates.actual_sale_amount = lead.estimated_value;
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
    if (error) return alert(error.message);
    await supabase.from('lead_activities').insert({ lead_id: lead.id, employee_id: lead.assigned_employee_id, activity_type: 'status_change', previous_status: lead.status, new_status: status });
    setLeads(p => p.map(l => l.id === lead.id ? { ...l, ...updates } : l));
  };

  const addTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    const pts=territoryForm.polygon_points; const polygon_geojson=pts.length>=3?{type:'Polygon',coordinates:[[...pts.map(p=>[p[1],p[0]]),[pts[0][1],pts[0][0]]]]}:null; const { polygon_points, ...base }=territoryForm; const { data, error } = await supabase.from('lead_territories').insert({ ...base, polygon_geojson, assigned_employee_id: territoryForm.assigned_employee_id || null, center_lat: territoryForm.center_lat ? Number(territoryForm.center_lat) : pts[0]?.[0]||null, center_lng: territoryForm.center_lng ? Number(territoryForm.center_lng) : pts[0]?.[1]||null }).select().single();
    if (error) return alert(error.message); setTerritories(p => [...p, data]); await audit('territory.created', 'territory', data.id);
  };

  const importTerritoryHouses = async (territory: LeadTerritory) => {
    const ring=(territory.polygon_geojson as any)?.coordinates?.[0]; if(!ring?.length)return alert('Draw a polygon territory first.');
    try {
      const poly=ring.slice(0,-1).map((p:number[])=>`${p[1]} ${p[0]}`).join(' ');
      const q=`[out:json][timeout:25];(way[building](poly:"${poly}");node[addr:housenumber](poly:"${poly}"););out center tags;`;
      const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)}); if(!r.ok)throw new Error('OpenStreetMap house lookup failed'); const json=await r.json();
      const rows=(json.elements||[]).map((x:any)=>{const lat=x.lat??x.center?.lat,lng=x.lon??x.center?.lon;if(lat==null||lng==null)return null;const t=x.tags||{};const address=[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')||null;return {territory_id:territory.id,address,latitude:lat,longitude:lng,status:'unworked',source:'openstreetmap'}}).filter(Boolean).slice(0,1200);
      if(!rows.length)return alert('No mapped houses were returned for this territory. You can still add doors manually.');
      const {error}=await supabase.from('territory_doors').upsert(rows,{onConflict:'territory_id,latitude,longitude',ignoreDuplicates:true}); if(error)throw error; alert(`${rows.length} mapped houses loaded. D2D reps can now tap them.`); await audit('territory.houses_imported','territory',territory.id,{count:rows.length});
    } catch(err){alert(err instanceof Error?err.message:'Could not load houses');}
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('business_tasks').insert({ ...taskForm, assigned_employee_id: taskForm.assigned_employee_id || null, due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null }).select().single();
    if (error) return alert(error.message); setTasks(p => [data, ...p]); setTaskForm({ title: '', description: '', assigned_employee_id: '', priority: 'normal', due_at: '' }); await audit('task.created', 'task', data.id);
  };

  const addEquipment = async (e: React.FormEvent) => {
    e.preventDefault(); const payload = { ...equipmentForm, purchase_cost: Number(equipmentForm.purchase_cost || 0), assigned_employee_id: equipmentForm.assigned_employee_id || null, purchase_date: equipmentForm.purchase_date || null, next_maintenance_at: equipmentForm.next_maintenance_at || null };
    const { data, error } = await supabase.from('equipment_assets').insert(payload).select().single(); if (error) return alert(error.message); setEquipment(p => [...p, data]); await audit('equipment.created','equipment',data.id);
  };

  const addDocument = async (e: React.FormEvent) => {
    e.preventDefault(); const { data, error } = await supabase.from('employee_documents').insert({ ...docForm, employee_id: docForm.employee_id || null, expires_at: docForm.expires_at || null, file_url: docForm.file_url || null }).select().single(); if (error) return alert(error.message); setDocuments(p => [data, ...p]); setDocForm({ employee_id: '', document_type: 'training', title: '', file_url: '', expires_at: '', notes: '' });
  };

  const saveProfileAccess = async (person: Profile, portalRole: PortalRole, permissions: Record<string, boolean>) => {
    const accountRole = person.role === 'admin' || portalRole === 'owner'
      ? 'admin'
      : portalRole === 'customer'
        ? 'customer'
        : portalRole === 'd2d'
          ? 'd2d_agent'
          : 'employee';
    const { error } = await supabase.from('profiles').update({ portal_role: portalRole, permissions, role: accountRole }).eq('id', person.id);
    if (error) return alert(error.message);
    if (portalRole !== 'customer' && person.email) {
      const matchingEmployee = employees.find(e => e.email?.toLowerCase() === person.email?.toLowerCase());
      if (matchingEmployee && !matchingEmployee.user_id) {
        await supabase.from('employees').update({ user_id: person.id }).eq('id', matchingEmployee.id);
      }
    }
    setProfiles(p => p.map(x => x.id === person.id ? { ...x, portal_role: portalRole, permissions, role: accountRole as Profile['role'] } : x));
    await audit('permissions.updated', 'profile', person.id, { portal_role: portalRole, permissions, account_role: accountRole });
  };

  const addNotification = async (e: React.FormEvent) => {
    e.preventDefault(); const { data, error } = await supabase.from('business_notifications').insert({ ...notificationForm, target_employee_id: notificationForm.target_employee_id || null, target_portal_role: notificationForm.target_portal_role || null, link: notificationForm.link || null }).select().single(); if (error) return alert(error.message); setNotifications(p => [data, ...p]); setNotificationForm({ target_employee_id: '', target_portal_role: '', title: '', message: '', notification_type: 'info', link: '' });
  };

  const assignJob = async (appointmentId: string, field: 'assigned_employee_id' | 'assigned_manager_id' | 'sales_rep_employee_id', employeeId: string) => {
    const { error } = await supabase.from('appointments').update({ [field]: employeeId || null }).eq('id', appointmentId); if (error) return alert(error.message);
    setAppointments(p => p.map(a => a.id === appointmentId ? { ...a, [field]: employeeId || null } : a)); await audit('appointment.assignment_changed','appointment',appointmentId,{ field, employeeId });
  };

  const approveTime = async (entry: TimeEntry, status: string) => {
    const { error } = await supabase.from('time_entries').update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', entry.id); if (error) return alert(error.message);
    setTimeEntries(p => p.map(t => t.id === entry.id ? { ...t, status } : t));
  };

  const addPayrollRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const inPeriod = timeEntries.filter(t => new Date(t.clock_in) >= new Date(`${payrollForm.period_start}T00:00:00`) && new Date(t.clock_in) <= new Date(`${payrollForm.period_end}T23:59:59`) && t.status === 'approved');
    const gross = inPeriod.reduce((sum, t) => {
      const emp = employees.find(e => e.id === t.employee_id); if (!emp || !t.clock_out) return sum;
      const hours = Math.max(0, (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000 - Number(t.break_minutes || 0) / 60);
      return sum + hours * Number(emp.hourly_rate || 0);
    }, 0);
    const { data, error } = await supabase.from('payroll_runs').insert({ ...payrollForm, gross_pay: gross, status: 'draft' }).select().single(); if (error) return alert(error.message); setPayrollRuns(p => [data, ...p]);
  };

  if (section === 'job_assignments') return <div className="tab-content"><Header title="Job Assignment" subtitle="Assign detailers, managers and the D2D rep who originated each booking." />
    <div style={{ ...card, overflowX: 'auto' }}><div className="data-table"><div className="data-table-head"><span>Customer / Service</span><span>Detailer</span><span>Manager</span><span>Sales Rep</span><span>When</span></div>
      {appointments.filter(a => !a.archived && a.status !== 'cancelled').map(a => <div className="data-table-row" key={a.id}>
        <div className="dt-cell"><strong>{customerName(a.user_id)}</strong><span>{a.service_name} · {money(a.price)}</span></div>
        <select value={a.assigned_employee_id || ''} onChange={e => assignJob(a.id,'assigned_employee_id',e.target.value)}><option value="">Unassigned</option>{employees.filter(e => e.role === 'detailer').map(e => <option key={e.id} value={e.id}>{e.name} · L{e.employment_level || 1}</option>)}</select>
        <select value={a.assigned_manager_id || ''} onChange={e => assignJob(a.id,'assigned_manager_id',e.target.value)}><option value="">No manager</option>{employees.filter(e => e.role === 'manager').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select value={a.sales_rep_employee_id || ''} onChange={e => assignJob(a.id,'sales_rep_employee_id',e.target.value)}><option value="">No rep</option>{employees.filter(e => e.role === 'd2d_agent').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <span>{dt(a.scheduled_at)}</span>
      </div>)}</div></div></div>;

  if (section === 'leads') return <div className="tab-content"><Header title="Field Leads Tracker" subtitle="Map doors, leads, follow-ups, appointments and closed D2D sales." />
    <div style={{ ...grid, marginBottom: 16 }}><Metric label="Doors / Leads" value={String(leadMetrics.total)} /><Metric label="Sold" value={String(leadMetrics.sold)} /><Metric label="Revenue Won" value={money(leadMetrics.value)} /><Metric label="Conversion" value={`${leadMetrics.conversion.toFixed(1)}%`} /><Metric label="Follow-ups Due" value={String(leadMetrics.followups)} /></div>
    <div className="admin-leads-layout">
      <div><LeadMap leads={leads} territories={territories} onMapPoint={async(lat,lng) => { setLeadForm(p => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6), address: p.address || 'Locating address…' })); const address=await reverseAddress(lat,lng); setLeadForm(p=>({...p,address:address||''})); }} /><p style={{color:'#888',fontSize:12}}>Click the map to set coordinates for a new lead. Reps can also use current GPS from their D2D portal.</p></div>
      <form className="enterprise-brown-card admin-lead-form" onSubmit={addLead}><h3><Target size={18}/> Add Lead / Door</h3><div className="form-group"><label>Rep</label><select value={leadForm.assigned_employee_id} onChange={e=>setLeadForm(p=>({...p,assigned_employee_id:e.target.value}))}><option value="">Unassigned</option>{employees.filter(e=>e.role==='d2d_agent').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div><div className="form-group"><label>Territory</label><select value={leadForm.territory_id} onChange={e=>setLeadForm(p=>({...p,territory_id:e.target.value}))}><option value="">None</option>{territories.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><input placeholder="Name / homeowner" value={leadForm.customer_name} onChange={e=>setLeadForm(p=>({...p,customer_name:e.target.value}))}/><input placeholder="Street address" value={leadForm.address} onChange={e=>setLeadForm(p=>({...p,address:e.target.value}))}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><input placeholder="Latitude" value={leadForm.latitude} onChange={e=>setLeadForm(p=>({...p,latitude:e.target.value}))}/><input placeholder="Longitude" value={leadForm.longitude} onChange={e=>setLeadForm(p=>({...p,longitude:e.target.value}))}/></div><input placeholder="Phone" value={leadForm.phone} onChange={e=>setLeadForm(p=>({...p,phone:e.target.value}))}/><input placeholder="Service interest" value={leadForm.service_interest} onChange={e=>setLeadForm(p=>({...p,service_interest:e.target.value}))}/><input type="number" placeholder="Estimated value" value={leadForm.estimated_value} onChange={e=>setLeadForm(p=>({...p,estimated_value:e.target.value}))}/><select value={leadForm.status} onChange={e=>setLeadForm(p=>({...p,status:e.target.value}))}>{LEAD_STATUSES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><textarea placeholder="Notes" value={leadForm.notes} onChange={e=>setLeadForm(p=>({...p,notes:e.target.value}))}/><button className="btn-primary btn-full"><Plus size={15}/> Save Lead</button></form>
    </div>
    <div style={{...card,marginTop:18,overflowX:'auto'}}><div className="data-table"><div className="data-table-head"><span>Lead</span><span>Rep</span><span>Status</span><span>Value</span><span>Follow-up</span></div>{leads.map(l=><div className="data-table-row" key={l.id}><div className="dt-cell"><strong>{l.customer_name||l.address||'Unnamed lead'}</strong><span>{l.address||'No address'} · {l.service_interest||'No service selected'}</span></div><span>{empName(l.assigned_employee_id)}</span><select value={l.status} onChange={e=>updateLeadStatus(l,e.target.value)}>{LEAD_STATUSES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><strong>{money(Number(l.actual_sale_amount||l.estimated_value||0))}</strong><span>{dt(l.follow_up_at)}</span></div>)}</div></div>
  </div>;

  if (section === 'territories') return <div className="tab-content"><Header title="Territory Builder" subtitle="Draw a boundary around houses, assign it to a D2D rep, then save. Reps work individual doors inside the territory." />
    <div className="territory-builder-grid"><form style={card} onSubmit={addTerritory}><h3><MapPin size={18}/> New Territory</h3><input required placeholder="Territory name" value={territoryForm.name} onChange={e=>setTerritoryForm(p=>({...p,name:e.target.value}))}/><select value={territoryForm.assigned_employee_id} onChange={e=>setTerritoryForm(p=>({...p,assigned_employee_id:e.target.value}))}><option value="">Unassigned</option>{employees.filter(e=>e.role==='d2d_agent').map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><textarea placeholder="Notes" value={territoryForm.notes} onChange={e=>setTerritoryForm(p=>({...p,notes:e.target.value}))}/><div className="territory-draw-count">{territoryForm.polygon_points.length} boundary points selected</div><button className="btn-primary btn-full" disabled={territoryForm.polygon_points.length<3}>Save Drawn Territory</button><p className="helper-text">Click at least 3 points around the neighborhood. The final edge closes automatically.</p></form><FieldTerritoryMap editable territories={territories} leads={leads} onPolygonChange={polygon_points=>setTerritoryForm(p=>({...p,polygon_points}))}/></div>
    <div className="territory-list-grid">{territories.map(t=><div style={card} key={t.id}><strong>{t.name}</strong><p>{empName(t.assigned_employee_id)} · {t.status}</p><small>{(t.polygon_geojson as any)?.coordinates?.[0]?.length?`${(t.polygon_geojson as any).coordinates[0].length-1} boundary points`:'Legacy radius territory'}</small><div style={{marginTop:12}}><button className="btn-sm btn-outline" onClick={()=>importTerritoryHouses(t)}>Load Houses from Map</button></div></div>)}</div>
  </div>;

  if (section === 'tasks') return <div className="tab-content"><Header title="Tasks & Operations" subtitle="Assign operational work without needing a separate task app." /><form style={{...card,marginBottom:18}} onSubmit={addTask}><div style={grid}><input required placeholder="Task title" value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))}/><select value={taskForm.assigned_employee_id} onChange={e=>setTaskForm(p=>({...p,assigned_employee_id:e.target.value}))}><option value="">Unassigned</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><select value={taskForm.priority} onChange={e=>setTaskForm(p=>({...p,priority:e.target.value}))}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select><input type="datetime-local" value={taskForm.due_at} onChange={e=>setTaskForm(p=>({...p,due_at:e.target.value}))}/></div><textarea placeholder="Description" value={taskForm.description} onChange={e=>setTaskForm(p=>({...p,description:e.target.value}))}/><button className="btn-primary"><Plus size={15}/> Add Task</button></form><div style={grid}>{tasks.map(t=><div style={card} key={t.id}><div style={{display:'flex',justifyContent:'space-between'}}><strong>{t.title}</strong><span className="status-badge badge-gray">{t.priority}</span></div><p>{t.description}</p><small>{empName(t.assigned_employee_id)} · Due {dt(t.due_at)}</small><div style={{marginTop:12}}><select value={t.status} onChange={async e=>{const status=e.target.value;await supabase.from('business_tasks').update({status,completed_at:status==='completed'?new Date().toISOString():null}).eq('id',t.id);setTasks(p=>p.map(x=>x.id===t.id?{...x,status}:x));}}><option>open</option><option>in_progress</option><option>blocked</option><option>completed</option></select></div></div>)}</div></div>;

  if (section === 'equipment') return <div className="tab-content"><Header title="Equipment & Assets" subtitle="Track pressure washers, extractors, polishers, vehicles and assigned equipment." /><form style={{...card,marginBottom:18}} onSubmit={addEquipment}><div style={grid}><input required placeholder="Asset name" value={equipmentForm.name} onChange={e=>setEquipmentForm(p=>({...p,name:e.target.value}))}/><input placeholder="Category" value={equipmentForm.category} onChange={e=>setEquipmentForm(p=>({...p,category:e.target.value}))}/><input placeholder="Serial number" value={equipmentForm.serial_number} onChange={e=>setEquipmentForm(p=>({...p,serial_number:e.target.value}))}/><input type="number" placeholder="Purchase cost" value={equipmentForm.purchase_cost} onChange={e=>setEquipmentForm(p=>({...p,purchase_cost:e.target.value}))}/><select value={equipmentForm.assigned_employee_id} onChange={e=>setEquipmentForm(p=>({...p,assigned_employee_id:e.target.value}))}><option value="">Not assigned</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><select value={equipmentForm.status} onChange={e=>setEquipmentForm(p=>({...p,status:e.target.value}))}><option>available</option><option>assigned</option><option>repair</option><option>retired</option></select></div><button className="btn-primary">Add Asset</button></form><div style={grid}>{equipment.map(a=><div style={card} key={a.id}><Wrench size={18}/><h3>{a.name}</h3><p>{a.category} · {a.status}</p><small>Assigned: {empName(a.assigned_employee_id)} · Value {money(Number(a.purchase_cost||0))}</small></div>)}</div></div>;

  if (section === 'documents') return <div className="tab-content"><Header title="Document Vault" subtitle="Central index for employee paperwork, resumes, training, write-ups and certifications." /><form style={{...card,marginBottom:18}} onSubmit={addDocument}><div style={grid}><select value={docForm.employee_id} onChange={e=>setDocForm(p=>({...p,employee_id:e.target.value}))}><option value="">No employee</option>{employees.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><select value={docForm.document_type} onChange={e=>setDocForm(p=>({...p,document_type:e.target.value}))}><option>training</option><option>resume</option><option>background_check</option><option>write_up</option><option>certification</option><option>policy</option><option>other</option></select><input required placeholder="Document title" value={docForm.title} onChange={e=>setDocForm(p=>({...p,title:e.target.value}))}/><input placeholder="Secure file URL" value={docForm.file_url} onChange={e=>setDocForm(p=>({...p,file_url:e.target.value}))}/><input type="date" value={docForm.expires_at} onChange={e=>setDocForm(p=>({...p,expires_at:e.target.value}))}/></div><textarea placeholder="Notes" value={docForm.notes} onChange={e=>setDocForm(p=>({...p,notes:e.target.value}))}/><button className="btn-primary"><FileText size={15}/> Save Record</button></form><div style={grid}>{documents.map(d=><div style={card} key={d.id}><strong>{d.title}</strong><p>{d.document_type.replaceAll('_',' ')} · {empName(d.employee_id)}</p>{d.file_url&&<a href={d.file_url} target="_blank" rel="noreferrer">Open document</a>}<small style={{display:'block',marginTop:8}}>Expires: {day(d.expires_at)}</small></div>)}</div></div>;

  if (section === 'permissions') return <Permissions profiles={profiles} employees={employees} setEmployees={setEmployees} onSave={saveProfileAccess} />;

  if (section === 'notifications') return <div className="tab-content"><Header title="Notifications Center" subtitle="Send announcements and operational alerts to employees or portal groups." /><form style={{...card,marginBottom:18}} onSubmit={addNotification}><div style={grid}><input required placeholder="Title" value={notificationForm.title} onChange={e=>setNotificationForm(p=>({...p,title:e.target.value}))}/><select value={notificationForm.target_employee_id} onChange={e=>setNotificationForm(p=>({...p,target_employee_id:e.target.value,target_portal_role:''}))}><option value="">No specific employee</option>{employees.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><select value={notificationForm.target_portal_role} onChange={e=>setNotificationForm(p=>({...p,target_portal_role:e.target.value,target_employee_id:''}))}><option value="">No portal group</option><option value="manager">Managers</option><option value="employee">Employees</option><option value="d2d">D2D</option><option value="recruiter">Recruiters</option><option value="finance">Finance</option></select><select value={notificationForm.notification_type} onChange={e=>setNotificationForm(p=>({...p,notification_type:e.target.value}))}><option>info</option><option>warning</option><option>success</option><option>urgent</option></select></div><textarea required placeholder="Message" value={notificationForm.message} onChange={e=>setNotificationForm(p=>({...p,message:e.target.value}))}/><button className="btn-primary"><Bell size={15}/> Send</button></form><div style={grid}>{notifications.map(n=><div style={card} key={n.id}><strong>{n.title}</strong><p>{n.message}</p><small>{n.target_portal_role||empName(n.target_employee_id)} · {dt(n.created_at)}</small></div>)}</div></div>;

  if (section === 'time_off') return <div className="tab-content"><Header title="Time-Off Requests" subtitle="Approve or decline employee PTO/unpaid time requests." /><div style={grid}>{timeOff.map(r=><div style={card} key={r.id}><strong>{empName(r.employee_id)}</strong><p>{day(r.start_date)} → {day(r.end_date)} · {r.request_type}</p><p>{r.reason}</p><div style={{display:'flex',gap:8}}><button className="btn-sm btn-primary" onClick={async()=>{await supabase.from('time_off_requests').update({status:'approved'}).eq('id',r.id);setTimeOff(p=>p.map(x=>x.id===r.id?{...x,status:'approved'}:x));}}>Approve</button><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('time_off_requests').update({status:'declined'}).eq('id',r.id);setTimeOff(p=>p.map(x=>x.id===r.id?{...x,status:'declined'}:x));}}>Decline</button><span className="status-badge badge-gray">{r.status}</span></div></div>)}</div></div>;

  if (section === 'payroll_approval') return <div className="tab-content"><Header title="Timesheet & Payroll Approval" subtitle="Review timecards, approve hours, then close payroll tracking periods." /><div style={{...card,marginBottom:18,overflowX:'auto'}}><h3><ClipboardCheck size={18}/> Timecards</h3><div className="data-table"><div className="data-table-head"><span>Employee</span><span>Clock In</span><span>Clock Out</span><span>Status</span><span>Action</span></div>{timeEntries.slice(0,150).map(t=><div className="data-table-row" key={t.id}><span>{empName(t.employee_id)}</span><span>{dt(t.clock_in)}</span><span>{dt(t.clock_out)}</span><span>{t.status}</span><div><button className="btn-sm btn-primary" onClick={()=>approveTime(t,'approved')}>Approve</button> <button className="btn-sm btn-outline" onClick={()=>approveTime(t,'needs_review')}>Review</button></div></div>)}</div></div><form style={{...card,marginBottom:18}} onSubmit={addPayrollRun}><h3>Close a Pay Period</h3><div style={grid}><input required type="date" value={payrollForm.period_start} onChange={e=>setPayrollForm(p=>({...p,period_start:e.target.value}))}/><input required type="date" value={payrollForm.period_end} onChange={e=>setPayrollForm(p=>({...p,period_end:e.target.value}))}/><input placeholder="Notes" value={payrollForm.notes} onChange={e=>setPayrollForm(p=>({...p,notes:e.target.value}))}/></div><button className="btn-primary">Create Payroll Run</button></form><div style={grid}>{payrollRuns.map(r=><div style={card} key={r.id}><strong>{day(r.period_start)} – {day(r.period_end)}</strong><h3>{money(Number(r.gross_pay||0))}</h3><span>{r.status}</span>{r.status!=='approved'&&<button className="btn-sm btn-primary" style={{marginLeft:10}} onClick={async()=>{await supabase.from('payroll_runs').update({status:'approved',approved_at:new Date().toISOString()}).eq('id',r.id);setPayrollRuns(p=>p.map(x=>x.id===r.id?{...x,status:'approved'}:x));}}>Approve</button>}</div>)}</div></div>;

  if (section === 'reports') {
    const completed = payments.filter(p=>p.status==='completed'); const revenue=completed.reduce((s,p)=>s+Number(p.amount),0); const expenseTotal=expenses.reduce((s,e)=>s+Number(e.amount),0); const avg=completed.length?revenue/completed.length:0; const completedJobs=appointments.filter(a=>a.status==='completed').length; const canceled=appointments.filter(a=>a.status==='cancelled').length;
    return <div className="tab-content"><Header title="Reports & Analytics" subtitle="Operational KPIs across sales, customers, labor and field performance." /><div style={grid}><Metric label="Collected Revenue" value={money(revenue)}/><Metric label="Tracked Expenses" value={money(expenseTotal)}/><Metric label="Operating Margin (before tax)" value={money(revenue-expenseTotal)}/><Metric label="Average Ticket" value={money(avg)}/><Metric label="Completed Details" value={String(completedJobs)}/><Metric label="Cancellations" value={String(canceled)}/><Metric label="D2D Conversion" value={`${leadMetrics.conversion.toFixed(1)}%`}/><Metric label="Lead Revenue" value={money(leadMetrics.value)}/></div><div style={{...card,marginTop:18}}><h3><Gauge size={18}/> What to watch</h3><p>Use labor %, average ticket, repeat customer rate, cancellations, add-on attach rate and D2D conversion as your weekly owner scorecard. Finance figures here are operational estimates, not tax filings.</p></div></div>;
  }

  if (section === 'audit') return <div className="tab-content"><Header title="Audit Log" subtitle="History of important operational and permission changes." /><div style={{...card,overflowX:'auto'}}><div className="data-table"><div className="data-table-head"><span>Action</span><span>Entity</span><span>When</span><span>Details</span></div>{auditLogs.map(a=><div className="data-table-row" key={a.id}><strong>{a.action}</strong><span>{a.entity_type} {a.entity_id?.slice(0,8)}</span><span>{dt(a.created_at)}</span><span style={{fontSize:12,color:'#888'}}>{JSON.stringify(a.details).slice(0,100)}</span></div>)}</div></div></div>;

  return null;
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={card}><span style={{color:'#888',fontSize:12,textTransform:'uppercase',letterSpacing:1}}>{label}</span><h2 style={{margin:'8px 0 0'}}>{value}</h2></div>; }

function Permissions({ profiles, employees, setEmployees, onSave }: { profiles: Profile[]; employees: Employee[]; setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>; onSave: (person: Profile, role: PortalRole, permissions: Record<string, boolean>) => Promise<void> }) {
  const [selected, setSelected] = useState<string>(profiles[0]?.id || '');
  useEffect(()=>{if(!selected&&profiles[0])setSelected(profiles[0].id)},[profiles,selected]);
  const person=profiles.find(p=>p.id===selected); const [role,setRole]=useState<PortalRole>('customer'); const [perms,setPerms]=useState<Record<string,boolean>>({}); const [linkEmployeeId,setLinkEmployeeId]=useState('');
  useEffect(()=>{if(person){const r=(person.role==='admin'?'owner':person.portal_role||'customer') as PortalRole;setRole(r);setPerms(person.role==='admin'?DEFAULT_ROLE_PERMISSIONS.owner:{...DEFAULT_ROLE_PERMISSIONS[r],...(person.permissions||{})});setLinkEmployeeId(employees.find(e=>e.user_id===person.id)?.id||employees.find(e=>e.email?.toLowerCase()===person.email?.toLowerCase())?.id||'');}},[person?.id,employees]);
  const applyRole=(r:PortalRole)=>{setRole(r);setPerms({...DEFAULT_ROLE_PERMISSIONS[r]});};
  const inviteEmployee=async(emp:Employee)=>{if(!emp.email)return alert('Add an email to the employee first.');const portal_role:PortalRole=emp.role==='d2d_agent'?'d2d':emp.role==='manager'?'manager':'employee';const {data,error}=await supabase.functions.invoke('invite-employee',{body:{employee_id:emp.id,portal_role,redirect_to:`${window.location.origin}/reset-password`}});if(error)return alert(error.message);alert(data?.invited?'Invite sent and employee linked.':'Existing login found and linked.');window.location.reload();};
  const linkEmployee=async()=>{if(!person||!linkEmployeeId)return; const {error}=await supabase.from('employees').update({user_id:person.id}).eq('id',linkEmployeeId); if(error)return alert(error.message); setEmployees(p=>p.map(e=>e.id===linkEmployeeId?{...e,user_id:person.id}:e.user_id===person.id?{...e,user_id:null}:e)); await audit('employee.login_linked','employee',linkEmployeeId,{profile_id:person.id});};
  return <div className="tab-content"><Header title="Portal Permissions" subtitle="Choose portals and permissions, or send an employee login invite that links automatically." /><div style={{...card,marginBottom:18}}><h3>Employee Account Setup</h3><p style={{color:'#999'}}>Unlinked employees can be invited here. Their role chooses the starting portal automatically.</p><div className="invite-employee-grid">{employees.filter(e=>!e.user_id&&e.status!=='inactive').map(e=><div className="invite-employee-row" key={e.id}><div><strong>{e.name}</strong><small>{e.email||'Email required'} · {e.role.replaceAll('_',' ')}</small></div><button className="btn-sm btn-primary" disabled={!e.email} onClick={()=>inviteEmployee(e)}>Send / Link Invite</button></div>)}</div></div>
    <div style={{display:'grid',gridTemplateColumns:'300px minmax(0,1fr)',gap:18}}><div style={card}><h3><Users size={18}/> Accounts</h3>{profiles.map(p=><button key={p.id} onClick={()=>setSelected(p.id)} style={{display:'block',width:'100%',textAlign:'left',padding:12,marginBottom:6,borderRadius:8,border:p.id===selected?'1px solid #c9a96e':'1px solid #292929',background:p.id===selected?'#19160f':'#0d0d0d',color:'#fff'}}><strong>{p.full_name||p.email||'Account'}</strong><small style={{display:'block',color:'#888'}}>{p.email} · {roleLabel(p.role==='admin'?'owner':p.portal_role)}</small></button>)}</div>
      {person&&<div style={card}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}><div><h3><UserCog size={18}/> {person.full_name||person.email}</h3><p style={{color:'#888'}}>{person.email}</p></div><button className="btn-primary" onClick={()=>onSave(person,role,perms)}><Save size={15}/> Save Access</button></div><div className="form-group"><label>Portal</label><select value={role} disabled={person.role==='admin'} onChange={e=>applyRole(e.target.value as PortalRole)}><option value="customer">Customer Portal</option><option value="manager">Manager Portal</option><option value="employee">Employee Portal</option><option value="d2d">D2D Sales Portal</option><option value="recruiter">Recruiting / Manager Portal</option><option value="finance">Finance / Manager Portal</option><option value="owner">Owner / Admin</option></select></div><div className="form-group"><label>Linked Employee Record</label><div style={{display:'flex',gap:8}}><select value={linkEmployeeId} onChange={e=>setLinkEmployeeId(e.target.value)}><option value="">Not linked</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.role.replaceAll('_',' ')} L{e.employment_level||1}</option>)}</select><button type="button" className="btn-outline" onClick={linkEmployee}>Link</button></div></div>{PERMISSION_GROUPS.map(g=><div key={g.label} style={{borderTop:'1px solid #242424',paddingTop:14,marginTop:14}}><strong>{g.label}</strong><div style={{...grid,marginTop:10}}>{g.permissions.map(([key,label])=><label key={key} style={{display:'flex',gap:10,alignItems:'start',fontSize:13}}><input type="checkbox" checked={Boolean(perms[key])} onChange={e=>setPerms(p=>({...p,[key]:e.target.checked}))}/><span>{label}<small style={{display:'block',color:'#777'}}>{key}</small></span></label>)}</div></div>)}<div style={{marginTop:18,padding:12,background:'#0b0b0b',borderRadius:10,color:'#aaa'}}>Employee account link: {employees.find(e=>e.user_id===person.id)?.name||'No employee profile linked to this login yet.'}</div></div>}</div>
  </div>;
}
