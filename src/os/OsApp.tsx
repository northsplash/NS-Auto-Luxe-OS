import { useMemo, useState } from 'react';
import {
  BarChart3, Briefcase, CalendarDays, CreditCard, LayoutDashboard, MapPinned, MessageCircle,
  MoreHorizontal, Settings, Smartphone, Users, Workflow, UserPlus, Truck, Home,
} from 'lucide-react';
import type { CommunicationTemplate } from '@/lib/communicationCatalog';
import type { EmployeeDraft } from '@/lib/rolePresets';
import {
  defaultTemplates, seedCandidates, seedChats, seedEmployees, seedJobs, seedLeads, seedPayments,
  type OsEmployee,
} from './demoData';
import {
  Avatar, CalendarView, ChatThread, CommsView, CustomersView, D2DView, DispatchView, HireModal,
  HireView, JobDetail, MoreGrid, OwnerDashboard, PaymentsView, PeopleHome, PeopleProfile,
  PipelineView, ReportsView, ScheduleView, SettingsView,
} from './views';
import './os.css';

export type OsView =
  | 'home' | 'chat' | 'people' | 'schedule' | 'calendar' | 'dispatch' | 'd2d' | 'pipeline'
  | 'customers' | 'jobs' | 'payments' | 'reports' | 'hire' | 'comms' | 'settings' | 'more';

const RAIL: { id: OsView; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'dispatch', label: 'Dispatch', icon: Truck },
  { id: 'd2d', label: 'Leads', icon: MapPinned },
  { id: 'people', label: 'People', icon: Users },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'payments', label: 'Pay', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'hire', label: 'Hire', icon: UserPlus },
  { id: 'comms', label: 'Comms', icon: Workflow },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TITLES: Record<OsView, [string, string]> = {
  home: ['Owner dashboard', 'KPI cards, revenue, recent activity'],
  chat: ['Chat', 'Google Chat / Teams layout'],
  people: ['Employees', 'Directory, status, role, hours, onboarding'],
  schedule: ['Scheduling', 'Availability, shifts, time-off'],
  calendar: ['Appointments', 'Jobs attached to customers'],
  dispatch: ['Dispatch board', 'Crew columns and job cards'],
  d2d: ['D2D portal', 'Territory pins and canvassing'],
  pipeline: ['Lead pipeline', 'Stages, ownership, activity'],
  customers: ['Customers', 'Record, timeline, notes'],
  jobs: ['Detailer portal', 'Mobile jobs, directions, actions'],
  payments: ['Payments', 'Transactions, refunds, filters'],
  reports: ['Reports', 'KPI hierarchy'],
  hire: ['Hiring', 'Onboarding checklist'],
  comms: ['Communications', 'Email + SMS automations'],
  settings: ['Settings', 'Categorized configuration'],
  more: ['All workspaces', 'Every North Splash OS surface'],
};

export default function OsApp() {
  const [view, setView] = useState<OsView>('home');
  const [phone, setPhone] = useState(false);
  const [chatTab, setChatTab] = useState<'dm' | 'space'>('dm');
  const [chats, setChats] = useState(seedChats);
  const [activeChat, setActiveChat] = useState(seedChats[0].id);
  const [employees, setEmployees] = useState(seedEmployees);
  const [peopleId, setPeopleId] = useState<string | null>(null);
  const [jobs, setJobs] = useState(seedJobs);
  const [jobId, setJobId] = useState(seedJobs[0].id);
  const [leads] = useState(seedLeads);
  const [payments] = useState(seedPayments);
  const [candidates] = useState(seedCandidates);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>(defaultTemplates);
  const [hireOpen, setHireOpen] = useState(false);
  const [search, setSearch] = useState('');

  const chat = chats.find((c) => c.id === activeChat) || chats[0];
  const person = employees.find((e) => e.id === peopleId);
  const job = jobs.find((j) => j.id === jobId) || jobs[0];
  const filteredChats = chats.filter((c) => c.kind === (chatTab === 'dm' ? 'dm' : 'space') && c.name.toLowerCase().includes(search.toLowerCase()));
  const unread = chats.reduce((n, c) => n + c.unread, 0);

  const go = (id: string) => setView(id as OsView);
  const sendChat = (body: string) => {
    setChats((prev) => prev.map((c) => c.id === chat.id
      ? { ...c, preview: body, at: 'Now', unread: 0, messages: [...c.messages, { id: `m_${Date.now()}`, from: 'You', mine: true, body, at: 'Now' }] }
      : c));
  };
  const saveHire = (draft: EmployeeDraft) => {
    const emp: OsEmployee = {
      id: `e_${Date.now()}`,
      name: draft.name,
      title: draft.title,
      role: draft.role,
      department: draft.department,
      status: 'active',
      email: draft.email,
      phone: draft.phone,
      initials: draft.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'NS',
      hue: '#7c6a4a',
      pay_type: draft.pay_type,
      hourly_rate: draft.hourly_rate,
      annual_salary: draft.annual_salary,
      weekly_base: draft.weekly_base,
      commission_rate: draft.commission_rate,
      per_job_rate: draft.per_job_rate,
      pay_schedule: draft.pay_schedule,
      hours_week: 0,
      onboarding: 20,
      location: draft.work_location,
    };
    setEmployees((p) => [emp, ...p]);
    setHireOpen(false);
    setView('people');
    setPeopleId(emp.id);
  };

  const titles = TITLES[view];
  const pane = useMemo(() => {
    if (view === 'chat') {
      return (
        <>
          <div className="nsos-pane-head">
            <span className="nsos-eyebrow">North Splash</span>
            <h2>Chat</h2>
            <div className="nsos-tabs">
              <button className={chatTab === 'dm' ? 'active' : ''} onClick={() => setChatTab('dm')}>Chats</button>
              <button className={chatTab === 'space' ? 'active' : ''} onClick={() => setChatTab('space')}>Spaces</button>
            </div>
            <div className="nsos-search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" /></div>
          </div>
          <div className="nsos-list">
            {filteredChats.map((c) => (
              <button className={`nsos-row ${c.id === activeChat ? 'active' : ''}`} key={c.id} onClick={() => { setActiveChat(c.id); setChats((p) => p.map((x) => x.id === c.id ? { ...x, unread: 0 } : x)); }}>
                <Avatar initials={c.initials} hue={c.hue} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong>{c.name}</strong>
                  <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</small>
                </span>
                {c.unread > 0 && <span className="nsos-unread">{c.unread}</span>}
              </button>
            ))}
          </div>
        </>
      );
    }
    if (view === 'people') {
      return (
        <>
          <div className="nsos-pane-head"><span className="nsos-eyebrow">Directory</span><h2>People</h2></div>
          <div className="nsos-list">
            {employees.map((e) => (
              <button className={`nsos-row ${peopleId === e.id ? 'active' : ''}`} key={e.id} onClick={() => setPeopleId(e.id)}>
                <Avatar initials={e.initials} hue={e.hue} />
                <span><strong>{e.name}</strong><small>{e.title}</small></span>
              </button>
            ))}
          </div>
        </>
      );
    }
    return (
      <>
        <div className="nsos-pane-head">
          <span className="nsos-eyebrow">Workspace</span>
          <h2>OS</h2>
        </div>
        <div className="nsos-list">
          {RAIL.map((item) => (
            <button className={`nsos-row ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => go(item.id)}>
              <item.icon size={16} />
              <span><strong>{item.label}</strong><small>{TITLES[item.id][1]}</small></span>
            </button>
          ))}
        </div>
      </>
    );
  }, [view, chatTab, search, filteredChats, activeChat, employees, peopleId]);

  return (
    <div className={`nsos ${phone ? 'phone-mode' : ''}`}>
      <aside className="nsos-rail" aria-label="North Splash OS">
        <div className="nsos-mark">NS</div>
        {RAIL.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} title={item.label} onClick={() => go(item.id)}>
            <item.icon size={18} />
            {item.id === 'chat' && unread > 0 && <span className="nsos-unread" style={{ position: 'absolute', top: 6, right: 6 }}>{unread}</span>}
          </button>
        ))}
        <div className="nsos-rail-spacer" />
        <button className="phone-toggle" title="iPhone layout" onClick={() => setPhone((v) => !v)}><Smartphone size={18} /></button>
      </aside>
      <aside className="nsos-pane">{pane}</aside>
      <main className="nsos-main">
        <div className="nsos-demo-banner">North Splash OS preview · demo data until Supabase is connected</div>
        <header className="nsos-top">
          <div>
            <p className="nsos-eyebrow">North Splash Auto Luxe</p>
            <h1>{person && view === 'people' ? person.name : titles[0]}</h1>
            <p>{titles[1]}</p>
          </div>
          <div className="nsos-actions">
            {view === 'people' && <button className="nsos-btn" onClick={() => setHireOpen(true)}>Add employee</button>}
            <button className="nsos-btn ghost" onClick={() => setPhone((v) => !v)}><Smartphone size={14} />{phone ? 'Desktop' : 'iPhone'}</button>
          </div>
        </header>
        <div className="nsos-body">
          {view === 'home' && <OwnerDashboard jobs={jobs} payments={payments} />}
          {view === 'chat' && chat && <ChatThread chat={chat} onSend={sendChat} />}
          {view === 'people' && !person && <PeopleHome employees={employees} onOpen={setPeopleId} onHire={() => setHireOpen(true)} />}
          {view === 'people' && person && <PeopleProfile employee={person} />}
          {view === 'schedule' && <ScheduleView employees={employees} />}
          {view === 'calendar' && <CalendarView jobs={jobs} onOpen={(id) => { setJobId(id); setView('jobs'); }} />}
          {view === 'dispatch' && <DispatchView jobs={jobs} employees={employees} />}
          {view === 'd2d' && <D2DView leads={leads} />}
          {view === 'pipeline' && <PipelineView leads={leads} />}
          {view === 'customers' && <CustomersView jobs={jobs} />}
          {view === 'jobs' && (
            <JobDetail
              job={job}
              onStatus={(status) => setJobs((p) => p.map((j) => j.id === job.id ? { ...j, status } : j))}
            />
          )}
          {view === 'payments' && <PaymentsView payments={payments} />}
          {view === 'reports' && <ReportsView />}
          {view === 'hire' && <HireView candidates={candidates} />}
          {view === 'comms' && <CommsView templates={templates} onChange={setTemplates} />}
          {view === 'settings' && <SettingsView />}
          {view === 'more' && <MoreGrid onPick={go} />}
        </div>
        <nav className="nsos-bottom">
          <button className={view === 'home' ? 'active' : ''} onClick={() => go('home')}><Home size={18} />Home</button>
          <button className={view === 'chat' ? 'active' : ''} onClick={() => go('chat')}><MessageCircle size={18} />Chat</button>
          <button className={view === 'd2d' ? 'active' : ''} onClick={() => go('d2d')}><MapPinned size={18} />Leads</button>
          <button className={view === 'jobs' ? 'active' : ''} onClick={() => go('jobs')}><Briefcase size={18} />Jobs</button>
          <button className={view === 'more' ? 'active' : ''} onClick={() => go('more')}><MoreHorizontal size={18} />More</button>
        </nav>
      </main>
      <HireModal open={hireOpen} onClose={() => setHireOpen(false)} onSave={saveHire} />
    </div>
  );
}
