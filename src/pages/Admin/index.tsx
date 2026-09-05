import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, CreditCard, UserCheck, Car,
  TrendingUp, BarChart2, LogOut, Menu, X, Plus, Trash2,
  Eye, DollarSign, Activity, ChevronUp, Globe, Archive,
  BriefcaseBusiness, CalendarClock, Clock3, PackageSearch, Settings2,
  Target, MapPinned, ListChecks, Wrench, FileText, ShieldCheck, Bell,
  ClipboardCheck, ScrollText, UserCog, Gauge, MessageCircle, Search, MoreHorizontal, CheckCircle2, Mail, Phone
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
import AdminDataManager from '@/components/AdminDataManager';
import OwnerProfitTracker from './OwnerProfitTracker';
import OwnerGrowthPlanner from './OwnerGrowthPlanner';
import OwnerPaymentTest from './OwnerPaymentTest';
import AdminTeamCalendar from '@/components/AdminTeamCalendar';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import EmployeeProfileDrawer from '@/components/EmployeeProfileDrawer';
import AddEmployeeForm from '@/components/AddEmployeeForm';
import { emptyEmployeeDraft, type EmployeeDraft } from '@/lib/rolePresets';
import { ensureOwnerFieldEmployee } from '@/lib/ownerFieldMode';
import { employeeCanD2D, employeeCanDetail } from '@/lib/workCapabilities';

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
  | 'owner_growth'
  | 'owner_profits'
  | 'payment_test'
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

function StatusBadge({ status }: { status?: string | null }) {
  const safeStatus=status||'unknown';
  const colors: Record<string, string> = {
    pending: 'badge-yellow', confirmed: 'badge-blue', in_progress: 'badge-purple',
    completed: 'badge-green', cancelled: 'badge-red', active: 'badge-green',
    paused: 'badge-yellow', inactive: 'badge-gray',
    detailer: 'badge-blue', d2d_agent: 'badge-purple', manager: 'badge-green',
  };
  return <span className={`status-badge ${colors[safeStatus] ?? 'badge-gray'}`}>{safeStatus.replaceAll('_', ' ')}</span>;
}

export default function Admin() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const ownerMode = window.location.pathname.startsWith('/owner');
  const hasWorkspaceAccess = Boolean(user && (ownerMode ? profile?.portal_role === 'owner' : profile?.role === 'admin'));
  const siteUrl=(import.meta.env.VITE_SITE_URL||'https://www.northsplash.com').replace(/\/$/,'');
  const [tab, setTab] = useState<AdminTab>(() => {
    const initial = new URLSearchParams(window.location.search).get('view');
    return (initial || 'dashboard') as AdminTab;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen,setCommandOpen]=useState(false);
  const [commandQuery,setCommandQuery]=useState('');
  const [dataManagerOpen,setDataManagerOpen]=useState(false);
  const [mobileActionsOpen,setMobileActionsOpen]=useState(false);

  const [customers, setCustomers] = useState<Profile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visits, setVisits] = useState<{ id?:string; page: string; referrer?:string|null; session_id?:string|null; user_agent?:string|null; user_id?:string|null; visited_at:string }[]>([]);
  const [visitorRange,setVisitorRange]=useState<'1h'|'6h'|'12h'|'24h'|'3d'|'7d'|'14d'|'30d'|'90d'|'6m'|'1y'>('24h');
  const [selectedEmployeeId,setSelectedEmployeeId]=useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [teamCalendarEmployee,setTeamCalendarEmployee]=useState('');
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
  const [empForm, setEmpForm] = useState<EmployeeDraft>(emptyEmployeeDraft());
  const [empSubmitting, setEmpSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !hasWorkspaceAccess) {
      navigate('/portal');
    }
  }, [user, profile, loading, navigate, hasWorkspaceAccess]);

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
    if (!hasWorkspaceAccess) return;
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

      let visitQuery = await supabase
        .from('site_visits')
        .select('id,page,referrer,session_id,user_agent,user_id,visited_at')
        .gte('visited_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('visited_at',{ascending:false})
        .limit(20000);
      if(visitQuery.error && /user_id/i.test(visitQuery.error.message||'')){
        visitQuery=await supabase.from('site_visits').select('id,page,referrer,session_id,user_agent,visited_at').gte('visited_at',new Date(Date.now()-365*86400000).toISOString()).order('visited_at',{ascending:false}).limit(20000) as any;
      }
      const visitData=visitQuery.data;

      const safeAppointments=(apts.data ?? []).map((a:any)=>({...a,add_ons:Array.isArray(a.add_ons)?a.add_ons:[]}));
      setCustomers(custs.data ?? []);
      setAppointments(safeAppointments);
      setPayments(pays.data ?? []);
      let employeeRows=(emps.data ?? []) as Employee[];
      if(ownerMode && user && !employeeRows.some(e=>e.user_id===user.id)){
        try{
          const fieldProfile=await ensureOwnerFieldEmployee(user.id,profile?.full_name||user.email?.split('@')[0]||'North Splash Owner',user.email);
          if(fieldProfile&&!employeeRows.some(e=>e.id===fieldProfile.id))employeeRows=[fieldProfile,...employeeRows];
        }catch(err){console.warn('Owner field profile setup skipped',err)}
      }
      setEmployees(employeeRows);
      setAvailability(avail.data ?? []);
      setVisits((visitData ?? []) as any);
      setDataLoading(false);
    })();
  }, [user, profile, hasWorkspaceAccess]);

  useEffect(() => {
    if (!hasWorkspaceAccess) return;
    const channel = supabase.channel('ns-admin-appointments-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, payload => {
        const next = payload.new ? ({...(payload.new as Appointment),add_ons:Array.isArray((payload.new as any).add_ons)?(payload.new as any).add_ons:[]} as Appointment) : (payload.new as Appointment);
        const old = payload.old as Appointment;
        setAppointments(current => {
          if (payload.eventType === 'DELETE') return current.filter(a => a.id !== old.id);
          const exists = current.some(a => a.id === next.id);
          return exists ? current.map(a => a.id === next.id ? next : a) : [next, ...current];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasWorkspaceAccess]);

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const monthRevenue = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.status === 'completed';
  }).reduce((s, p) => s + p.amount, 0);

  const detailers = employees.filter(employeeCanDetail);
  const d2dAgents = employees.filter(employeeCanD2D);

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
    setEmpForm(emptyEmployeeDraft());
  };

  const handleDeleteEmployee = async (id: string) => {
    const emp=employees.find(e=>e.id===id);
    if(!emp)return;
    if(!confirm(`Permanently delete ${emp.name}? This removes their employee record and operational test data. This cannot be undone.`))return;
    const rpc=await supabase.rpc('owner_hard_delete_employee',{target_employee_id:id,delete_linked_login:false});
    if(rpc.error){
      const fallback=await supabase.from('employees').delete().eq('id',id);
      if(fallback.error)return alert(fallback.error.message);
    }
    setEmployees(prev=>prev.filter(e=>e.id!==id));
    if(selectedEmployeeId===id)setSelectedEmployeeId('');
  };
  const handleDeleteAppointment=async(id:string)=>{
    const apt=appointments.find(a=>a.id===id);if(!apt)return;
    if(!confirm(`Permanently delete this ${apt.service_name||'appointment'}? This is intended for test data and cannot be undone.`))return;
    const {error}=await supabase.from('appointments').delete().eq('id',id);if(error)return alert(error.message);
    setAppointments(p=>p.filter(a=>a.id!==id));
  };
  const handleDeleteCustomer=async(customer:Profile)=>{
    if(!confirm(`Permanently delete ${customer.full_name||customer.email||'this customer'} and their linked customer data? This cannot be undone.`))return;
    const {error}=await supabase.rpc('owner_hard_delete_customer',{target_user_id:customer.id});
    if(error)return alert(`Could not completely delete customer: ${error.message}`);
    setCustomers(p=>p.filter(c=>c.id!==customer.id));
    setAppointments(p=>p.filter(a=>a.user_id!==customer.id));
    setPayments(p=>p.filter(x=>x.user_id!==customer.id));
  };
  const handleDeleteGuest=async(a:Appointment)=>{
    if(!confirm(`Delete this guest/test customer contact and matching appointments? This cannot be undone.`))return;
    let q=supabase.from('appointments').delete();
    if(a.customer_email)q=q.eq('customer_email',a.customer_email);else if(a.customer_phone)q=q.eq('customer_phone',a.customer_phone);else q=q.eq('customer_name',a.customer_name||'');
    const {error}=await q;if(error)return alert(error.message);
    setAppointments(p=>p.filter(x=>a.customer_email?x.customer_email!==a.customer_email:a.customer_phone?x.customer_phone!==a.customer_phone:x.customer_name!==a.customer_name));
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

const handleCreateCalendarAppointment=async(payload:Record<string,unknown>)=>{
  const {data,error}=await supabase.from('appointments').insert({...payload,source_channel:(payload.source_channel as string)||'admin',field_status:'scheduled'}).select().single();
  if(error){alert(error.message);return}
  setAppointments(prev=>[...prev,data].sort((a,b)=>new Date(a.scheduled_at||0).getTime()-new Date(b.scheduled_at||0).getTime()));
};
const handleCalendarAppointmentUpdate=async(id:string,payload:Record<string,unknown>)=>{
  const current=appointments.find(a=>a.id===id);
  const {data,error}=await supabase.from('appointments').update(payload).eq('id',id).select().single();
  if(error){alert(error.message);return}
  setAppointments(prev=>prev.map(a=>a.id===id?data:a));
  if(payload.assigned_employee_id!==undefined&&payload.assigned_employee_id!==current?.assigned_employee_id){
    try{await supabase.from('appointment_activity').insert({appointment_id:id,actor_user_id:user?.id||null,event_type:'detailer_assigned',details:{from:current?.assigned_employee_id||null,to:payload.assigned_employee_id||null}})}catch{}
    const assigned=employees.find(e=>e.id===payload.assigned_employee_id);
    const recipient=data?.customer_email||current?.customer_email;
    if(assigned&&recipient)sendCommunication('detailer_assigned',{appointment_id:id,recipient_email:recipient,variables:{customer_name:data?.customer_name||current?.customer_name||'Customer',detailer_name:assigned.name,employee_name:assigned.name,service_name:data?.service_name||current?.service_name||'Detailing service'}}).catch(console.warn);
  }
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

  if (!hasWorkspaceAccess) {
    return <div className="portal-loading"><p>Access denied.</p><Link to="/portal">Go to Portal</Link></div>;
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
    ...(ownerMode ? [{ id: 'owner_growth' as AdminTab, label: 'Growth Planner', Icon: Target }, { id: 'owner_profits' as AdminTab, label: 'Profit Tracker', Icon: TrendingUp }, { id: 'payment_test' as AdminTab, label: '1¢ Payment Test', Icon: CreditCard }] : []),
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

  const adminWorkspaces = [
    {id:'home',label:'Home',Icon:LayoutDashboard,items:['dashboard','command_center'] as AdminTab[]},
    {id:'sales',label:'Sales',Icon:Target,items:['sales','leads','territories','marketing','retention'] as AdminTab[]},
    {id:'customers',label:'Customers',Icon:Users,items:['customers','crm','appointments','schedule','availability','archived','fleet'] as AdminTab[]},
    {id:'operations',label:'Operations',Icon:ListChecks,items:['dispatch','job_assignments','inventory','equipment','tasks','documents','notifications','purchasing','incidents','approvals'] as AdminTab[]},
    {id:'people',label:'People',Icon:UserCheck,items:['employees','crews','recruiting','messages','staff_schedule','timeclock','time_off','payroll_approval','training'] as AdminTab[]},
    {id:'finance',label:'Finance',Icon:DollarSign,items:['finance','payments','reports','pay_settings'] as AdminTab[]},
    {id:'admin',label:'Admin',Icon:Settings2,items:['permissions','communications','automations','locations','continuity','audit','visitors'] as AdminTab[]},
  ];
  // Owners sit above Admin operationally: the Owner workspace adds owner-only planning/payment tools,
  // then exposes every Admin workspace instead of a reduced subset.
  const ownerWorkspaces = [
    {id:'owner',label:'Owner',Icon:ShieldCheck,items:['command_center','dashboard','owner_growth','owner_profits','payment_test'] as AdminTab[]},
    ...adminWorkspaces.filter(workspace => workspace.id !== 'home'),
  ];
  const workspaces = ownerMode ? ownerWorkspaces : adminWorkspaces;
  const workspaceForTab=(id:AdminTab)=>workspaces.find(w=>w.items.includes(id))??workspaces[0];
  const currentWorkspace=workspaceForTab(tab);
  const upcomingAppointments = appointments.filter(a=>a.scheduled_at && new Date(a.scheduled_at).getTime()>=Date.now() && !['cancelled','completed'].includes(a.status)).length;
  const unassignedJobs = appointments.filter(a=>!a.assigned_employee_id && !['cancelled','completed'].includes(a.status)).length;
  const activeEmployees = employees.filter(e=>e.status==='active').length;
  const completedJobs = appointments.filter(a=>a.status==='completed').length;
  const avgTicketAll = completedJobs ? appointments.filter(a=>a.status==='completed').reduce((n,a)=>n+Number(a.price||0),0)/completedJobs : 0;
  const workspacePulse = currentWorkspace.id==='sales' ? [
    {label:'D2D Reps',value:String(d2dAgents.length),Icon:Target},
    {label:'Open Appointments',value:String(upcomingAppointments),Icon:CalendarClock},
    {label:'Customers',value:String(customers.length),Icon:Users},
    {label:'30d Revenue',value:money(monthRevenue),Icon:DollarSign},
  ] : currentWorkspace.id==='customers' ? [
    {label:'Customers',value:String(customers.length),Icon:Users},
    {label:'Upcoming',value:String(upcomingAppointments),Icon:CalendarClock},
    {label:'Completed Jobs',value:String(completedJobs),Icon:CheckCircle2},
    {label:'Avg Ticket',value:money(avgTicketAll),Icon:CreditCard},
  ] : currentWorkspace.id==='operations' ? [
    {label:'Open Jobs',value:String(upcomingAppointments),Icon:BriefcaseBusiness},
    {label:'Unassigned',value:String(unassignedJobs),Icon:ShieldCheck},
    {label:'Active Detailers',value:String(detailers.filter(e=>e.status==='active').length),Icon:Car},
    {label:'Pending',value:String(appointments.filter(a=>a.status==='pending').length),Icon:Clock3},
  ] : currentWorkspace.id==='people' ? [
    {label:'Team Members',value:String(employees.length),Icon:Users},
    {label:'Active',value:String(activeEmployees),Icon:Activity},
    {label:'Detailers',value:String(detailers.length),Icon:Car},
    {label:'D2D Reps',value:String(d2dAgents.length),Icon:Target},
  ] : currentWorkspace.id==='finance' ? [
    {label:'Month Revenue',value:money(monthRevenue),Icon:DollarSign},
    {label:'Lifetime Revenue',value:money(totalRevenue),Icon:TrendingUp},
    {label:'Payments',value:String(payments.length),Icon:CreditCard},
    {label:'Avg Ticket',value:money(avgTicketAll),Icon:BarChart2},
  ] : [
    {label:'Active Team',value:String(activeEmployees),Icon:Users},
    {label:'Customers',value:String(customers.length),Icon:UserCheck},
    {label:'Appointments',value:String(appointments.length),Icon:Calendar},
    {label:'30d Visits',value:String(visits.filter(v=>new Date(v.visited_at).getTime()>=Date.now()-30*86400000).length),Icon:Activity},
  ];

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
          <Link to={ownerMode ? "/owner" : "/admin"} className="sidebar-brand">
            <img className="portal-brand-logo" src="/ns-auto-luxe-logo.png" alt="North Splash Auto Luxe"/>
            <div><strong>{ownerMode ? "OWNER PORTAL" : "ADMIN PANEL"}</strong><small>NORTH SPLASH</small></div>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-user">
          <EmployeeAvatar profileId={profile?.id} name={profile?.full_name|| (ownerMode?'Owner':'Admin')} avatarUrl={profile?.avatar_url} size="md" editable className="sidebar-avatar admin-avatar"/>
          <div><p>{profile?.full_name ?? (ownerMode ? 'Owner' : 'Admin')}</p><span>{ownerMode ? '50% Owner' : 'Administrator'}</span></div>
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
          {ownerMode&&<div className="owner-field-switch-v26"><span>WORK MODE</span><div><Link to="/d2d" className="owner-field-mode-btn"><Target size={16}/><strong>D2D</strong><small>Sell / canvass</small></Link><Link to="/employee" className="owner-field-mode-btn"><Car size={16}/><strong>Detail</strong><small>Run jobs</small></Link></div></div>}
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
            <button className="os-command-trigger" aria-label="Search workspace" onClick={()=>{setMobileActionsOpen(false);setCommandOpen(true)}}><Search size={16}/><span>Search workspace</span><kbd>⌘ K</kbd></button>
            <button className="btn-outline btn-sm os-manage-data desktop-top-action" onClick={()=>setDataManagerOpen(true)}><Trash2 size={15}/> <span>Manage data</span></button>
            <button className="btn-primary btn-sm desktop-top-action" onClick={()=>setTab('appointments')}><Plus size={15}/><span>New work</span></button>
            <button className={`os-mobile-actions-trigger ${mobileActionsOpen?'active':''}`} aria-label="More workspace actions" aria-expanded={mobileActionsOpen} onClick={()=>setMobileActionsOpen(v=>!v)}><MoreHorizontal size={20}/></button>
            {mobileActionsOpen&&<div className="os-mobile-actions-menu">
              {ownerMode&&<><button onClick={()=>navigate('/d2d')}><Target size={16}/><span>Switch to D2D mode</span></button><button onClick={()=>navigate('/employee')}><Car size={16}/><span>Switch to Detailer mode</span></button></>}
              <button onClick={()=>{setDataManagerOpen(true);setMobileActionsOpen(false)}}><Trash2 size={16}/><span>Manage data</span></button>
              <button onClick={()=>{setTab('appointments');setMobileActionsOpen(false)}}><Plus size={16}/><span>New work</span></button>
            </div>}
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

        {dataManagerOpen&&<AdminDataManager section={tab} label={navItems.find(n=>n.id===tab)?.label||'Workspace'} onClose={()=>setDataManagerOpen(false)}/>}

        <div className="portal-content">
          {!['command_center','dashboard','sales'].includes(tab) && <section className="os-workspace-pulse" aria-label={`${currentWorkspace.label} workspace overview`}>
            <div className="os-pulse-intro"><span>{currentWorkspace.label.toUpperCase()} WORKSPACE</span><strong>{navItems.find(n=>n.id===tab)?.label}</strong><small>Live operational snapshot</small></div>
            {workspacePulse.map(({label,value,Icon})=><div className="os-pulse-metric" key={label}><i><Icon size={16}/></i><span><strong>{value}</strong><small>{label}</small></span></div>)}
          </section>}

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="admin-dashboard">
              <div className="admin-stats-row">
                <StatCard label="Total Revenue" value={money(totalRevenue)} icon={DollarSign} color="stat-gold" />
                <StatCard label="This Month" value={money(monthRevenue)} icon={TrendingUp} color="stat-green" />
                <StatCard label="Customers" value={String(customers.length)} icon={Users} />
                <StatCard label="Appointments" value={String(appointments.length)} icon={Calendar} />
                <StatCard label="Team Members" value={String(employees.length)} icon={UserCheck} />
                <StatCard label="Site Visits (30d)" value={String(visits.filter(v=>new Date(v.visited_at).getTime()>=Date.now()-30*86400000).length)} icon={Activity} />
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
                <div className="data-table customer-table-v21">
                  <div className="data-table-head">
                    <span>Name</span><span>Email</span><span>Joined</span><span>Status</span><span>Actions</span>
                  </div>
                  {customers.map(c => (
                    <div key={c.id} className="data-table-row">
                      <div className="dt-cell dt-name">
                        <EmployeeAvatar profileId={c.id} name={c.full_name||c.email||'Customer'} avatarUrl={c.avatar_url} size="sm" className="dt-avatar v23-profile-avatar"/>
                        <div>
                          <strong>{c.full_name ?? 'Unknown'}</strong>
                          {c.phone && <span>{c.phone}</span>}
                        </div>
                      </div>
                      <span className="dt-cell">{c.email ?? '—'}</span>
                      <span className="dt-cell">{new Date(c.created_at).toLocaleDateString()}</span>
                      <span className="dt-cell"><StatusBadge status="active" /></span>
                      <span className="dt-cell dt-actions"><button className="icon-danger" title="Permanently delete customer" onClick={()=>handleDeleteCustomer(c)}><Trash2 size={14}/></button></span>
                    </div>
                  ))}
                  {Array.from(new Map<string,Appointment>(appointments.filter(a=>!a.user_id&&(a.customer_email||a.customer_name)).map(a=>[String(a.customer_email||a.customer_phone||a.customer_name),a] as [string,Appointment])).values()).map(a => (
                    <div key={`guest-${a.id}`} className="data-table-row guest-customer-row">
                      <div className="dt-cell dt-name"><div className="dt-avatar">{(a.customer_name||a.customer_email||'G')[0].toUpperCase()}</div><div><strong>{a.customer_name||'Guest customer'}</strong>{a.customer_phone&&<span>{a.customer_phone}</span>}</div></div>
                      <span className="dt-cell">{a.customer_email||'—'}</span>
                      <span className="dt-cell">{new Date(a.created_at).toLocaleDateString()}</span>
                      <span className="dt-cell"><span className="status-badge badge-yellow">booking contact</span></span>
                      <span className="dt-cell dt-actions"><button className="icon-danger" title="Delete guest/test contact" onClick={()=>handleDeleteGuest(a)}><Trash2 size={14}/></button></span>
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
                        {(a.add_ons?.length ?? 0) > 0 && <span>+{a.add_ons!.length} add-on{a.add_ons!.length > 1 ? 's' : ''}</span>}
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

                            <button className="btn-sm btn-outline" onClick={() => handleArchiveAppointment(a.id)}>Archive</button>
                            <button className="btn-sm btn-primary" onClick={() => handleUpdateAptStatus(a.id, 'completed')}>Complete</button>
                            <button className="icon-danger" title="Permanently delete appointment" onClick={()=>handleDeleteAppointment(a.id)}><Trash2 size={14}/></button>
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
                >Restore</button>
                <button className="icon-danger" title="Permanently delete" onClick={()=>handleDeleteAppointment(a.id)}><Trash2 size={14}/></button>
              </div>
            ))}
        </div>
      )}
    </div>
  </div>
)}
          
{/* SCHEDULE */}
{tab === 'schedule' && (
  <div className="tab-content v2-page">
    <AdminTeamCalendar employees={employees} appointments={appointments.filter(a=>!a.archived)} focusEmployeeId={teamCalendarEmployee} onCreate={handleCreateCalendarAppointment} onUpdate={handleCalendarAppointmentUpdate}/>
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
        background: '#101010',
        color: '#f7f7f5',
        border: '1px solid rgba(255,255,255,.08)',
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
        background: '#101010',
        color: '#f7f7f5',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <h3>Upcoming Availability</h3>

      {availability.length === 0 ? (
        <p style={{ color: '#8f8f8b' }}>
          No availability has been added yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {availability.map(item => (
            <div
              key={item.id}
              style={{
                border: '1px solid #e7ddd4',
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
                    color: '#7d7065',
                    marginTop: '5px',
                  }}
                >
                  {item.is_available
                    ? `${item.start_time?.slice(0, 5)||'09:00'} – ${item.end_time?.slice(0, 5)||'17:00'} • ${item.slot_minutes||60} minute slots`
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
                      start_time: item.start_time?.slice(0, 5)||'09:00',
                      end_time: item.end_time?.slice(0, 5)||'17:00',
                      slot_minutes: Number(item.slot_minutes||60),
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
          
          {ownerMode && tab === 'owner_growth' && <OwnerGrowthPlanner />}
          {ownerMode && tab === 'owner_profits' && <OwnerProfitTracker />}
          {ownerMode && tab === 'payment_test' && <OwnerPaymentTest />}

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
            <div className="tab-content team-directory-v21">
              <div className="tab-header">
                <div><span className="eyebrow">PEOPLE DIRECTORY</span><h2>Team</h2><p>{employees.length} people · click a profile for contact, schedule, pay and activity details.</p></div>
                <button className="btn-primary" onClick={() => setShowEmpForm(true)}><Plus size={16}/>Add Member</button>
              </div>
              <div className="team-directory-groups">
                {[
                  {title:'Leadership',roles:['manager']},
                  {title:'D2D Sales',roles:['d2d_agent']},
                  {title:'Detailing',roles:['detailer']},
                  {title:'Other Team',roles:['employee','admin']},
                ].map(group=>{const people=employees.filter(e=>group.roles.includes(e.role));if(!people.length)return null;return <section key={group.title} className="team-directory-section"><div className="team-directory-heading"><h3>{group.title}</h3><span>{people.length}</span></div><div className="team-portrait-grid">{people.map(e=><button className="team-portrait-card" key={e.id} onClick={()=>setSelectedEmployeeId(e.id)}><EmployeeAvatar employee={e} size="xl"/><span className={`team-presence ${e.status==='active'?'online':''}`}/><strong>{e.title||e.role.replaceAll('_',' ')}</strong><h4>{e.name}</h4><small>{e.status==='active'?'Active':'Inactive'} · Level {e.employment_level??1}</small></button>)}</div></section>})}
                {!employees.length&&<div className="v19-premium-empty"><Users size={28}/><h3>No team members yet</h3><p>Add your first employee to start scheduling, messaging, training and dispatch.</p></div>}
              </div>
              {selectedEmployeeId&&(()=>{const e=employees.find(x=>x.id===selectedEmployeeId);if(!e)return null;return <EmployeeProfileDrawer employee={e} employees={employees} appointments={appointments} onClose={()=>setSelectedEmployeeId('')} onOpenCalendar={id=>{setTeamCalendarEmployee(id);setSelectedEmployeeId('');setTab('schedule')}} onOpenMessages={()=>{setSelectedEmployeeId('');setTab('messages')}} onDelete={handleDeleteEmployee} onUpdated={updated=>setEmployees(p=>p.map(x=>x.id===updated.id?updated:x))}/>})()}
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
          {tab === 'visitors' && (()=>{
            const ranges={"1h":3600000,"6h":6*3600000,"12h":12*3600000,"24h":86400000,"3d":3*86400000,"7d":7*86400000,"14d":14*86400000,"30d":30*86400000,"90d":90*86400000,"6m":182*86400000,"1y":365*86400000} as const;
            const filtered=visits.filter(v=>new Date(v.visited_at).getTime()>=Date.now()-ranges[visitorRange]);
            const sessions=new Set(filtered.map(v=>v.session_id).filter(Boolean));
            const pageMap=new Map<string,number>();const refMap=new Map<string,number>();const deviceMap=new Map<string,number>();
            filtered.forEach(v=>{pageMap.set(v.page,(pageMap.get(v.page)||0)+1);const ref=v.referrer?(()=>{try{return new URL(v.referrer!).hostname}catch{return v.referrer!}})():'Direct';refMap.set(ref,(refMap.get(ref)||0)+1);const ua=(v.user_agent||'').toLowerCase();const device=/iphone|android.*mobile/.test(ua)?'Mobile':/ipad|tablet/.test(ua)?'Tablet':'Desktop';deviceMap.set(device,(deviceMap.get(device)||0)+1)});
            const pages=[...pageMap].sort((a,b)=>b[1]-a[1]);const refs=[...refMap].sort((a,b)=>b[1]-a[1]);const max=pages[0]?.[1]||1;
            return <div className="tab-content visitors-v21"><div className="tab-header"><div><span className="eyebrow">AUDIENCE ANALYTICS</span><h2>Site Visitors</h2><p>See traffic from the last hour through the last year, including sessions, pages, sources and devices.</p></div><div className="visitor-range-tabs">{(['1h','6h','12h','24h','3d','7d','14d','30d','90d','6m','1y'] as const).map(r=><button key={r} className={visitorRange===r?'active':''} onClick={()=>setVisitorRange(r)}>{r==='1h'?'1 Hour':r==='6h'?'6 Hours':r==='12h'?'12 Hours':r==='24h'?'1 Day':r==='3d'?'3 Days':r==='7d'?'7 Days':r==='14d'?'14 Days':r==='30d'?'30 Days':r==='90d'?'90 Days':r==='6m'?'6 Months':'1 Year'}</button>)}</div></div><div className="admin-stats-row visitor-kpis"><StatCard label="Page Views" value={String(filtered.length)} icon={Eye}/><StatCard label="Unique Sessions" value={String(sessions.size)} icon={Users}/><StatCard label="Known Visitors" value={String(new Set(filtered.map(v=>v.user_id).filter(Boolean)).size)} icon={UserCheck}/><StatCard label="Pages Viewed" value={String(pages.length)} icon={Globe}/><StatCard label="Views / Session" value={sessions.size?(filtered.length/sessions.size).toFixed(1):'0'} icon={Activity}/></div><div className="visitor-analytics-grid"><section className="admin-card"><div className="admin-card-header"><h3>Top Pages</h3><span>{filtered.length} views</span></div><div className="visitors-list">{pages.slice(0,15).map(([page,count])=><div key={page} className="visitor-row"><span className="visitor-page">{page}</span><div className="visitor-bar-wrap"><div className="visitor-bar" style={{width:`${count/max*100}%`}}/></div><strong className="visitor-count">{count}</strong></div>)}{!pages.length&&<div className="ns-empty">No visits in this time range.</div>}</div></section><section className="admin-card"><div className="admin-card-header"><h3>Traffic Sources</h3></div><div className="visitor-source-list">{refs.slice(0,12).map(([ref,count])=><div key={ref}><span>{ref}</span><strong>{count}</strong></div>)}</div><div className="visitor-device-grid">{[...deviceMap].map(([device,count])=><div key={device}><strong>{count}</strong><span>{device}</span></div>)}</div></section></div><section className="admin-card visitor-live-table"><div className="admin-card-header"><h3>Recent Visits</h3><span>Newest first</span></div><div className="data-table"><div className="data-table-head"><span>Time</span><span>Visitor</span><span>Page</span><span>Source</span><span>Device</span><span>Session</span></div>{filtered.slice(0,100).map((v,i)=>{const ua=(v.user_agent||'').toLowerCase();const device=/iphone|android.*mobile/.test(ua)?'Mobile':/ipad|tablet/.test(ua)?'Tablet':'Desktop';let ref='Direct';if(v.referrer){try{ref=new URL(v.referrer).hostname}catch{ref=v.referrer}}const known=customers.find(c=>c.id===v.user_id);return <div className="data-table-row" key={v.id||`${v.visited_at}-${i}`}><span className="dt-cell">{new Date(v.visited_at).toLocaleString()}</span><span className="dt-cell v23-visitor-person">{known&&<EmployeeAvatar profileId={known.id} name={known.full_name||known.email||'Visitor'} avatarUrl={known.avatar_url} size="sm"/>}<strong>{known?.full_name||known?.email||(v.session_id?`Visitor ${v.session_id.slice(0,6)}`:'Anonymous')}</strong></span><span className="dt-cell"><strong>{v.page}</strong></span><span className="dt-cell">{ref}</span><span className="dt-cell">{device}</span><span className="dt-cell visitor-session">{v.session_id?.slice(0,8)||'—'}</span></div>})}</div></section></div>
          })()}
        </div>

        <nav className="os-mobile-bottom-nav mobile-app-nav-v25" aria-label="Mobile workspace navigation">
          {[
            {id:(ownerMode?'command_center':'dashboard') as AdminTab,label:'Home',Icon:LayoutDashboard},
            {id:'messages' as AdminTab,label:'Chat',Icon:MessageCircle},
            {id:'schedule' as AdminTab,label:'Calendar',Icon:CalendarClock},
            {id:'employees' as AdminTab,label:'Team',Icon:UserCheck},
          ].map(item=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.Icon size={19}/><span>{item.label}</span></button>)}
          <button className={sidebarOpen?'active':''} onClick={()=>setSidebarOpen(true)}><MoreHorizontal size={19}/><span>More</span></button>
        </nav>
      </main>

      {/* Add Employee Modal */}
      {showEmpForm && (
        <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Member</h3>
              <button onClick={() => setShowEmpForm(false)}><X size={20} /></button>
            </div>
            <AddEmployeeForm value={empForm} onChange={setEmpForm} onSubmit={handleAddEmployee} submitting={empSubmitting} submitLabel="Add team member" />
          </div>
        </div>
      )}
    </div>
  );
}
