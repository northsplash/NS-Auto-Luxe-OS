import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  BarChart3, Briefcase, CalendarDays, Clock3, CreditCard, LayoutDashboard, MapPinned, MessageCircle,
  MoreHorizontal, Plus, Settings, Smartphone, Users, Workflow, UserPlus, Truck, Home,
} from 'lucide-react';
import type { EmployeeDraft } from '@/lib/rolePresets';
import { OsProvider, useOs } from './osStore';
import {
  Avatar, CalendarView, ChatThread, CommsView, CustomersView, D2DView, DispatchView, HireModal,
  HireView, JobDetail, JobsHome, MoreGrid, OmniSearch, OwnerDashboard, PaymentsView, PeopleHome, PeopleProfile,
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
  { id: 'schedule', label: 'Hours', icon: Clock3 },
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
  schedule: ['Scheduling', 'Drag shifts, availability, time-off'],
  calendar: ['Appointments', 'Jobs attached to customers'],
  dispatch: ['Dispatch board', 'Drag jobs onto crew columns'],
  d2d: ['D2D portal', 'Territory pins and canvassing'],
  pipeline: ['Lead pipeline', 'Stages, ownership, activity'],
  customers: ['Customers', 'Record, timeline, notes'],
  jobs: ['Detailer portal', 'Service, photos, notes, payment, SMS'],
  payments: ['Payments', 'Transactions, refunds, filters'],
  reports: ['Reports', 'KPI hierarchy from live jobs'],
  hire: ['Hiring', 'Gusto-style onboarding checklist'],
  comms: ['Communications', 'Email + SMS automations'],
  settings: ['Settings', 'Categorized configuration'],
  more: ['All workspaces', 'Every North Splash OS surface'],
};

class OsErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('North Splash OS view error', error, info); }
  render() {
    if (this.state.failed) {
      return (
        <div className="nsos-card" style={{ margin: 20 }}>
          <h2>This workspace hit a snag</h2>
          <p style={{ color: 'var(--os-muted)', margin: '8px 0 14px' }}>The rest of the OS is still running. Reset this view instead of reloading the whole app.</p>
          <button className="nsos-btn" onClick={() => { this.setState({ failed: false }); this.props.onReset?.(); }}>Back to dashboard</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function OsShell() {
  const os = useOs();
  const [view, setView] = useState<OsView>(() => {
    try { return (sessionStorage.getItem('ns-os-view') as OsView) || 'home'; } catch { return 'home'; }
  });
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem('ns-os-phone') === '1'; } catch { return false; }
  });
  const [chatTab, setChatTab] = useState<'dm' | 'space'>('dm');
  const [activeChat, setActiveChat] = useState(os.chats[0]?.id || '');
  const [peopleId, setPeopleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(os.jobs[0]?.id || null);
  const [hireOpen, setHireOpen] = useState(false);
  const [hirePreset, setHirePreset] = useState<Partial<EmployeeDraft> | undefined>();
  const [search, setSearch] = useState('');
  const [threadOpen, setThreadOpen] = useState(false);
  const [jobList, setJobList] = useState(true);

  useEffect(() => {
    try { localStorage.setItem('ns-os-phone', phone ? '1' : '0'); } catch { /* ignore */ }
  }, [phone]);

  const chat = os.chats.find((c) => c.id === activeChat) || os.chats[0];
  const person = os.employees.find((e) => e.id === peopleId);
  const job = os.jobs.find((j) => j.id === jobId) || os.jobs[0];
  const filteredChats = os.chats.filter((c) => c.kind === (chatTab === 'dm' ? 'dm' : 'space') && c.name.toLowerCase().includes(search.toLowerCase()));
  const unread = os.chats.reduce((n, c) => n + c.unread, 0);

  const go = (id: string) => {
    const next = id as OsView;
    setView(next);
    try { sessionStorage.setItem('ns-os-view', next); } catch { /* ignore */ }
    if (id === 'chat' && phone) setThreadOpen(false);
    if (id === 'people' && phone) setPeopleId(null);
    if (id === 'jobs' && phone) setJobList(true);
  };

  const openJob = (id: string) => {
    setJobId(id);
    setJobList(false);
    setView('jobs');
    try { sessionStorage.setItem('ns-os-view', 'jobs'); } catch { /* ignore */ }
  };

  const saveHire = (draft: EmployeeDraft) => {
    const emp = os.hireEmployee(draft);
    setHireOpen(false);
    setHirePreset(undefined);
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
              <button className={`nsos-row ${c.id === activeChat ? 'active' : ''}`} key={c.id} onClick={() => { setActiveChat(c.id); setThreadOpen(true); os.markChatRead(c.id); }}>
                <Avatar initials={c.initials} hue={c.hue} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong>{c.name}</strong>
                  <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.preview}</small>
                </span>
                {c.unread > 0 && <span className="nsos-unread">{c.unread}</span>}
              </button>
            ))}
            <button className="nsos-row" onClick={() => { const id = os.createChat(chatTab === 'space' ? 'New space' : 'New chat', chatTab === 'space' ? 'space' : 'dm'); setActiveChat(id); }}>
              <Plus size={16} />
              <span><strong>New {chatTab === 'space' ? 'space' : 'chat'}</strong><small>Start a thread</small></span>
            </button>
          </div>
        </>
      );
    }
    if (view === 'people') {
      return (
        <>
          <div className="nsos-pane-head"><span className="nsos-eyebrow">Directory</span><h2>People</h2></div>
          <div className="nsos-list">
            {os.employees.map((e) => (
              <button className={`nsos-row ${peopleId === e.id ? 'active' : ''}`} key={e.id} onClick={() => setPeopleId(e.id)}>
                <Avatar initials={e.initials} hue={e.hue} />
                <span><strong>{e.name}</strong><small>{e.title}</small></span>
              </button>
            ))}
          </div>
        </>
      );
    }
    if (view === 'jobs' || view === 'calendar') {
      return (
        <>
          <div className="nsos-pane-head"><span className="nsos-eyebrow">Today</span><h2>Jobs</h2></div>
          <div className="nsos-list">
            {os.jobs.map((j) => (
              <button className={`nsos-row ${jobId === j.id ? 'active' : ''}`} key={j.id} onClick={() => openJob(j.id)}>
                <span><strong>{j.customer}</strong><small>{j.service} · {j.status.replaceAll('_', ' ')}</small></span>
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
  }, [view, chatTab, search, filteredChats, activeChat, os.employees, os.jobs, peopleId, jobId]);

  const headline = phone && view === 'chat' && threadOpen && chat
    ? chat.name
    : person && view === 'people'
      ? person.name
      : job && view === 'jobs' && !jobList
        ? job.customer
        : titles[0];

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
        <div className="nsos-demo-banner">North Splash OS preview · demo data until Supabase is connected · saved in this browser</div>
        <header className="nsos-top">
          <div>
            <p className="nsos-eyebrow">{os.settings.company}</p>
            <h1>{headline}</h1>
            <p>{titles[1]}</p>
          </div>
          <div className="nsos-actions">
            {view === 'people' && <button className="nsos-btn" onClick={() => { setHirePreset(undefined); setHireOpen(true); }}>Add employee</button>}
            {!phone && (
              <OmniSearch
                onGo={go}
                onOpenPerson={(id) => { setView('people'); setPeopleId(id); }}
                onOpenJob={openJob}
                onOpenChat={(id) => { setActiveChat(id); setView('chat'); setThreadOpen(true); os.markChatRead(id); }}
              />
            )}
            <button className="nsos-btn ghost" onClick={() => setPhone((v) => !v)}><Smartphone size={14} />{phone ? 'Desktop' : 'iPhone'}</button>
          </div>
        </header>
        <div className="nsos-body">
          <OsErrorBoundary onReset={() => go('home')}>
          {view === 'home' && <OwnerDashboard onOpenJob={openJob} onOpenPayments={() => go('payments')} onOpenPipeline={() => go('pipeline')} />}
          {view === 'chat' && chat && phone && !threadOpen && (
            <div>
              <div className="nsos-tabs">
                <button className={chatTab === 'dm' ? 'active' : ''} onClick={() => setChatTab('dm')}>Chats</button>
                <button className={chatTab === 'space' ? 'active' : ''} onClick={() => setChatTab('space')}>Spaces</button>
              </div>
              {filteredChats.map((c) => (
                <button className="nsos-row" key={c.id} onClick={() => { setActiveChat(c.id); setThreadOpen(true); os.markChatRead(c.id); }}>
                  <Avatar initials={c.initials} hue={c.hue} />
                  <span style={{ minWidth: 0, flex: 1 }}><strong>{c.name}</strong><small>{c.preview}</small></span>
                  {c.unread > 0 && <span className="nsos-unread">{c.unread}</span>}
                </button>
              ))}
            </div>
          )}
          {view === 'chat' && chat && (!phone || threadOpen) && (
            <div className="nsos-chat-wrap">
              {phone && <button className="nsos-btn ghost" style={{ marginBottom: 10 }} onClick={() => setThreadOpen(false)}>Back to chats</button>}
              <ChatThread chat={chat} onSend={(body) => os.sendChat(chat.id, body)} />
            </div>
          )}
          {view === 'people' && !person && <PeopleHome employees={os.employees} onOpen={setPeopleId} onHire={() => { setHirePreset(undefined); setHireOpen(true); }} />}
          {view === 'people' && person && (
            <div>
              {phone && <button className="nsos-btn ghost" style={{ marginBottom: 10 }} onClick={() => setPeopleId(null)}>Back to directory</button>}
              <PeopleProfile employee={person} />
            </div>
          )}
          {view === 'schedule' && <ScheduleView />}
          {view === 'calendar' && <CalendarView onOpen={openJob} />}
          {view === 'dispatch' && <DispatchView onOpen={openJob} />}
          {view === 'd2d' && <D2DView onBook={openJob} />}
          {view === 'pipeline' && <PipelineView onBook={openJob} />}
          {view === 'customers' && <CustomersView onOpenJob={openJob} />}
          {view === 'jobs' && phone && jobList && <JobsHome jobs={os.jobs} onOpen={openJob} />}
          {view === 'jobs' && job && (!phone || !jobList) && (
            <div>
              {phone && <button className="nsos-btn ghost" style={{ marginBottom: 10 }} onClick={() => setJobList(true)}>Back to jobs</button>}
              <JobDetail job={job} />
            </div>
          )}
          {view === 'payments' && <PaymentsView />}
          {view === 'reports' && <ReportsView />}
          {view === 'hire' && <HireView onHire={(name, title) => { setHirePreset({ name: name || '', title: title || '' }); setHireOpen(true); }} />}
          {view === 'comms' && <CommsView />}
          {view === 'settings' && <SettingsView />}
          {view === 'more' && <MoreGrid onPick={go} />}
          </OsErrorBoundary>
        </div>
        <nav className="nsos-bottom">
          <button className={view === 'home' ? 'active' : ''} onClick={() => go('home')}><Home size={18} />Home</button>
          <button className={view === 'chat' ? 'active' : ''} onClick={() => go('chat')}><MessageCircle size={18} />Chat</button>
          <button className={view === 'd2d' ? 'active' : ''} onClick={() => go('d2d')}><MapPinned size={18} />Leads</button>
          <button className={view === 'jobs' ? 'active' : ''} onClick={() => go('jobs')}><Briefcase size={18} />Jobs</button>
          <button className={view === 'more' ? 'active' : ''} onClick={() => go('more')}><MoreHorizontal size={18} />More</button>
        </nav>
      </main>
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
  return (
    <OsProvider>
      <OsShell />
    </OsProvider>
  );
}
