import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, CreditCard, UserCheck, Car,
  TrendingUp, BarChart2, LogOut, Menu, X, Plus, Trash2,
  Eye, DollarSign, Activity, ChevronUp, Globe, Archive,
  BriefcaseBusiness, CalendarClock, Clock3, PackageSearch, Settings2,
  Target, MapPinned, ListChecks, Wrench, FileText, ShieldCheck, Bell,
  ClipboardCheck, ScrollText, UserCog, Gauge, MessageCircle, Search
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Profile, Appointment, Payment, Employee } from '@/lib/supabase';
import { money } from '@/lib/data';
import { sendCommunication } from '@/lib/communications';
import BusinessSuite, { BusinessSection } from './BusinessSuite';
import EnterpriseSuite, { EnterpriseSection } from './EnterpriseSuite';
import OperationsExpansion, { ExpansionSection } from './OperationsExpansion';
import Phase300Suite from './Phase300Suite';
import TeamMessaging from '@/components/TeamMessaging';

type AdminTab =
  | 'dashboard'
  | 'customers'
  | 'appointments'
  | 'schedule'
  | 'availability'
  | 'archived'
  | 'employees'
  | 'recruiting'
  | 'staff_schedule'
  | 'timeclock'
  | 'finance'
  | 'sales'
  | 'inventory'
  | 'pay_settings'
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
  | 'audit'
  | 'payments'
  | 'visitors'
  | 'command_center' | 'crm' | 'dispatch' | 'crews' | 'fleet' | 'locations' | 'marketing' | 'automations' | 'approvals' | 'incidents' | 'training' | 'purchasing' | 'communications' | 'messages' | 'retention' | 'continuity';

function StatCard({ label, value, icon: Icon, trend, color = '' }: { label: string; value: string; icon: any; trend?: string; color?: string }) {
  return (
    <div className={`admin-stat ${color}`}>
      <div className="admin-stat-header">
        <span>{label}</span>
        <div className="admin-stat-icon"><Icon size={18} /></div>
      </div>
      <strong>{value}</strong>
      {trend && (
        <div className="admin-stat-trend">
          <ChevronUp size={14} /> {trend}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'badge-yellow', confirmed: 'badge-blue', in_progress: 'badge-purple',
    completed: 'badge-green', cancelled: 'badge-red', active: 'badge-green',
    paused: 'badge-yellow', inactive: 'badge-gray',
    detailer: 'badge-blue', d2d_agent: 'badge-purple', manager: 'badge-green',
  };
  return <span className={`status-badge ${colors[status] ?? 'badge-gray'}`}>{status.replace('_', ' ')}</span>;
}

export default function Admin() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const siteUrl=(import.meta.env.VITE_SITE_URL||'https://www.northsplash.com').replace(/\/$/,'');
  const [tab, setTab] = useState<AdminTab>(() => {
    const initial = new URLSearchParams(window.location.search).get('view');
    return (initial || 'dashboard') as AdminTab;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen,setCommandOpen]=useState(false);
  const [commandQuery,setCommandQuery]=useState('');

  const [customers, setCustomers] = useState<Profile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visits, setVisits] = useState<{ page: string; count: number }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [availability, setAvailability] = useState<any[]>([]);
const [availabilityForm, setAvailabilityForm] = useState({
  date: '',
  start_time: '09:00',
  end_time: '17:00',
  slot_minutes: 60,
  is_available: true,
});

  // Employee form
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', role: 'detailer', phone: '', email: '', employment_level: 1, pay_type: 'hourly', hourly_rate: 17, weekly_base: 0, commission_rate: 0 });
  const [empSubmitting, setEmpSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) {
      navigate('/portal');
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'dashboard') url.searchParams.delete('view');
    else url.searchParams.set('view', tab);
    window.history.replaceState({}, '', url);
  }, [tab]);

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(true)}};
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    (async () => {
      const [custs, apts, pays, emps, avail] = await Promise.all([
  supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false }),

  supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100),

  supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200),

  supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false }),

  supabase
    .from('availability')
    .select('*')
    .order('date', { ascending: true }),
]);

      // Aggregate site visits by page
      const { data: visitData } = await supabase
        .from('site_visits')
        .select('page')
        .gte('visited_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const pageMap: Record<string, number> = {};
      (visitData ?? []).forEach(v => { pageMap[v.page] = (pageMap[v.page] ?? 0) + 1; });
      const visitAgg = Object.entries(pageMap).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count);

      setCustomers(custs.data ?? []);
      setAppointments(apts.data ?? []);
      setPayments(pays.data ?? []);
      setEmployees(emps.data ?? []);
      setAvailability(avail.data ?? []);
      setVisits(visitAgg);
      setDataLoading(false);
    })();
  }, [user, profile]);

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const monthRevenue = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.status === 'completed';
  }).reduce((s, p) => s + p.amount, 0);

  const detailers = employees.filter(e => e.role === 'detailer');
  const d2dAgents = employees.filter(e => e.role === 'd2d_agent');

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpSubmitting(true);
    const { data, error } = await supabase.from('employees').insert(empForm).select().single();
    if (error) {
      alert(error.message);
      setEmpSubmitting(false);
      return;
    }
    if (data) setEmployees(prev => [data, ...prev]);
    setEmpSubmitting(false);
    setShowEmpForm(false);
    setEmpForm({ name: '', role: 'detailer', phone: '', email: '', employment_level: 1, pay_type: 'hourly', hourly_rate: 17, weekly_base: 0, commission_rate: 0 });
  };

  const handleDeleteEmployee = async (id: string) => {
    await supabase.from('employees').delete().eq('id', id);
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateAptStatus = async (id: string, status: string) => {
    const current = appointments.find(a => a.id === id);
    const { data, error } = await supabase.from('appointments').update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) }).eq('id', id).select().single();
    if (error) return alert(error.message);
    setAppointments(prev => prev.map(a => a.id === id ? data : a));
    const email = data?.customer_email || current?.customer_email;
    const event = status === 'confirmed' ? 'booking_confirmed' : status === 'cancelled' ? 'appointment_cancelled' : status === 'completed' ? 'job_completed' : null;
    if (event && email) sendCommunication(event, { appointment_id:id, recipient_email:email, variables:{ customer_name:data?.customer_name||current?.customer_name||'Customer', service_name:data?.service_name||current?.service_name||'Detailing service', appointment_time:data?.scheduled_at?new Date(data.scheduled_at).toLocaleString():'' } }).catch(console.warn);
  };

const handleArchiveAppointment = async (id: string) => {
  const { error } = await supabase
    .from('appointments')
    .update({ archived: true })
    .eq('id', id);

  if (error) {
    alert(error.message);
    return;
  }

  setAppointments(prev =>
    prev.map(a =>
      a.id === id ? { ...a, archived: true } : a
    )
  );
};
  
const handleSaveAvailability = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!availabilityForm.date) return;

  const { data, error } = await supabase
    .from('availability')
    .upsert(
      {
        date: availabilityForm.date,
        start_time: availabilityForm.start_time,
        end_time: availabilityForm.end_time,
        slot_minutes: availabilityForm.slot_minutes,
        is_available: availabilityForm.is_available,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'date',
      }
    )
    .select()
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  setAvailability(prev => {
    const exists = prev.some(a => a.date === data.date);

    if (exists) {
      return prev
        .map(a => a.date === data.date ? data : a)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return [...prev, data].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  });

  setAvailabilityForm({
    date: '',
    start_time: '09:00',
    end_time: '17:00',
    slot_minutes: 60,
    is_available: true,
  });
};

const handleDeleteAvailability = async (id: string) => {
  const { error } = await supabase
    .from('availability')
    .delete()
    .eq('id', id);

  if (error) {
    alert(error.message);
    return;
  }

  setAvailability(prev => prev.filter(a => a.id !== id));
};
  
  const handleSignOut = async () => {
    await signOut().catch(() => {});
    navigate('/');
  };

  if (loading || dataLoading) {
    return <div className="portal-loading"><div className="portal-spinner" /><p>Loading admin panel...</p></div>;
  }

  if (profile?.role !== 'admin') {
    return <div className="portal-loading"><p>Access denied. Admin only.</p><Link to="/portal">Go to Portal</Link></div>;
  }

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'customers' as AdminTab, label: 'Customers', Icon: Users },
    { id: 'appointments' as AdminTab, label: 'Appointments', Icon: Calendar },
    { id: 'schedule' as AdminTab, label: 'Customer Schedule', Icon: CalendarClock },
    { id: 'availability' as AdminTab, label: 'Availability', Icon: Calendar },
    { id: 'archived' as AdminTab, label: 'Archived Details', Icon: Archive },
    { id: 'recruiting' as AdminTab, label: 'Recruiting', Icon: BriefcaseBusiness },
    { id: 'employees' as AdminTab, label: 'Team', Icon: UserCheck },
    { id: 'staff_schedule' as AdminTab, label: 'Employee Schedule', Icon: CalendarClock },
    { id: 'timeclock' as AdminTab, label: 'Time Clock', Icon: Clock3 },
    { id: 'payroll_approval' as AdminTab, label: 'Timesheet Approval', Icon: ClipboardCheck },
    { id: 'job_assignments' as AdminTab, label: 'Job Assignment', Icon: ListChecks },
    { id: 'sales' as AdminTab, label: 'D2D Sales', Icon: TrendingUp },
    { id: 'leads' as AdminTab, label: 'Leads Tracker', Icon: Target },
    { id: 'territories' as AdminTab, label: 'Territories', Icon: MapPinned },
    { id: 'finance' as AdminTab, label: 'Finance & Payroll', Icon: DollarSign },
    { id: 'reports' as AdminTab, label: 'Reports & Analytics', Icon: Gauge },
    { id: 'inventory' as AdminTab, label: 'Inventory', Icon: PackageSearch },
    { id: 'equipment' as AdminTab, label: 'Equipment & Assets', Icon: Wrench },
    { id: 'tasks' as AdminTab, label: 'Tasks & Operations', Icon: ListChecks },
    { id: 'time_off' as AdminTab, label: 'Time-Off Requests', Icon: CalendarClock },
    { id: 'documents' as AdminTab, label: 'Document Vault', Icon: FileText },
    { id: 'notifications' as AdminTab, label: 'Notifications', Icon: Bell },
    { id: 'pay_settings' as AdminTab, label: 'Pay Structure', Icon: Settings2 },
    { id: 'permissions' as AdminTab, label: 'Portal Permissions', Icon: ShieldCheck },
    { id: 'audit' as AdminTab, label: 'Audit Log', Icon: ScrollText },
    { id: 'command_center' as AdminTab, label: 'Command Center', Icon: Gauge },
    { id: 'crm' as AdminTab, label: 'Customer CRM', Icon: Users },
    { id: 'dispatch' as AdminTab, label: 'Dispatch Board', Icon: CalendarClock },
    { id: 'crews' as AdminTab, label: 'Crew Command', Icon: Users },
    { id: 'fleet' as AdminTab, label: 'Fleet Accounts', Icon: Car },
    { id: 'locations' as AdminTab, label: 'Locations', Icon: Globe },
    { id: 'marketing' as AdminTab, label: 'Marketing', Icon: TrendingUp },
    { id: 'automations' as AdminTab, label: 'Automations', Icon: Settings2 },
    { id: 'approvals' as AdminTab, label: 'Approvals', Icon: ClipboardCheck },
    { id: 'incidents' as AdminTab, label: 'Incidents', Icon: ShieldCheck },
    { id: 'training' as AdminTab, label: 'Training', Icon: FileText },
    { id: 'purchasing' as AdminTab, label: 'Purchasing', Icon: PackageSearch },
    { id: 'communications' as AdminTab, label: 'Communications', Icon: Bell },
    { id: 'messages' as AdminTab, label: 'Team Messages', Icon: MessageCircle },
    { id: 'retention' as AdminTab, label: 'Retention', Icon: Target },
    { id: 'continuity' as AdminTab, label: 'Backups & Exports', Icon: Archive },
    { id: 'payments' as AdminTab, label: 'Payments', Icon: CreditCard },
    { id: 'visitors' as AdminTab, label: 'Site Visitors', Icon: Globe },
  ];

  const workspaces = [
    {id:'home',label:'Home',Icon:LayoutDashboard,items:['dashboard','command_center'] as AdminTab[]},
    {id:'sales',label:'Sales',Icon:Target,items:['sales','leads','territories','marketing','retention'] as AdminTab[]},
    {id:'customers',label:'Customers',Icon:Users,items:['customers','crm','appointments','schedule','availability','archived','fleet'] as AdminTab[]},
    {id:'operations',label:'Operations',Icon:ListChecks,items:['dispatch','job_assignments','inventory','equipment','tasks','documents','notifications','purchasing','incidents','approvals'] as AdminTab[]},
    {id:'people',label:'People',Icon:UserCheck,items:['employees','crews','recruiting','messages','staff_schedule','timeclock','time_off','payroll_approval','training'] as AdminTab[]},
    {id:'finance',label:'Finance',Icon:DollarSign,items:['finance','payments','reports','pay_settings'] as AdminTab[]},
    {id:'admin',label:'Admin',Icon:Settings2,items:['permissions','communications','automations','locations','continuity','audit','visitors'] as AdminTab[]},
  ];
  const workspaceForTab=(id:AdminTab)=>workspaces.find(w=>w.items.includes(id))??workspaces[0];
  const currentWorkspace=workspaceForTab(tab);

  // Monthly cashflow chart data (last 6 months)
  const cashflowData = (() => {
    const months: { label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const revenue = payments.filter(p => {
        const pd = new Date(p.created_at);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === 'completed';
      }).reduce((s, p) => s + p.amount, 0);
      months.push({ label, revenue });
    }
    return months;
  })();
  const maxRevenue = Math.max(...cashflowData.map(m => m.revenue), 1);

  return (
    <div className="portal-layout">
      <aside className={`portal-sidebar admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/admin" className="sidebar-brand">
            <div className="brand-mark brand-mark-sm">NS</div>
            <div><strong>ADMIN PANEL</strong><small>NORTH SPLASH</small></div>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar admin-avatar">A</div>
          <div><p>{profile?.full_name ?? 'Admin'}</p><span>Administrator</span></div>
        </div>

        <nav className="sidebar-nav os-workspace-nav">
          <div className="os-sidebar-section-label">WORKSPACES</div>
          {workspaces.map(w=>{
            const active=currentWorkspace.id===w.id;
            return <button key={w.id} className={`os-workspace-button ${active?'active':''}`} onClick={()=>{setTab(w.items[0]);setSidebarOpen(false)}}>
              <span className="os-workspace-icon"><w.Icon size={18}/></span>
              <span>{w.label}</span>
              <small>{w.items.length}</small>
            </button>
          })}
          <div className="os-sidebar-section-label os-sidebar-section-gap">PINNED</div>
          {(['command_center','appointments','leads'] as AdminTab[]).map(id=>{const item=navItems.find(n=>n.id===id);if(!item)return null;const {Icon,label}=item;return <button key={id} className={`os-pinned-link ${tab===id?'active':''}`} onClick={()=>{setTab(id);setSidebarOpen(false)}}><Icon size={16}/><span>{label}</span></button>})}
        </nav>

        <div className="sidebar-footer">
          <Link to="/portal" className="sidebar-item"><Eye size={18} /> Customer View</Link>
          <a href={siteUrl} className="sidebar-item"><Globe size={18} /> View Site</a>
          <button className="sidebar-item sidebar-signout" onClick={handleSignOut}><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="portal-main">
        <div className="portal-topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title"><span>{currentWorkspace.label}</span><h1>{navItems.find(n => n.id === tab)?.label}</h1></div>
          <div className="os-topbar-actions">
            <button className="os-command-trigger" onClick={()=>setCommandOpen(true)}><Search size={16}/><span>Search workspace</span><kbd>⌘ K</kbd></button>
            <button className="btn-primary btn-sm" onClick={()=>setTab('appointments')}><Plus size={15}/> New work</button>
          </div>
        </div>
        <div className="os-secondary-nav">
          <div className="os-secondary-nav-scroll">
            {currentWorkspace.items.map(id=>{const item=navItems.find(n=>n.id===id);if(!item)return null;return <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{item.label}</button>})}
          </div>
          <div className="os-view-context"><span className="os-live-dot"/>Live workspace</div>
        </div>
        {commandOpen&&<div className="os-command-backdrop" onClick={()=>setCommandOpen(false)}><div className="os-command-palette" onClick={e=>e.stopPropagation()}>
          <div className="os-command-input"><Search size={18}/><input autoFocus placeholder="Search pages, customers, appointments or employees…" value={commandQuery} onChange={e=>setCommandQuery(e.target.value)}/><button onClick={()=>setCommandOpen(false)}>ESC</button></div>
          <div className="os-command-results">
            {navItems.filter(n=>n.label.toLowerCase().includes(commandQuery.toLowerCase())).slice(0,8).map(n=><button key={n.id} onClick={()=>{setTab(n.id);setCommandOpen(false);setCommandQuery('')}}><n.Icon size={16}/><span>{n.label}</span><small>Open workspace</small></button>)}
            {customers.filter(c=>[c.full_name,c.email,c.phone].filter(Boolean).join(' ').toLowerCase().includes(commandQuery.toLowerCase())).slice(0,5).map(c=><button key={c.id} onClick={()=>{setTab('crm');setCommandOpen(false)}}><Users size={16}/><span>{c.full_name||c.email||'Customer'}</span><small>{c.email||c.phone||'Customer'}</small></button>)}
            {employees.filter(e=>[e.name,e.email,e.role].filter(Boolean).join(' ').toLowerCase().includes(commandQuery.toLowerCase())).slice(0,5).map(e=><button key={e.id} onClick={()=>{setTab('employees');setCommandOpen(false)}}><UserCheck size={16}/><span>{e.name}</span><small>{e.role}</small></button>)}
          </div>
        </div></div>}

        <div className="portal-content">

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="admin-dashboard">
              <div className="admin-stats-row">
                <StatCard label="Total Revenue" value={money(totalRevenue)} icon={DollarSign} color="stat-gold" />
                <StatCard label="This Month" value={money(monthRevenue)} icon={TrendingUp} color="stat-green" />
                <StatCard label="Customers" value={String(customers.length)} icon={Users} />
                <StatCard label="Appointments" value={String(appointments.length)} icon={Calendar} />
                <StatCard label="Team Members" value={String(employees.length)} icon={UserCheck} />
                <StatCard label="Site Visits (30d)" value={String(visits.reduce((s, v) => s + v.count, 0))} icon={Activity} />
              </div>

              {/* Cashflow Chart */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3><BarChart2 size={18} /> Monthly Cash Flow</h3>
                </div>
                <div className="cashflow-chart">
                  {cashflowData.map(m => (
                    <div key={m.label} className="cashflow-bar-wrap">
                      <div className="cashflow-amount">{m.revenue > 0 ? money(m.revenue) : '—'}</div>
                      <div className="cashflow-bar-bg">
                        <div
                          className="cashflow-bar-fill"
                          style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <div className="cashflow-label">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-two-col">
                {/* Recent appointments */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3><Calendar size={18} /> Recent Appointments</h3>
                    <button className="btn-outline btn-sm" onClick={() => setTab('appointments')}>View All</button>
                  </div>
                  <div className="admin-table">
                    {appointments.slice(0, 5).map(a => (
                      <div key={a.id} className="admin-row">
                        <div className="admin-row-main">
                          <strong>{a.service_name}</strong>
<span>
  {a.scheduled_at
    ? new Date(a.scheduled_at).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not scheduled'}
</span>                        </div>
                        <div className="admin-row-right">
                          <StatusBadge status={a.status} />
                          <strong>{money(a.price)}</strong>
                        </div>
                      </div>
                    ))}
                    {appointments.length === 0 && <p className="empty-text">No appointments yet.</p>}
                  </div>
                </div>

                {/* Detailer breakdown */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3><UserCheck size={18} /> Team Overview</h3>
                    <button className="btn-outline btn-sm" onClick={() => setTab('employees')}>View All</button>
                  </div>
                  <div className="team-overview">
                    <div className="team-stat">
                      <Car size={18} />
                      <div>
                        <strong>{detailers.length}</strong>
                        <span>Detailers</span>
                      </div>
                    </div>
                    <div className="team-stat">
                      <Users size={18} />
                      <div>
                        <strong>{d2dAgents.length}</strong>
                        <span>D2D Agents</span>
                      </div>
                    </div>
                    <div className="team-stat">
                      <UserCheck size={18} />
                      <div>
                        <strong>{employees.filter(e => e.role === 'manager').length}</strong>
                        <span>Managers</span>
                      </div>
                    </div>
                  </div>
                  {employees.slice(0, 4).map(e => (
                    <div key={e.id} className="admin-row">
                      <div className="admin-row-main">
                        <strong>{e.name}</strong>
                        <StatusBadge status={e.role} /><span className="status-badge badge-gray">Level {e.employment_level ?? 1}</span>
                      </div>
                      <div className="admin-row-right">
                        <span>{e.jobs_completed} jobs</span>
                      </div>
                    </div>
                  ))}
                  {employees.length === 0 && <p className="empty-text">No team members yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMERS */}
          {tab === 'customers' && (
            <div className="tab-content">
              <div className="tab-header">
                <div><h2>Customers</h2><p>{customers.length} registered · {Array.from(new Set(appointments.filter(a=>!a.user_id&&a.customer_email).map(a=>a.customer_email))).length} guest booking contacts</p></div>
              </div>
              <div className="admin-card">
                <div className="data-table">
                  <div className="data-table-head">
                    <span>Name</span><span>Email</span><span>Joined</span><span>Status</span>
                  </div>
                  {customers.map(c => (
                    <div key={c.id} className="data-table-row">
                      <div className="dt-cell dt-name">
                        <div className="dt-avatar">{c.full_name?.[0]?.toUpperCase() ?? '?'}</div>
                        <div>
                          <strong>{c.full_name ?? 'Unknown'}</strong>
                          {c.phone && <span>{c.phone}</span>}
                        </div>
                      </div>
                      <span className="dt-cell">{c.email ?? '—'}</span>
                      <span className="dt-cell">{new Date(c.created_at).toLocaleDateString()}</span>
                      <span className="dt-cell"><StatusBadge status="active" /></span>
                    </div>
                  ))}
                  {Array.from(new Map(appointments.filter(a=>!a.user_id&&(a.customer_email||a.customer_name)).map(a=>[a.customer_email||a.customer_phone||a.customer_name,a])).values()).map(a => (
                    <div key={`guest-${a.id}`} className="data-table-row guest-customer-row">
                      <div className="dt-cell dt-name"><div className="dt-avatar">{(a.customer_name||a.customer_email||'G')[0].toUpperCase()}</div><div><strong>{a.customer_name||'Guest customer'}</strong>{a.customer_phone&&<span>{a.customer_phone}</span>}</div></div>
                      <span className="dt-cell">{a.customer_email||'—'}</span>
                      <span className="dt-cell">{new Date(a.created_at).toLocaleDateString()}</span>
                      <span className="dt-cell"><span className="status-badge badge-yellow">booking contact</span></span>
                    </div>
                  ))}
                  {customers.length === 0 && appointments.every(a=>a.user_id) && <p className="empty-text">No customers yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === 'appointments' && (
            <div className="tab-content">
              <div className="tab-header">
                <div><h2>All Appointments</h2><p>{appointments.length} total</p></div>
              </div>
              <div className="admin-card">
                <div className="data-table">
                  <div className="data-table-head">
                    <span>Service</span><span>Price</span><span>Status</span><span>Date</span><span>Actions</span>
                  </div>
                  {appointments
  .filter(a => !a.archived)
  .map(a => (
                    <div key={a.id} className="data-table-row">
                      <div className="dt-cell dt-service">
                        <strong>{a.service_name}</strong>
                        {a.add_ons.length > 0 && <span>+{a.add_ons.length} add-on{a.add_ons.length > 1 ? 's' : ''}</span>}
                      </div>
                      <span className="dt-cell"><strong>{money(a.price)}</strong></span>
                      <span className="dt-cell"><StatusBadge status={a.status} /></span>
<span className="dt-cell">
  {a.scheduled_at
    ? new Date(a.scheduled_at).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not scheduled'}
</span>                      <div className="dt-cell dt-actions">
                        {a.status !== 'completed' && a.status !== 'cancelled' && (
                          <>
                            <button className="btn-sm btn-outline" onClick={() => handleUpdateAptStatus(a.id, 'confirmed')}>Confirm</button>
                            <button
  className="btn-sm btn-outline"
  onClick={() => handleUpdateAptStatus(a.id, 'cancelled')}
>
  Decline
</button>

                            <button
  className="btn-sm btn-outline"
  onClick={() => handleArchiveAppointment(a.id)}
>
  Archive
</button>
                            
                            <button className="btn-sm btn-primary" onClick={() => handleUpdateAptStatus(a.id, 'completed')}>Complete</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {appointments.length === 0 && <p className="empty-text">No appointments yet.</p>}
                </div>
              </div>
            </div>
          )}

{/* ARCHIVED DETAILS */}
{tab === 'archived' && (
  <div className="tab-content">
    <div className="tab-header">
      <div>
        <h2>Archived Details</h2>
        <p>Past or cleared appointments are stored here.</p>
      </div>
    </div>

    <div className="admin-card">
      {appointments.filter(a => a.archived).length === 0 ? (
        <p className="empty-text">
          No archived appointments yet.
        </p>
      ) : (
        <div className="data-table">
          {appointments
            .filter(a => a.archived)
            .map(a => (
              <div key={a.id} className="data-table-row">
                <div className="dt-cell">
                  <strong>{a.service_name}</strong>

                  {a.scheduled_at && (
                    <span>
                      {new Date(a.scheduled_at).toLocaleString()}
                    </span>
                  )}
                </div>

                <span className="dt-cell">
                  {money(a.price)}
                </span>

                <span className="dt-cell">
                  <StatusBadge status={a.status} />
                </span>

                <button
                  className="btn-sm btn-outline"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('appointments')
                      .update({ archived: false })
                      .eq('id', a.id);

                    if (error) {
                      alert(error.message);
                      return;
                    }

                    setAppointments(prev =>
                      prev.map(item =>
                        item.id === a.id
                          ? { ...item, archived: false }
                          : item
                      )
                    );
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  </div>
)}
          
{/* SCHEDULE */}
{tab === 'schedule' && (
  <div className="tab-content">
    <div className="tab-header">
      <div>
        <h2>Booking Schedule</h2>
        <p>See who is booked, when they are coming, and what service they booked.</p>
      </div>
    </div>

    <div className="admin-card">
      <div className="data-table">
        <div className="data-table-head">
          <span>Customer</span>
          <span>Service</span>
          <span>Date & Time</span>
          <span>Price</span>
          <span>Status</span>
        </div>

        {appointments
          .filter(a => a.scheduled_at && a.status !== 'cancelled')
          .sort(
            (a, b) =>
              new Date(a.scheduled_at!).getTime() -
              new Date(b.scheduled_at!).getTime()
          )
          .map(a => {
            const customer = customers.find(c => c.id === a.user_id);

            return (
              <div key={a.id} className="data-table-row">
                <div className="dt-cell">
                  <strong>{customer?.full_name ?? 'Customer'}</strong>
                  <span>{customer?.email ?? ''}</span>
                </div>

                <div className="dt-cell">
                  <strong>{a.service_name}</strong>

                  {a.add_ons?.length > 0 && (
                    <span>
                      + {a.add_ons.join(', ')}
                    </span>
                  )}
                </div>

                <div className="dt-cell">
                  <strong>
                    {new Date(a.scheduled_at!).toLocaleDateString(
                      'en-US',
                      {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}
                  </strong>

                  <span>
                    {new Date(a.scheduled_at!).toLocaleTimeString(
                      'en-US',
                      {
                        hour: 'numeric',
                        minute: '2-digit',
                      }
                    )}
                  </span>
                </div>

                <span className="dt-cell">
                  <strong>{money(a.price)}</strong>
                </span>

                <span className="dt-cell">
                  <StatusBadge status={a.status} />
                </span>
              </div>
            );
          })}

        {appointments.filter(
          a => a.scheduled_at && a.status !== 'cancelled'
        ).length === 0 && (
          <p className="empty-text">
            No scheduled appointments yet.
          </p>
        )}
      </div>
    </div>
  </div>
)}
          
{/* AVAILABILITY */}
{tab === 'availability' && (
  <div className="tab-content">
    <div className="tab-header">
      <div>
        <h2>Booking Availability</h2>
        <p>Choose when customers are allowed to book appointments.</p>
      </div>
    </div>

    <form
      onSubmit={handleSaveAvailability}
      style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: '14px',
        padding: '24px',
        marginBottom: '30px',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Set Availability</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            required
            value={availabilityForm.date}
            onChange={e =>
              setAvailabilityForm(prev => ({
                ...prev,
                date: e.target.value,
              }))
            }
          />
        </div>

        <div className="form-group">
          <label>Start Time</label>
          <input
            type="time"
            value={availabilityForm.start_time}
            onChange={e =>
              setAvailabilityForm(prev => ({
                ...prev,
                start_time: e.target.value,
              }))
            }
          />
        </div>

        <div className="form-group">
          <label>End Time</label>
          <input
            type="time"
            value={availabilityForm.end_time}
            onChange={e =>
              setAvailabilityForm(prev => ({
                ...prev,
                end_time: e.target.value,
              }))
            }
          />
        </div>

        <div className="form-group">
          <label>Appointment Length</label>

          <select
            value={availabilityForm.slot_minutes}
            onChange={e =>
              setAvailabilityForm(prev => ({
                ...prev,
                slot_minutes: Number(e.target.value),
              }))
            }
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
          </select>
        </div>
      </div>

      <div
        style={{
          margin: '20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <input
          type="checkbox"
          checked={availabilityForm.is_available}
          onChange={e =>
            setAvailabilityForm(prev => ({
              ...prev,
              is_available: e.target.checked,
            }))
          }
        />

        <span>
          {availabilityForm.is_available
            ? 'Customers can book this day'
            : 'Block this entire day'}
        </span>
      </div>

      <button type="submit" className="btn-primary">
        Save Availability
      </button>
    </form>

    <div
      style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <h3>Upcoming Availability</h3>

      {availability.length === 0 ? (
        <p style={{ color: '#999' }}>
          No availability has been added yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {availability.map(item => (
            <div
              key={item.id}
              style={{
                border: '1px solid #292929',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>
                  {new Date(
                    `${item.date}T12:00:00`
                  ).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>

                <div
                  style={{
                    color: '#999',
                    marginTop: '5px',
                  }}
                >
                  {item.is_available
                    ? `${item.start_time.slice(0, 5)} – ${item.end_time.slice(0, 5)} • ${item.slot_minutes} minute slots`
                    : 'Closed / unavailable'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    setAvailabilityForm({
                      date: item.date,
                      start_time: item.start_time.slice(0, 5),
                      end_time: item.end_time.slice(0, 5),
                      slot_minutes: item.slot_minutes,
                      is_available: item.is_available,
                    })
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    handleDeleteAvailability(item.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
          
          {(['recruiting', 'staff_schedule', 'timeclock', 'finance', 'sales', 'inventory', 'pay_settings'] as BusinessSection[]).includes(tab as BusinessSection) && (
            <BusinessSuite
              section={tab as BusinessSection}
              employees={employees}
              setEmployees={setEmployees}
              completedRevenue={monthRevenue}
            />
          )}

          {(['command_center','crm','dispatch','crews','leads','territories','training','communications','automations'] as AdminTab[]).includes(tab) && (
            <Phase300Suite section={tab as any} employees={employees} appointments={appointments} setAppointments={setAppointments} customers={customers} payments={payments} />
          )}

          {(['job_assignments','tasks','equipment','documents','reports','permissions','notifications','time_off','payroll_approval','audit'] as AdminTab[]).includes(tab) && (
            <EnterpriseSuite
              section={tab as EnterpriseSection}
              employees={employees}
              setEmployees={setEmployees}
              appointments={appointments}
              setAppointments={setAppointments}
            />
          )}

          {(['fleet','locations','marketing','approvals','incidents','purchasing','retention','continuity'] as AdminTab[]).includes(tab) && (
            <OperationsExpansion section={tab as ExpansionSection} employees={employees} appointments={appointments} customers={customers} payments={payments} />
          )}


          {tab === 'messages' && (
            <div className="tab-content v2-page">
              <div className="v2-page-head"><div><span className="eyebrow">INTERNAL COMMUNICATION</span><h2>Team Messages</h2><p>Company, role, crew and private group messaging in one workspace.</p></div></div>
              <TeamMessaging employees={employees} portalKind="admin" />
            </div>
          )}

          {/* EMPLOYEES */}
          {tab === 'employees' && (
            <div className="tab-content">
              <div className="tab-header">
                <div><h2>Team Management</h2><p>{employees.length} team members</p></div>
                <button className="btn-primary" onClick={() => setShowEmpForm(true)}>
                  <Plus size={16} /> Add Member
                </button>
              </div>

              <div className="emp-sections">
                {[
                  { title: 'Detailers', roleKey: 'detailer' },
                  { title: 'D2D Agents', roleKey: 'd2d_agent' },
                  { title: 'Managers', roleKey: 'manager' },
                ].map(({ title, roleKey }) => {
                  const group = employees.filter(e => e.role === roleKey);
                  return (
                    <div key={roleKey} className="admin-card emp-group">
                      <div className="admin-card-header">
                        <h3>{title} <span className="emp-count">{group.length}</span></h3>
                      </div>
                      {group.length === 0 ? (
                        <p className="empty-text">No {title.toLowerCase()} added yet.</p>
                      ) : (
                        <div className="emp-grid">
                          {group.map(e => (
                            <div key={e.id} className="emp-card">
                              <div className="emp-avatar">{e.name[0].toUpperCase()}</div>
                              <div className="emp-info">
                                <strong>{e.name}</strong>
                                <span>{e.email ?? e.phone ?? '—'}</span>
                                <span className="emp-level">{e.role === 'd2d_agent' ? 'D2D Sales' : e.role.charAt(0).toUpperCase() + e.role.slice(1)} · Level {e.employment_level ?? 1}</span>
                              </div>
                              <div className="emp-stats">
                                <div><strong>{e.jobs_completed}</strong><span>Jobs</span></div>
                                <div><strong>{e.role === 'd2d_agent' ? `${e.commission_rate}%` : `$${Number(e.hourly_rate ?? 0).toFixed(0)}/hr`}</strong><span>{e.role === 'd2d_agent' ? 'Comm.' : 'Rate'}</span></div>
                              </div>
                              <StatusBadge status={e.status} />
                              <button className="emp-delete" onClick={() => handleDeleteEmployee(e.id)}><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {tab === 'payments' && (
            <div className="tab-content">
              <div className="tab-header">
                <div><h2>Payments & Cash Flow</h2></div>
              </div>

              <div className="admin-stats-row">
                <StatCard label="Total Revenue" value={money(totalRevenue)} icon={DollarSign} color="stat-gold" />
                <StatCard label="This Month" value={money(monthRevenue)} icon={TrendingUp} color="stat-green" />
                <StatCard label="Transactions" value={String(payments.length)} icon={CreditCard} />
                <StatCard label="Avg. Ticket" value={payments.length > 0 ? money(Math.round(totalRevenue / payments.length)) : '$0'} icon={BarChart2} />
              </div>

              <div className="admin-card">
                <div className="admin-card-header"><h3>Transaction History</h3></div>
                <div className="data-table">
                  <div className="data-table-head">
                    <span>Description</span><span>Amount</span><span>Method</span><span>Status</span><span>Date</span>
                  </div>
                  {payments.map(p => (
                    <div key={p.id} className="data-table-row">
                      <span className="dt-cell">{p.description ?? 'Service'}</span>
                      <span className="dt-cell"><strong>{money(p.amount)}</strong></span>
                      <span className="dt-cell">{p.payment_method}</span>
                      <span className="dt-cell"><StatusBadge status={p.status} /></span>
                      <span className="dt-cell">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {payments.length === 0 && <p className="empty-text">No payments recorded yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* VISITORS */}
          {tab === 'visitors' && (
            <div className="tab-content">
              <div className="tab-header">
                <div><h2>Site Visitors</h2><p>Last 30 days</p></div>
              </div>
              <div className="admin-stats-row">
                <StatCard label="Total Visits (30d)" value={String(visits.reduce((s, v) => s + v.count, 0))} icon={Eye} />
                <StatCard label="Pages Tracked" value={String(visits.length)} icon={Globe} />
              </div>
              <div className="admin-card">
                <div className="admin-card-header"><h3>Top Pages</h3></div>
                <div className="visitors-list">
                  {visits.map(v => {
                    const maxCount = visits[0]?.count ?? 1;
                    return (
                      <div key={v.page} className="visitor-row">
                        <span className="visitor-page">{v.page}</span>
                        <div className="visitor-bar-wrap">
                          <div className="visitor-bar" style={{ width: `${(v.count / maxCount) * 100}%` }} />
                        </div>
                        <strong className="visitor-count">{v.count}</strong>
                      </div>
                    );
                  })}
                  {visits.length === 0 && <p className="empty-text">No visits tracked yet. Visits are logged as users browse the site.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Employee Modal */}
      {showEmpForm && (
        <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Member</h3>
              <button onClick={() => setShowEmpForm(false)}><X size={20} /></button>
            </div>
            <form className="modal-form" onSubmit={handleAddEmployee}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input required value={empForm.name} onChange={e => setEmpForm(p => ({...p, name: e.target.value}))} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={empForm.role} onChange={e => {
                    const role = e.target.value;
                    setEmpForm(p => ({
                      ...p,
                      role,
                      employment_level: 1,
                      pay_type: role === 'd2d_agent' ? 'base_commission' : 'hourly',
                      hourly_rate: role === 'manager' ? 22 : role === 'detailer' ? 17 : 0,
                      weekly_base: role === 'd2d_agent' ? 300 : 0,
                      commission_rate: role === 'd2d_agent' ? 10 : 0,
                    }));
                  }}>
                    <option value="detailer">Detailer</option>
                    <option value="d2d_agent">D2D Sales</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={empForm.email} onChange={e => setEmpForm(p => ({...p, email: e.target.value}))} placeholder="team@northsplash.com" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="tel" value={empForm.phone} onChange={e => setEmpForm(p => ({...p, phone: e.target.value}))} placeholder="330-000-0000" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee Level</label>
                  <select value={empForm.employment_level} onChange={e => {
                    const level = Number(e.target.value);
                    const role = empForm.role;
                    const hourly = role === 'detailer' ? ({1:17,2:18,3:19} as Record<number,number>)[level] : role === 'manager' ? ({1:22,2:24,3:26} as Record<number,number>)[level] : 0;
                    const base = role === 'd2d_agent' ? ({1:300,2:350,3:400} as Record<number,number>)[level] : 0;
                    const comm = role === 'd2d_agent' ? ({1:10,2:12.5,3:15} as Record<number,number>)[level] : 0;
                    setEmpForm(p => ({...p, employment_level: level, hourly_rate: hourly, weekly_base: base, commission_rate: comm}));
                  }}>
                    <option value={1}>Level 1</option><option value={2}>Level 2</option><option value={3}>Level 3</option>
                  </select>
                </div>
                {empForm.role === 'd2d_agent' ? (
                  <div className="form-group"><label>Weekly Base</label><input type="number" value={empForm.weekly_base} onChange={e=>setEmpForm(p=>({...p,weekly_base:Number(e.target.value)}))}/></div>
                ) : (
                  <div className="form-group"><label>Hourly Rate</label><input type="number" step="0.25" value={empForm.hourly_rate} onChange={e=>setEmpForm(p=>({...p,hourly_rate:Number(e.target.value)}))}/></div>
                )}
              </div>
              {empForm.role === 'd2d_agent' && <div className="form-group">
                <label>Commission Rate (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={empForm.commission_rate} onChange={e => setEmpForm(p => ({...p, commission_rate: Number(e.target.value)}))} />
              </div>}
              <button type="submit" className="btn-primary btn-full" disabled={empSubmitting}>
                {empSubmitting ? 'Adding...' : 'Add Team Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
