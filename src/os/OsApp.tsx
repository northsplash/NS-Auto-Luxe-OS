import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, Bell, BriefcaseBusiness, Calendar, CalendarClock, Car, CheckCircle2, ClipboardCheck,
  Clock3, CreditCard, DollarSign, FileText, Gauge, Globe, LayoutDashboard, ListChecks, LogOut, Mail,
  Menu, MessageCircle, MoreHorizontal, PackageSearch, Plus, ScrollText, Search, Settings2, ShieldCheck,
  Target, Trash2, TrendingUp, UserCheck, Users, Wrench, X,
} from 'lucide-react';
import type { EmployeeDraft } from '@/lib/rolePresets';
import { money } from '@/lib/data';
import { OsProvider, useOs } from './osStore';
import {
  CalendarView, CommsView, CustomersView, D2DView, DispatchView, HireModal, HireView, JobDetail,
  JobsHome, OwnerDashboard, PaymentsView, PeopleHome, PeopleProfile, PipelineView, ReportsView, ScheduleView,
  SettingsView,
} from './views';
import TeamMessagesView from './TeamMessagesView';

export type OsTab =
  | 'dashboard' | 'command_center' | 'owner_growth' | 'owner_profits' | 'payment_test'
  | 'sales' | 'leads' | 'territories' | 'marketing' | 'retention'
  | 'customers' | 'crm' | 'appointments' | 'schedule' | 'availability' | 'archived' | 'fleet'
  | 'dispatch' | 'jobs' | 'job_assignments' | 'inventory' | 'equipment' | 'tasks' | 'documents' | 'notifications'
  | 'purchasing' | 'incidents' | 'approvals'
  | 'employees' | 'crews' | 'recruiting' | 'messages' | 'staff_schedule' | 'timeclock' | 'time_off'
  | 'payroll_approval' | 'training'
  | 'finance' | 'payments' | 'reports' | 'pay_settings'
  | 'permissions' | 'communications' | 'automations' | 'locations' | 'continuity' | 'audit' | 'visitors';

type NavItem = { id: OsTab; label: string; Icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Owner Dashboard', Icon: LayoutDashboard },
  { id: 'command_center', label: 'Command Center', Icon: Gauge },
  { id: 'owner_growth', label: 'Growth', Icon: Target },
  { id: 'owner_profits', label: 'Profits', Icon: TrendingUp },
  { id: 'payment_test', label: 'Payment Test', Icon: CreditCard },
  { id: 'customers', label: 'Customers', Icon: Users },
  { id: 'appointments', label: 'Appointments', Icon: Calendar },
  { id: 'schedule', label: 'Customer Schedule', Icon: CalendarClock },
  { id: 'availability', label: 'Availability', Icon: Calendar },
  { id: 'archived', label: 'Archived Details', Icon: Archive },
  { id: 'recruiting', label: 'Recruiting', Icon: BriefcaseBusiness },
  { id: 'employees', label: 'Team', Icon: UserCheck },
  { id: 'staff_schedule', label: 'Employee Schedule', Icon: CalendarClock },
  { id: 'timeclock', label: 'Time Clock', Icon: Clock3 },
  { id: 'payroll_approval', label: 'Timesheet Approval', Icon: ClipboardCheck },
  { id: 'job_assignments', label: 'Job Assignment', Icon: ListChecks },
  { id: 'sales', label: 'D2D Sales', Icon: TrendingUp },
  { id: 'leads', label: 'Leads Tracker', Icon: Target },
  { id: 'territories', label: 'Territories', Icon: Target },
  { id: 'finance', label: 'Finance & Payroll', Icon: DollarSign },
  { id: 'reports', label: 'Reports & Analytics', Icon: Gauge },
  { id: 'inventory', label: 'Inventory', Icon: PackageSearch },
  { id: 'equipment', label: 'Equipment & Assets', Icon: Wrench },
  { id: 'tasks', label: 'Tasks & Operations', Icon: ListChecks },
  { id: 'time_off', label: 'Time-Off Requests', Icon: CalendarClock },
  { id: 'documents', label: 'Document Vault', Icon: FileText },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'pay_settings', label: 'Pay Structure', Icon: Settings2 },
  { id: 'permissions', label: 'Portal Permissions', Icon: ShieldCheck },
  { id: 'audit', label: 'Audit Log', Icon: ScrollText },
  { id: 'crm', label: 'Customer CRM', Icon: Users },
  { id: 'dispatch', label: 'Dispatch Board', Icon: CalendarClock },
  { id: 'jobs', label: 'Jobs', Icon: BriefcaseBusiness },
  { id: 'crews', label: 'Crew Command', Icon: Users },
  { id: 'fleet', label: 'Fleet Accounts', Icon: Car },
  { id: 'locations', label: 'Locations', Icon: Globe },
  { id: 'marketing', label: 'Marketing', Icon: TrendingUp },
  { id: 'automations', label: 'Automations', Icon: Settings2 },
  { id: 'approvals', label: 'Approvals', Icon: ClipboardCheck },
  { id: 'incidents', label: 'Incidents', Icon: ShieldCheck },
  { id: 'training', label: 'Training', Icon: FileText },
  { id: 'purchasing', label: 'Purchasing', Icon: PackageSearch },
  { id: 'communications', label: 'Communications', Icon: Bell },
  { id: 'messages', label: 'Team Messages', Icon: MessageCircle },
  { id: 'retention', label: 'Retention', Icon: Target },
  { id: 'continuity', label: 'Backups & Exports', Icon: Archive },
  { id: 'payments', label: 'Payments', Icon: CreditCard },
  { id: 'visitors', label: 'Site Visitors', Icon: Globe },
];

const WORKSPACES = [
  { id: 'owner', label: 'Owner', Icon: ShieldCheck, items: ['command_center', 'owner_growth', 'owner_profits', 'payment_test'] as OsTab[] },
  { id: 'sales', label: 'Sales', Icon: Target, items: ['sales', 'leads', 'territories'] as OsTab[] },
  { id: 'customers', label: 'Customers', Icon: Users, items: ['customers', 'appointments', 'availability', 'fleet'] as OsTab[] },
  { id: 'operations', label: 'Operations', Icon: ListChecks, items: ['jobs', 'dispatch', 'job_assignments'] as OsTab[] },
  { id: 'people', label: 'People', Icon: UserCheck, items: ['employees', 'messages', 'staff_schedule', 'recruiting'] as OsTab[] },
  { id: 'finance', label: 'Finance', Icon: DollarSign, items: ['payments', 'reports', 'finance'] as OsTab[] },
  { id: 'admin', label: 'Admin', Icon: Settings2, items: ['communications', 'permissions', 'locations'] as OsTab[] },
];

const PAGE: Record<OsTab, [string, string, string]> = {
  messages: ['People', 'Team Messages', 'Company, crew, and private channels in one place.'],
  employees: ['People', 'Team', 'Directory with role, hours, pay mix, and onboarding. Open anyone for a full profile.'],
  crews: ['Operations', 'Crews', 'Who is on which crew, and which jobs they own today.'],
  recruiting: ['People', 'Hiring', 'Checklists that convert a candidate into an employee with flexible pay.'],
  staff_schedule: ['People', 'Schedule', 'Shifts, availability, and time-off on one board.'],
  timeclock: ['People', 'Time Clock', 'Who is on the clock and hours for the week.'],
  time_off: ['People', 'Time off', 'Approve or deny time-off against the live schedule.'],
  payroll_approval: ['Finance', 'Timesheets', 'Review hours before payroll cutoff.'],
  training: ['People', 'Training', 'Onboarding and field training assigned to the roster.'],
  command_center: ['Owner', 'Command Center', 'Jobs, cash, and the field on one operating snapshot.'],
  dashboard: ['Owner', 'Dashboard', 'KPIs, cash flow, appointments, and team in one view.'],
  owner_growth: ['Owner', 'Growth', 'Pipeline, canvassing, and booking targets.'],
  owner_profits: ['Owner', 'Profit', 'Collected vs open invoices from live jobs.'],
  payment_test: ['Finance', 'Pay test', 'Collect, refund, and retry from the ledger.'],
  sales: ['Sales', 'Map', 'Pins, knocks, and book-the-door from the neighborhood map.'],
  leads: ['Sales', 'Pipeline', 'Stages, activity, and rep ownership on one board.'],
  territories: ['Sales', 'Streets', 'Canvass pins grouped by neighborhood.'],
  marketing: ['Customers', 'Campaigns', 'Retention and booking campaigns tied to the same households.'],
  retention: ['Customers', 'Follow-up', '30-day and 90-day “time for your next detail?”.'],
  customers: ['Customers', 'Directory', 'Household, vehicle, timeline, notes, and communications.'],
  crm: ['Customers', 'Records', 'Notes and history on every household.'],
  appointments: ['Customers', 'Calendar', 'Jobs attached to customers, with assignment.'],
  schedule: ['Customers', 'Windows', 'Upcoming windows and assigned detailers.'],
  availability: ['Customers', 'Open slots', 'Open slots the booking flow can use.'],
  archived: ['Customers', 'History', 'Completed work kept for history and photos.'],
  fleet: ['Customers', 'Fleets', 'Repeat commercial and household accounts.'],
  jobs: ['Operations', 'Jobs', 'Customer, address, and field actions for every live job.'],
  dispatch: ['Operations', 'Board', 'Technicians as columns. Drag job cards onto detailers.'],
  job_assignments: ['Operations', 'Assign', 'Who owns each live job.'],
  inventory: ['Operations', 'Stock', 'Ceramic kits, compounds, and locker stock.'],
  equipment: ['Operations', 'Assets', 'Vans, extractors, and assigned kits.'],
  tasks: ['Operations', 'Tasks', 'Internal ops work that is not a customer job.'],
  documents: ['People', 'Files', 'I-9s, W-4s, and field documents from hiring.'],
  notifications: ['Operations', 'Alerts', 'Owner and crew alerts from the live board.'],
  purchasing: ['Operations', 'Purchasing', 'Restock requests from the field.'],
  incidents: ['Operations', 'Incidents', 'Damage, late arrivals, and customer issues.'],
  approvals: ['Operations', 'Approvals', 'Time-off, refunds, and payroll holds.'],
  finance: ['Finance', 'Payroll', 'Pay mix is per person — not locked to a role.'],
  payments: ['Finance', 'Ledger', 'Transactions, refunds, and filters.'],
  reports: ['Owner', 'Analytics', 'Minimal graphs with a strong KPI hierarchy.'],
  pay_settings: ['Finance', 'Pay mix', 'Hourly, salary, draw, commission, per-job, and custom rules.'],
  permissions: ['Admin', 'Access', 'Who can open Owner, People, Finance, and field modes.'],
  communications: ['Admin', 'Templates', 'Appointment → Confirmed → En Route → In Progress → Complete.'],
  automations: ['Admin', 'Rules', 'The same templates, fired when a job status moves.'],
  locations: ['Admin', 'Locations', 'Raleigh, Cary, Durham, and locker points.'],
  continuity: ['Admin', 'Backups', 'Demo data lives in this browser until you reset it.'],
  audit: ['Admin', 'Audit', 'Hires, status changes, and payment actions.'],
  visitors: ['Admin', 'Traffic', 'Marketing site traffic when Supabase is connected.'],
};

const TAB_SHORT: Record<OsTab, string> = {
  dashboard: 'Command Center', command_center: 'Command Center', owner_growth: 'Growth', owner_profits: 'Profits', payment_test: 'Payment Test',
  sales: 'Map', leads: 'Pipeline', territories: 'Streets', marketing: 'Campaigns', retention: 'Follow-up',
  customers: 'Directory', crm: 'Records', appointments: 'Calendar', schedule: 'Windows', availability: 'Slots', archived: 'History', fleet: 'Fleets',
  jobs: 'Jobs', dispatch: 'Board', job_assignments: 'Assign', inventory: 'Stock', equipment: 'Assets', tasks: 'Tasks', documents: 'Files', notifications: 'Alerts', purchasing: 'Buy', incidents: 'Issues', approvals: 'Approvals',
  employees: 'Team', staff_schedule: 'Schedule', recruiting: 'Hiring', messages: 'Chat', crews: 'Crews', timeclock: 'Clock', time_off: 'Time off', payroll_approval: 'Timesheets', training: 'Training',
  payments: 'Ledger', reports: 'Analytics', finance: 'Payroll', pay_settings: 'Pay mix',
  communications: 'Templates', automations: 'Rules', permissions: 'Access', locations: 'Shops', continuity: 'Backups', audit: 'Audit', visitors: 'Traffic',
};

const LEGACY: Record<string, OsTab> = {
  home: 'command_center', dashboard: 'command_center', chat: 'messages', people: 'employees', schedule: 'staff_schedule',
  calendar: 'appointments', d2d: 'sales', pipeline: 'leads', jobs: 'appointments', hire: 'recruiting',
  comms: 'communications', settings: 'pay_settings', more: 'command_center',
};

function nav(id: OsTab) {
  return NAV.find((n) => n.id === id);
}

class OsErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error) { return { failed: true, message: error?.message || 'View error' }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('North Splash OS view error', error, info); }
  render() {
    if (this.state.failed) {
      return (
        <div className="nsos-card" style={{ margin: 20 }}>
          <h2>This workspace hit a snag</h2>
          <p style={{ color: 'var(--os-muted)', margin: '8px 0 14px' }}>The rest of the OS is still running. Reset this view instead of reloading the whole app.</p>
          {this.state.message && <p className="empty-text">{this.state.message}</p>}
          <button className="nsos-btn" onClick={() => { this.setState({ failed: false, message: '' }); this.props.onReset?.(); }}>Back to Team Messages</button>
        </div>
      );
    }
    return this.props.children;
  }
}

type WorkMode = 'owner' | 'd2d' | 'detailer' | 'admin';

function WorkspacePage({ tab, children, action }: { tab: OsTab; children: ReactNode; action?: ReactNode }) {
  if (tab === 'command_center' || tab === 'dashboard' || tab === 'messages' || tab === 'sales') return <>{children}</>;
  const meta = PAGE[tab];
  if (!meta) return <>{children}</>;
  const [eyebrow, title, sub] = meta;
  return (
    <div className="tab-content v2-page os-page">
      <div className="v2-page-head os-page-toolbar">
        <div>
          <span className="eyebrow os-page-kicker">{eyebrow}</span>
          <h2>{title}</h2>
          <p className="os-page-lead">{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function OsShell() {
  const os = useOs();
  const [tab, setTab] = useState<OsTab>(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('tab');
      if (fromUrl) return (LEGACY[fromUrl] || fromUrl) as OsTab;
      const raw = sessionStorage.getItem('ns-os-tab') || sessionStorage.getItem('ns-os-view') || 'command_center';
      return (LEGACY[raw] || raw || 'command_center') as OsTab;
    } catch { return 'command_center'; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [dataOpen, setDataOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [hirePreset, setHirePreset] = useState<Partial<EmployeeDraft> | undefined>();
  const [peopleId, setPeopleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [newWorkOpen, setNewWorkOpen] = useState(false);
  const [mode, setMode] = useState<WorkMode>(() => {
    try { return (sessionStorage.getItem('ns-os-mode') as WorkMode) || 'owner'; } catch { return 'owner'; }
  });
  const [lastByWorkspace, setLastByWorkspace] = useState<Partial<Record<string, OsTab>>>(() => {
    try { return JSON.parse(sessionStorage.getItem('ns-os-ws-last') || '{}'); } catch { return {}; }
  });


  useEffect(() => {
    try { sessionStorage.setItem('ns-os-mode', mode); } catch { /* ignore */ }
  }, [mode]);

  useEffect(() => {
    try { sessionStorage.setItem('ns-os-tab', tab); } catch { /* ignore */ }
    const ws = WORKSPACES.find((w) => w.items.includes(tab));
    if (!ws) return;
    setLastByWorkspace((prev) => {
      const next = { ...prev, [ws.id]: tab };
      try { sessionStorage.setItem('ns-os-ws-last', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) setMoreOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const go = (id: string) => {
    const next = (LEGACY[id] || id) as OsTab;
    setTab(next);
    setSidebarOpen(false);
    setMoreOpen(false);
    setNewWorkOpen(false);
    setPeopleId(null);
    setJobId(null);
  };

  const switchMode = (next: WorkMode) => {
    setMode(next);
    const home: OsTab = next === 'd2d' ? 'sales' : next === 'detailer' ? 'jobs' : next === 'admin' ? 'communications' : 'command_center';
    go(home);
  };

  const openJob = (id: string) => {
    setJobId(id);
    if (tab === 'jobs' || tab === 'dispatch' || tab === 'crews' || tab === 'job_assignments') setTab('jobs');
    else setTab('appointments');
  };

  const saveHire = (draft: EmployeeDraft) => {
    const emp = os.hireEmployee(draft);
    setHireOpen(false);
    setHirePreset(undefined);
    setTab('employees');
    setPeopleId(emp.id);
  };

  const homeTab: OsTab = mode === 'd2d' ? 'sales' : mode === 'detailer' ? 'jobs' : mode === 'admin' ? 'communications' : 'command_center';
  const currentWorkspace = WORKSPACES.find((w) => w.items.includes(tab)) ?? WORKSPACES[4];
  const currentNav = nav(tab);
  const phoneHome = mode === 'd2d'
    ? ['sales', 'leads', 'territories'].includes(tab)
    : mode === 'detailer'
      ? ['jobs', 'dispatch', 'job_assignments'].includes(tab)
      : mode === 'admin'
        ? ['communications', 'automations', 'permissions', 'locations', 'continuity', 'audit', 'visitors'].includes(tab)
        : ['dashboard', 'command_center', 'owner_growth', 'owner_profits', 'payment_test'].includes(tab);
  const phoneChat = tab === 'messages';
  const phoneCal = ['appointments', 'schedule', 'availability', 'staff_schedule'].includes(tab);
  const phoneTeam = tab === 'employees';
  const phoneMore = moreOpen || !(phoneHome || phoneChat || phoneCal || phoneTeam);
  const person = os.employees.find((e) => e.id === peopleId);
  const job = os.jobs.find((j) => j.id === jobId);
  const activeEmployees = os.employees.filter((e) => e.status === 'active');
  const detailers = os.employees.filter((e) => e.role === 'detailer');
  const d2dAgents = os.employees.filter((e) => e.role === 'd2d_agent');
  const upcoming = os.jobs.filter((j) => j.status !== 'completed').length;
  const collected = os.payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);

  const workspacePulse = currentWorkspace.id === 'sales' ? [
    { label: 'D2D Reps', value: String(d2dAgents.length), Icon: Target },
    { label: 'Open Appointments', value: String(upcoming), Icon: CalendarClock },
    { label: 'Customers', value: String(os.customers.length), Icon: Users },
    { label: 'Collected', value: money(collected), Icon: DollarSign },
  ] : currentWorkspace.id === 'customers' ? [
    { label: 'Customers', value: String(os.customers.length), Icon: Users },
    { label: 'Upcoming', value: String(upcoming), Icon: CalendarClock },
    { label: 'Completed Jobs', value: String(os.jobs.filter((j) => j.status === 'completed').length), Icon: CheckCircle2 },
    { label: 'Open Jobs', value: String(upcoming), Icon: CreditCard },
  ] : currentWorkspace.id === 'operations' ? [
    { label: 'Open Jobs', value: String(upcoming), Icon: BriefcaseBusiness },
    { label: 'Unassigned', value: String(os.jobs.filter((j) => !j.detailer).length), Icon: ShieldCheck },
    { label: 'Active Detailers', value: String(detailers.filter((e) => e.status === 'active').length), Icon: Car },
    { label: 'In Field', value: String(os.jobs.filter((j) => j.status === 'en_route' || j.status === 'in_progress').length), Icon: Clock3 },
  ] : currentWorkspace.id === 'people' ? [
    { label: 'Team Members', value: String(os.employees.length), Icon: Users },
    { label: 'Active', value: String(activeEmployees.length), Icon: CheckCircle2 },
    { label: 'Detailers', value: String(detailers.length), Icon: Car },
    { label: 'D2D Reps', value: String(d2dAgents.length), Icon: Target },
  ] : currentWorkspace.id === 'finance' ? [
    { label: 'Collected', value: money(collected), Icon: DollarSign },
    { label: 'Payments', value: String(os.payments.length), Icon: CreditCard },
    { label: 'Open Jobs', value: String(upcoming), Icon: BriefcaseBusiness },
    { label: 'Team', value: String(activeEmployees.length), Icon: Users },
  ] : currentWorkspace.id === 'owner' ? [
    { label: 'Jobs today', value: String(os.jobs.filter((j) => String(j.time || '').includes('Today')).length), Icon: CalendarClock },
    { label: 'Unassigned', value: String(os.jobs.filter((j) => !j.detailer && j.status !== 'completed').length), Icon: ShieldCheck },
    { label: 'Open packets', value: String(os.employees.filter((e) => Number(e.onboarding || 0) < 100).length), Icon: UserCheck },
    { label: 'Collected', value: money(collected), Icon: DollarSign },
  ] : [
    { label: 'Active Team', value: String(activeEmployees.length), Icon: Users },
    { label: 'Customers', value: String(os.customers.length), Icon: UserCheck },
    { label: 'Appointments', value: String(os.jobs.length), Icon: Calendar },
    { label: 'Leads', value: String(os.leads.length), Icon: Target },
  ];

  const q = commandQuery.trim().toLowerCase();
  const commandPages = NAV.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  const commandPeople = os.employees.filter((e) => `${e.name} ${e.title}`.toLowerCase().includes(q)).slice(0, 5);
  const commandJobs = os.jobs.filter((j) => `${j.customer} ${j.service}`.toLowerCase().includes(q)).slice(0, 5);
  const commandCustomers = os.customers.filter((c) => `${c.name} ${c.vehicle}`.toLowerCase().includes(q)).slice(0, 4);
  const commandLeads = os.leads.filter((l) => `${l.name} ${l.address}`.toLowerCase().includes(q)).slice(0, 4);

  const inner = (() => {
    if (tab === 'messages') return null;
    if (tab === 'employees') {
      if (person) return <PeopleProfile employee={person} />;
      return <PeopleHome employees={os.employees} onOpen={setPeopleId} onHire={() => { setHirePreset(undefined); setHireOpen(true); }} />;
    }
    if (tab === 'recruiting' || tab === 'training') {
      return (
        <HireView
          onHire={(name, title) => { setHirePreset({ name: name || '', title: title || '' }); setHireOpen(true); }}
          onOpen={(id) => { setTab('employees'); setPeopleId(id); }}
        />
      );
    }
    if (tab === 'staff_schedule' || tab === 'timeclock' || tab === 'time_off' || tab === 'payroll_approval') return <ScheduleView />;
    if (tab === 'crews' || tab === 'dispatch' || tab === 'job_assignments') return <DispatchView onOpen={openJob} />;
    if (tab === 'sales' || tab === 'territories' || tab === 'marketing' || tab === 'retention') return <D2DView onBook={openJob} onPipeline={() => go('leads')} />;
    if (tab === 'leads') return <PipelineView onBook={openJob} />;
    if (tab === 'customers' || tab === 'crm' || tab === 'fleet') return <CustomersView onOpenJob={openJob} />;
    if (tab === 'appointments' || tab === 'schedule' || tab === 'availability' || tab === 'archived') {
      if (job && tab === 'appointments') return <JobDetail job={job} />;
      return <CalendarView onOpen={openJob} />;
    }
    if (tab === 'jobs') {
      if (job) return <JobDetail job={job} />;
      return <JobsHome jobs={os.jobs} onOpen={openJob} />;
    }
    if (tab === 'payments' || tab === 'finance' || tab === 'payment_test') return <PaymentsView />;
    if (tab === 'reports' || tab === 'owner_growth' || tab === 'owner_profits') return <ReportsView />;
    if (tab === 'dashboard' || tab === 'command_center') {
      return (
        <OwnerDashboard
          onOpenJob={openJob}
          onOpenPayments={() => go('payments')}
          onOpenPipeline={() => go('leads')}
          onNewAppointment={() => go('appointments')}
          onNewCustomer={() => go('customers')}
          onNewLead={() => go('sales')}
          onNewEmployee={() => { setHirePreset(undefined); setHireOpen(true); }}
          onOpenTeam={() => go('employees')}
          onOpenSchedule={() => go('appointments')}
          onOpenDispatch={() => go('dispatch')}
          onOpenMessages={() => go('messages')}
        />
      );
    }
    if (tab === 'communications' || tab === 'automations' || tab === 'notifications') return <CommsView />;
    return <SettingsView />;
  })();

  const pageAction = (tab === 'appointments' || tab === 'jobs') && job ? (
    <button className="btn-outline btn-sm" onClick={() => setJobId(null)}>Back to list</button>
  ) : undefined;

  return (
    <div className={`portal-layout nsos-admin-preview admin-os nsos-cream os-tab-${tab}${moreOpen ? ' os-more-open' : ''} os-mode-${mode}`}>
      <a className="nsos-skip" href="#os-main">Skip to workspace</a>
      <aside className={`portal-sidebar admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={() => go(homeTab)}>
            <img className="portal-brand-logo" src={`${import.meta.env.BASE_URL}ns-auto-luxe-logo.svg`} alt="North Splash Auto Luxe" />
            <div><strong>North Splash</strong><small>Auto Luxe OS</small></div>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar admin-avatar">NS</div>
          <div><p>North Splash Admin</p><span>Owner</span></div>
        </div>
        <nav className="sidebar-nav os-workspace-nav">
          <div className="os-sidebar-section-label">WORKSPACES</div>
          {WORKSPACES.map((w) => {
            const active = currentWorkspace.id === w.id;
            return (
              <div key={w.id} className={`os-workspace-block ${active ? 'open' : ''}`}>
                <button type="button" className={`os-workspace-button ${active ? 'active' : ''}`} onClick={() => { if (!active) go(lastByWorkspace[w.id] || w.items[0]); }}>
                  <span className="os-workspace-icon"><w.Icon size={18} /></span>
                  <span>{w.label}</span>
                </button>
                {active && (
                  <div className="os-workspace-children">
                    {w.items.map((id) => {
                      const item = nav(id);
                      if (!item) return null;
                      return (
                        <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => go(id)}>
                          {TAB_SHORT[id] || item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div className="os-sidebar-section-label os-sidebar-section-gap">PINNED</div>
          {(['command_center', 'appointments', 'leads', 'messages'] as OsTab[]).map((id) => {
            const item = nav(id);
            if (!item) return null;
            const { Icon, label } = item;
            return (
              <button key={id} className={`os-pinned-link ${tab === id ? 'active' : ''}`} onClick={() => go(id)}>
                <Icon size={16} /><span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="owner-field-switch-v26 os-mode-switch">
            <span>PORTAL MODE</span>
            <div className="os-mode-grid">
              <button type="button" className={mode === 'owner' ? 'active' : ''} onClick={() => switchMode('owner')}><ShieldCheck size={16} /><strong>Owner</strong><small>Command</small></button>
              <button type="button" className={mode === 'd2d' ? 'active' : ''} onClick={() => switchMode('d2d')}><Target size={16} /><strong>D2D</strong><small>Canvass</small></button>
              <button type="button" className={mode === 'detailer' ? 'active' : ''} onClick={() => switchMode('detailer')}><Car size={16} /><strong>Detail</strong><small>Run jobs</small></button>
              <button type="button" className={mode === 'admin' ? 'active' : ''} onClick={() => switchMode('admin')}><Settings2 size={16} /><strong>Admin</strong><small>Templates</small></button>
            </div>
          </div>
          <button className="sidebar-item" onClick={() => setHelpOpen(true)}><Mail size={18} /> Help</button>
          <a href="https://northsplash.github.io/NS-Auto-Luxe-OS/?tab=command_center" className="sidebar-item" target="_blank" rel="noreferrer"><Globe size={18} /> Live demo</a>
          <button className="sidebar-item sidebar-signout" onClick={() => { setMode('owner'); go('command_center'); }}><LogOut size={18} /> Back to Owner</button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="portal-main" id="os-main" tabIndex={-1}>
        <div className="portal-topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title"><span>{currentWorkspace.label}</span><h1>{currentNav?.label}</h1></div>
          <div className="os-topbar-actions">
            <button className="os-command-trigger" aria-label="Search workspace" onClick={() => { setMoreOpen(false); setCommandOpen(true); }}>
              <Search size={16} /><span>Search workspace</span><kbd>⌘ K</kbd>
            </button>
            <button className="btn-outline btn-sm os-manage-data desktop-top-action" onClick={() => setDataOpen(true)}><Trash2 size={15} /> <span>Manage data</span></button>
            <button className="btn-primary btn-sm desktop-top-action" onClick={() => setNewWorkOpen(true)}><Plus size={15} /><span>+ New work</span></button>
          </div>
        </div>
        <div className="os-secondary-nav os-desktop-subnav">
          <div className="os-secondary-nav-scroll">
            {currentWorkspace.items.map((id) => {
              const item = nav(id);
              if (!item) return null;
              return <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}>{TAB_SHORT[id] || item.label}</button>;
            })}
          </div>
          <div className="os-view-context"><span className="os-live-dot" />{mode === 'owner' ? 'Owner portal' : mode === 'd2d' ? 'D2D field' : mode === 'detailer' ? 'Detailer' : 'Admin'}</div>
        </div>
        <div className="os-phone-subnav" aria-label="Workspace pages">
          {currentWorkspace.items.map((id) => {
            const item = nav(id);
            if (!item) return null;
            return <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => go(id)}>{TAB_SHORT[id] || item.label}</button>;
          })}
        </div>
        {mode !== 'owner' && (
          <div className="os-mode-banner">
            <div>
              <strong>{mode === 'd2d' ? 'D2D field mode' : mode === 'detailer' ? 'Detailer mode' : 'Admin mode'}</strong>
              <span>You stay in this OS. Switching does not open a second login portal.</span>
            </div>
            <button type="button" onClick={() => switchMode('owner')}>Back to Owner</button>
          </div>
        )}

        {commandOpen && (
          <div className="os-command-backdrop" onClick={() => setCommandOpen(false)}>
            <div className="os-command-palette" onClick={(e) => e.stopPropagation()}>
              <div className="os-command-input">
                <Search size={18} />
                <input autoFocus placeholder="Search pages, customers, appointments or employees…" value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} />
                <button onClick={() => setCommandOpen(false)}>ESC</button>
              </div>
              <div className="os-command-results">
                {commandPages.map((n) => (
                  <button key={n.id} onClick={() => { go(n.id); setCommandOpen(false); setCommandQuery(''); }}>
                    <n.Icon size={16} /><span>{n.label}</span><small>Open workspace</small>
                  </button>
                ))}
                {commandPeople.map((e) => (
                  <button key={e.id} onClick={() => { setTab('employees'); setPeopleId(e.id); setCommandOpen(false); }}>
                    <UserCheck size={16} /><span>{e.name}</span><small>{e.title}</small>
                  </button>
                ))}
                {commandJobs.map((j) => (
                  <button key={j.id} onClick={() => { openJob(j.id); setCommandOpen(false); }}>
                    <Calendar size={16} /><span>{j.customer}</span><small>{j.service}</small>
                  </button>
                ))}
                {commandCustomers.map((c) => (
                  <button key={c.id} onClick={() => { go('customers'); setCommandOpen(false); }}>
                    <Users size={16} /><span>{c.name}</span><small>{c.vehicle}</small>
                  </button>
                ))}
                {commandLeads.map((l) => (
                  <button key={l.id} onClick={() => { go('sales'); setCommandOpen(false); }}>
                    <Target size={16} /><span>{l.name}</span><small>{l.address} · {l.status}</small>
                  </button>
                ))}
                {q && !commandPages.length && !commandPeople.length && !commandJobs.length && !commandCustomers.length && !commandLeads.length && <p className="empty-text">Nothing matches.</p>}
              </div>
            </div>
          </div>
        )}

        {dataOpen && (
          <div className="os-command-backdrop" onClick={() => setDataOpen(false)}>
            <div className="os-command-palette nsos-data-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="os-command-input"><Trash2 size={18} /><strong>Manage demo data</strong><button onClick={() => setDataOpen(false)}>ESC</button></div>
              <div className="os-command-results" style={{ padding: 16 }}>
                <p className="empty-text" style={{ textAlign: 'left', padding: '0 0 12px' }}>This preview stores employees, jobs, chats, and payments in this browser. Resetting restores the North Splash sample workspace.</p>
                <button className="btn-primary" onClick={() => { os.resetDemo(); setDataOpen(false); go('messages'); }}>Reset demo workspace</button>
              </div>
            </div>
          </div>
        )}

        {helpOpen && (
          <div className="os-command-backdrop" onClick={() => setHelpOpen(false)}>
            <div className="os-command-palette nsos-data-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="os-command-input"><Mail size={18} /><strong>Help</strong><button onClick={() => setHelpOpen(false)}>ESC</button></div>
              <div className="os-command-results" style={{ padding: 16 }}>
                <p className="empty-text" style={{ textAlign: 'left' }}>You are in the North Splash OS preview. Team Messages, hiring, dispatch, D2D, and payments run on demo data until Supabase is connected. Sign in at /login for the live Admin portal.</p>
              </div>
            </div>
          </div>
        )}

        <div className="portal-content">
          {!['messages', 'dashboard', 'command_center', 'sales', 'dispatch', 'jobs'].includes(tab) && (
            <section className="os-workspace-pulse" aria-label={`${currentWorkspace.label} snapshot`}>
              {workspacePulse.map(({ label, value, Icon }) => (
                <div className="os-pulse-metric" key={label}>
                  <i><Icon size={16} /></i>
                  <span><strong>{value}</strong><small>{label}</small></span>
                </div>
              ))}
            </section>
          )}

          <OsErrorBoundary key={tab} onReset={() => go('messages')}>
            {tab === 'messages' ? (
              <WorkspacePage tab="messages">
                <TeamMessagesView />
              </WorkspacePage>
            ) : (
              <WorkspacePage tab={tab} action={pageAction}>
                {tab === 'employees' && person && (
                  <button className="btn-outline btn-sm" style={{ marginBottom: 12, width: 'fit-content' }} onClick={() => setPeopleId(null)}>Back to directory</button>
                )}
                <div className="nsos nsos-embed">{inner}</div>
              </WorkspacePage>
            )}
          </OsErrorBoundary>
        </div>
      </main>

      <nav className="os-mobile-bottom-nav mobile-app-nav-v25" aria-label="Mobile workspace navigation">
        <button type="button" className={!moreOpen && phoneHome ? 'active' : ''} onClick={() => go(homeTab)}><LayoutDashboard size={19} /><span>Home</span></button>
        <button type="button" className={!moreOpen && phoneChat ? 'active' : ''} onClick={() => go('messages')}><MessageCircle size={19} /><span>Chat</span></button>
        <button type="button" className={!moreOpen && phoneCal ? 'active' : ''} onClick={() => go('appointments')}><Calendar size={19} /><span>Calendar</span></button>
        <button type="button" className={!moreOpen && phoneTeam ? 'active' : ''} onClick={() => go('employees')}><Users size={19} /><span>Team</span></button>
        <button type="button" className={phoneMore ? 'active' : ''} onClick={() => { setSidebarOpen(false); setMoreOpen((v) => !v); }}><MoreHorizontal size={19} /><span>More</span></button>
      </nav>
      {moreOpen && (
        <div className="os-more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="os-more-sheet" role="dialog" aria-label="More workspaces" onClick={(e) => e.stopPropagation()}>
            <div className="os-more-sheet-head">
              <div>
                <span>NORTH SPLASH OS</span>
                <strong>Workspaces</strong>
              </div>
              <button type="button" aria-label="Close workspaces" onClick={() => setMoreOpen(false)}><X size={18} /></button>
            </div>
            <div className="os-more-sheet-grid">
              {WORKSPACES.map((w) => (
                <button key={w.id} className={currentWorkspace.id === w.id ? 'active' : ''} onClick={() => go(w.items[0])}>
                  <w.Icon size={18} />
                  <strong>{w.label}</strong>
                  <small>{w.items.length} pages</small>
                </button>
              ))}
            </div>
            <div className="os-more-sheet-label">Pinned</div>
            <div className="os-more-sheet-pins">
              {(['command_center', 'appointments', 'leads', 'employees', 'communications'] as OsTab[]).map((id) => {
                const item = nav(id);
                if (!item) return null;
                const { Icon, label } = item;
                return (
                  <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}>
                    <Icon size={16} /><span>{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="os-more-sheet-label">Switch portal</div>
            <div className="os-mode-row">
              <button className={mode === 'owner' ? 'active' : ''} onClick={() => switchMode('owner')}><strong>Owner</strong><small>Command</small></button>
              <button className={mode === 'd2d' ? 'active' : ''} onClick={() => switchMode('d2d')}><strong>D2D</strong><small>Canvass</small></button>
              <button className={mode === 'detailer' ? 'active' : ''} onClick={() => switchMode('detailer')}><strong>Detailer</strong><small>Run jobs</small></button>
              <button className={mode === 'admin' ? 'active' : ''} onClick={() => switchMode('admin')}><strong>Admin</strong><small>Templates</small></button>
            </div>
            <p className="os-more-note">Owner, D2D, Detail, and Admin are views of the same OS. You do not leave this workspace.</p>
          </div>
        </div>
      )}
      {newWorkOpen && (
        <div className="os-sheet-backdrop" onClick={() => setNewWorkOpen(false)}>
          <div className="os-sheet" role="dialog" aria-label="Quick actions" onClick={(e) => e.stopPropagation()}>
            <h3>One-tap actions</h3>
            <div className="os-sheet-list">
              <button onClick={() => go('sales')}><Target size={16} /> New lead</button>
              <button onClick={() => go('appointments')}><Calendar size={16} /> Book job</button>
              <button onClick={() => go('dispatch')}><ListChecks size={16} /> Assign</button>
              <button onClick={() => {
                const nextJob = os.jobs.find((j) => j.status === 'confirmed' || j.status === 'scheduled');
                if (nextJob) { os.setJobStatus(nextJob.id, 'en_route'); openJob(nextJob.id); }
                setNewWorkOpen(false);
              }}><Car size={16} /> En route</button>
              <button onClick={() => {
                const live = os.jobs.find((j) => j.status === 'in_progress' || j.status === 'arrived' || j.status === 'en_route');
                if (live) { os.setJobStatus(live.id, 'completed'); openJob(live.id); }
                setNewWorkOpen(false);
              }}><CheckCircle2 size={16} /> Complete</button>
              <button onClick={() => go('payments')}><CreditCard size={16} /> Collect payment</button>
            </div>
          </div>
        </div>
      )}
      <HireModal open={hireOpen} onClose={() => setHireOpen(false)} onSave={saveHire} preset={hirePreset} />
      {os.toast && (
        <button className="nsos-toast" onClick={os.dismissToast}>
          <strong>{os.toast.title}</strong>
          <span>{os.toast.body}</span>
        </button>
      )}
    </div>
  );
}

export default function OsApp() {
  useEffect(() => {
    document.documentElement.classList.add('nsos-active');
    document.body.classList.add('nsos-active');
    return () => {
      document.documentElement.classList.remove('nsos-active');
      document.body.classList.remove('nsos-active');
    };
  }, []);
  return (
    <OsProvider>
      <OsShell />
    </OsProvider>
  );
}
