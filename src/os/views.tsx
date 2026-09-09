import { useEffect, useState } from 'react';
import {
  BarChart2, Bell, Calendar, CalendarClock, CalendarDays, Car, Check, ChevronRight, Clock3, CreditCard, DollarSign, GripVertical, MapPin, MessageCircle, Navigation, Plus, Search, Send, Smartphone, Target, Trash2, TrendingUp, UserCheck, Users,
} from 'lucide-react';
import AddEmployeeForm from '@/components/AddEmployeeForm';
import SalesPresentation from '@/components/SalesPresentation';
import OnboardingTab from './OnboardingTab';
import { APPT_SLOTS, formatJobWindow, isTodayStamp, jobMatchesDay, liveOpenSlots, slotConflict } from './appointmentSlots';
import { channelLabel, COMM_GROUPS, COMM_VARIABLES, fillTemplate, SAMPLE_VARS } from '@/lib/communicationCatalog';
import { emptyEmployeeDraft, SYSTEM_ROLES, type EmployeeDraft } from '@/lib/rolePresets';
import { firstWord, isSettledPayment, money, prettyLabel, trendLabel } from '@/lib/data';
import { DETAIL_FAMILY_COPY, packagesForFamily } from '@/lib/detailCatalog';
import { ServiceMenuSelect } from '@/components/DetailSelfPicker';
import { remainingStepLabels } from '@/lib/onboarding';
import { SR_STATUSES, composedLeadIdentity, fieldsFromLead, srStatus } from '@/lib/salesRabbitLeads';
import { householdAsLeadFields, type ApplyOfferResult, type OfferSelection } from '@/lib/customerAccount';
import {
  JOB_STEP_LABELS, JOB_STEPS, LEAD_STAGES, SHIFT_DAYS, WEEKDAYS, initialsOf, payLine, revenueDays,
  type JobStatus, type OsChat, type OsEmployee, type OsJob, type OsLead,
} from './demoData';
import { useOs } from './osStore';

export function Avatar({ initials, hue, size = 40, photo }: { initials: string; hue: string; size?: number; photo?: string }) {
  if (photo) return <img className="nsos-avatar" src={photo} alt="" style={{ width: size, height: size }} />;
  return <span className="nsos-avatar" style={{ width: size, height: size, background: hue, fontSize: size * 0.32 }}>{initials}</span>;
}

function jobOpen(j: OsJob) {
  return j.status !== 'completed';
}
function jobUnassigned(j: OsJob) {
  return !j.detailer || j.detailer === 'Unassigned';
}
function statusClass(status: JobStatus) {
  return `status-badge st-${status}`;
}
function jobClock(time?: string | null) {
  const value = String(time || '');
  return value.includes('·') ? value.split('·')[1].trim() : value;
}

function SrMapPin({
  lead, selected, className = '', style, onClick,
}: {
  lead: OsLead;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const pin = srStatus(lead.status);
  return (
    <button
      type="button"
      className={`ns-sr-pin nsos-map-pin ${selected ? 'selected' : ''} ${className}`}
      style={{ ...style, ['--pin' as string]: pin.color }}
      title={`${lead.name} · ${pin.name} · ${lead.address}`}
      onClick={onClick}
    >
      <b>{pin.abbr}</b>
    </button>
  );
}

function SrStatusDot({ status }: { status: string }) {
  const pin = srStatus(status);
  return <i className="nsos-sr-dot" style={{ background: pin.color }} title={`${pin.abbr} · ${pin.name}`} />;
}

function srPillTone(status: string) {
  const key = srStatus(status).key;
  if (key === 'do_not_knock' || key === 'not_interested' || key === 'cancelled' || key === 'lost') return 'red';
  if (key === 'sold' || key === 'customer' || key === 'appointment_set' || key === 'interested') return 'green';
  if (key === 'estimate' || key === 'follow_up' || key === 'revisit' || key === 'no_answer') return 'gold';
  return 'blue';
}

function isWorkedLead(status: string) {
  return srStatus(status).key !== 'unworked';
}

function isClosedLead(status: string) {
  const key = srStatus(status).key;
  return key === 'do_not_knock' || key === 'sold' || key === 'customer' || key === 'not_interested' || key === 'cancelled' || key === 'lost';
}

function StripeKpi({ label, value, delta, onOpen }: { label: string; value: string; delta?: string; onOpen?: () => void }) {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {delta ? <small className="nsos-delta">{delta}</small> : null}
    </>
  );
  if (!onOpen) return <div className="phase-kpi">{body}</div>;
  return <button type="button" className="phase-kpi nsos-kpi-link" onClick={onOpen}>{body}</button>;
}

function OwnerRevenueChart({ days }: { days: { label: string; rev: number }[] }) {
  const width = 620;
  const height = 230;
  const pad = 28;
  const max = Math.max(1, ...days.map((d) => d.rev));
  const pts = days.map((d, i) => {
    const x = pad + i * (width - pad * 2) / Math.max(1, days.length - 1);
    const y = height - pad - (d.rev / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1] || [pad, height - pad];
  const first = pts[0] || [pad, height - pad];
  const area = `${line} L ${last[0]} ${height - pad} L ${first[0]} ${height - pad} Z`;
  return (
    <div className="v20-owner-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue trend">
        <defs>
          <linearGradient id="ownerRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9ad4a" stopOpacity=".32" />
            <stop offset="100%" stopColor="#d9ad4a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[.25, .5, .75, 1].map((n) => (
          <line key={n} x1={pad} x2={width - pad} y1={height - pad - (height - pad * 2) * n} y2={height - pad - (height - pad * 2) * n} className="v20-chart-grid" />
        ))}
        <path d={area} className="v20-chart-area" />
        <path d={line} className="v20-chart-line" />
        {pts.map(([x, y], i) => (
          <circle key={days[i].label} cx={x} cy={y} r="4" className="v20-chart-point">
            <title>{days[i].label}: {money(days[i].rev)}</title>
          </circle>
        ))}
      </svg>
      <div className="v20-chart-labels">{days.map((d) => <span key={d.label}><b>{d.label}</b><small>{money(d.rev)}</small></span>)}</div>
    </div>
  );
}

type OwnerDashProps = {
  onOpenJob?: (id: string) => void;
  onOpenPayments?: () => void;
  onOpenPipeline?: () => void;
  onNewAppointment?: () => void;
  onNewCustomer?: () => void;
  onNewLead?: () => void;
  onNewEmployee?: () => void;
  onOpenTeam?: () => void;
  onOpenSchedule?: () => void;
  onOpenDispatch?: () => void;
  onOpenMessages?: () => void;
};

export function OwnerDashboard({
  onOpenJob, onOpenPayments, onOpenPipeline, onNewAppointment, onNewCustomer, onNewLead, onNewEmployee, onOpenTeam, onOpenSchedule, onOpenDispatch, onOpenMessages,
}: OwnerDashProps) {
  const { jobs, payments, leads, employees } = useOs();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const ownerName = firstWord(employees.find((e) => e.role === 'owner')?.name, 'Jordan');
  const today = jobs.filter((j) => jobMatchesDay(j, new Date()) && jobOpen(j));
  const scheduledRev = today.reduce((s, j) => s + Number(j.price || 0), 0);
  const collected = payments.filter((p) => isSettledPayment(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const completed = jobs.filter((j) => j.status === 'completed');
  const completedRev = completed.reduce((s, j) => s + Number(j.price || 0), 0);
  const avgTicket = completed.length ? Math.round(completedRev / completed.length) : 0;
  const newLeads = leads.filter((l) => srStatus(l.status).key === 'unworked').length;
  const earlierCollected = payments.filter((p) => isSettledPayment(p.status) && String(p.at || '').includes('Yesterday')).reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayCollected = payments.filter((p) => isSettledPayment(p.status) && isTodayStamp(p.at)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeTeam = employees.filter((e) => e.status === 'active');
  const activeDetailers = employees.filter((e) => e.status === 'active' && e.role === 'detailer').length;
  const unassigned = jobs.filter((j) => jobOpen(j) && jobUnassigned(j));
  const unpaid = jobs.filter((j) => j.payment === 'due' && j.status !== 'scheduled');
  const hotLeads = leads.filter((l) => l.temp === 'hot' && !isClosedLead(l.status));
  const pending = jobs.filter((j) => j.status === 'scheduled').length;
  const next = today[0] || jobs.find(jobOpen);
  const d2d = leads.filter((l) => !isClosedLead(l.status)).length;
  const assigned = jobs.filter((j) => jobOpen(j) && !jobUnassigned(j)).length;
  const exceptions = [
    unassigned.length ? { n: unassigned.length, title: 'Unassigned jobs', sub: 'Need a technician', go: onOpenDispatch, hot: true } : null,
    unpaid.length ? { n: unpaid.length, title: 'Unpaid invoices', sub: 'Collect before the van leaves', go: onOpenPayments, hot: true } : null,
    hotLeads.length ? { n: hotLeads.length, title: 'Hot leads', sub: 'Ready to book from the map', go: onOpenPipeline, hot: true } : null,
    pending ? { n: pending, title: 'Pending bookings', sub: 'Awaiting confirmation', go: onOpenSchedule, hot: false } : null,
  ].filter(Boolean) as { n: number; title: string; sub: string; go?: () => void; hot: boolean }[];
  const days = revenueDays.map((d) => ({ label: d.d, rev: d.v }));

  return (
    <div className="tab-content owner-command-v17 nsos-command">
      <div className="owner-command-head">
        <div>
          <span className="eyebrow">OWNER / COMMAND CENTER</span>
          <h2>{greeting}, <em>{ownerName}</em></h2>
          <p>Today’s run first, then what still needs you.</p>
        </div>
        <div className="nsos-quick">
          <button type="button" onClick={onNewLead}><Target size={16} />New Lead</button>
          <button type="button" onClick={onNewAppointment}><Plus size={16} />Book</button>
          <button type="button" onClick={onOpenDispatch}><CalendarClock size={16} />Assign</button>
          <button type="button" onClick={onOpenMessages}><MessageCircle size={16} />Message</button>
        </div>
      </div>
      <nav className="nsos-owner-jump" aria-label="Jump to owner sections">
        <a href="#ns-today">Today</a>
        <a href="#ns-exceptions">Needs you</a>
        <a href="#ns-revenue">Revenue</a>
        <a href="#ns-pipeline">Pipeline</a>
        <button type="button" onClick={onOpenSchedule}>Open calendar</button>
        <button type="button" onClick={onOpenTeam}>Open team</button>
      </nav>

      {today.length > 0 && (
        <div className="nsos-today-strip" aria-label="Today’s jobs">
          {today.slice(0, 4).map((j) => (
            <button type="button" key={j.id} onClick={() => onOpenJob?.(j.id)}>
              <time>{jobClock(j.time)} · {money(j.price)}</time>
              <b>{j.customer}</b>
              <small>{j.service}</small>
            </button>
          ))}
          {today.length > 4 && (
            <button type="button" className="nsos-today-more" onClick={onOpenSchedule}>+{today.length - 4} more</button>
          )}
        </div>
      )}

      <div className="nsos-alerts" id="ns-exceptions">
        {exceptions.length === 0 && <div className="ns-empty">Nothing needs you right now. The board is clean.</div>}
        {exceptions.map((item) => (
          <button className={`nsos-alert ${item.hot ? 'hot' : ''}`} key={item.title} onClick={item.go}>
            <em>{item.n}</em>
            <span><b>{item.title}</b><small>{item.sub}</small></span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>

      <div className="owner-kpis-v17">
        <StripeKpi label="Collected" value={money(collected)} delta={trendLabel(todayCollected, earlierCollected)} onOpen={onOpenPayments} />
        <StripeKpi label="Jobs completed" value={String(completed.length)} onOpen={onOpenSchedule} />
        <StripeKpi label="New leads" value={String(newLeads)} onOpen={onOpenPipeline} />
        <StripeKpi label="Avg job" value={money(avgTicket)} onOpen={onOpenPayments} />
      </div>

      <section className="owner-glance-v17">
        <div><CalendarClock /><span><b>{today.length}</b><small>Jobs today</small></span></div>
        <div><DollarSign /><span><b>{money(scheduledRev)}</b><small>Booked today</small></span></div>
        <div><Users /><span><b>{activeDetailers}</b><small>Detailers active</small></span></div>
        <div>
          <Clock3 />
          <span>
            <b>{next ? jobClock(next.time) : '—'}</b>
            <small>{next ? `${next.service} · ${next.customer}` : 'No next job'}</small>
          </span>
        </div>
      </section>

      <div className="owner-command-grid-v17">
        <section className="phase-panel owner-schedule-v17" id="ns-today">
          <div className="phase-panel-head">
            <div><span className="eyebrow">TODAY'S SCHEDULE</span><h3>{today.length} jobs</h3></div>
            <button className="btn-outline btn-sm" onClick={onOpenSchedule}>View all</button>
          </div>
          {today.slice(0, 6).map((j) => {
            const tech = employees.find((e) => e.name === j.detailer);
            return (
              <button className="owner-job-v17" key={j.id} onClick={() => onOpenJob?.(j.id)}>
                <time>{jobClock(j.time)}</time>
                <span><b>{j.customer}</b><small>{j.vehicle || 'Vehicle not added'}</small></span>
                <span><b>{j.service}</b><small>{money(j.price)}</small></span>
                <span>
                  {tech ? <Avatar initials={tech.initials} hue={tech.hue} photo={tech.photo} size={24} /> : null}
                  <small>{j.detailer || 'Unassigned'}</small>
                  <b className={statusClass(j.status)}>{prettyLabel(j.status)}</b>
                </span>
              </button>
            );
          })}
          {!today.length && <div className="ns-empty">No appointments today. Your next scheduled job will appear here.</div>}
        </section>
        <section className="phase-panel owner-revenue-v17" id="ns-revenue">
          <div className="phase-panel-head">
            <div><span className="eyebrow">COLLECTED</span><h3>{money(collected)}</h3></div>
            <small>Settled payments on the board</small>
          </div>
          <OwnerRevenueChart days={days} />
          <div className="owner-mini-metrics">
            <div><small>Lifetime collected</small><b>{money(collected)}</b></div>
            <div><small>Avg ticket</small><b>{money(avgTicket)}</b></div>
            <div><small>Days shown</small><b>{days.length}</b></div>
          </div>
        </section>
        <section className="phase-panel owner-attention-v17">
          <div className="phase-panel-head"><div><span className="eyebrow">TEAM</span><h3>{activeTeam.length} active</h3></div>
            <button className="btn-outline btn-sm" onClick={onOpenTeam}>Directory</button>
          </div>
          <div className="v20-team-list">
            {activeTeam.slice(0, 5).map((e) => (
              <div key={e.id}>
                <span className="v20-mini-avatar">{e.photo ? <img src={e.photo} alt="" /> : e.initials}</span>
                <span><b>{e.name}</b><small>{e.title}</small></span>
                <i className={e.status === 'active' ? 'online' : ''} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="owner-bottom-v17 v20-owner-bottom">
        <section className="phase-panel v20-pipeline-panel" id="ns-pipeline">
          <div className="phase-panel-head"><div><span className="eyebrow">SALES PIPELINE</span><h3>Booking flow</h3></div></div>
          <div className="v20-stage-flow">
            <div><span>D2D</span><b>{d2d}</b></div><i />
            <div><span>Pending</span><b>{pending}</b></div><i />
            <div><span>Assigned</span><b>{assigned}</b></div><i />
            <div><span>Completed</span><b>{completed.length}</b></div>
          </div>
          <button className="btn-outline btn-sm" style={{ marginTop: 14 }} onClick={onOpenPipeline}>Open pipeline</button>
        </section>
        <section className="phase-panel v20-health-panel">
          <div className="phase-panel-head"><div><span className="eyebrow">BUSINESS HEALTH</span><h3>30-day snapshot</h3></div></div>
          <div className="owner-summary-cells nsos-health-cells">
            <div><b>{money(collected)}</b><small>Revenue</small></div>
            <div><b>{completed.length}</b><small>Completed</small></div>
            <div><b>{money(avgTicket)}</b><small>Avg ticket</small></div>
            <div><b>{unpaid.length}</b><small>Unpaid</small></div>
          </div>
        </section>
        <section className="phase-panel">
          <div className="phase-panel-head"><div><span className="eyebrow">QUICK CREATE</span><h3>Fewer clicks</h3></div></div>
          <div className="nsos-actions">
            <button className="nsos-btn" onClick={onNewAppointment}>Book job</button>
            <button className="nsos-btn ghost" onClick={onNewCustomer}>Customer</button>
            <button className="nsos-btn ghost" onClick={onNewEmployee}>Hire</button>
            <button className="nsos-btn ghost" onClick={onOpenPayments}>Collect</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function employeeLevel(e: OsEmployee) {
  if (e.role === 'owner') return 5;
  if (e.role === 'manager' || e.role === 'admin') return 4;
  if (e.role === 'detailer') return 3;
  return 2;
}

export function OwnerStripeDashboard({
  onOpenJob, onOpenSchedule, onOpenTeam,
}: {
  onOpenJob?: (id: string) => void;
  onOpenSchedule?: () => void;
  onOpenTeam?: () => void;
}) {
  const { jobs, payments, employees, customers } = useOs();
  const collected = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
  const monthRevenue = jobs.filter((j) => jobMatchesDay(j, new Date()) || (j.time || '').includes('Tomorrow') || j.status === 'completed').reduce((s, j) => s + Number(j.price || 0), 0);
  const detailers = employees.filter((e) => e.role === 'detailer');
  const d2dAgents = employees.filter((e) => e.role === 'd2d_agent');
  const managers = employees.filter((e) => e.role === 'manager');
  const months = [
    { label: 'Apr', revenue: Math.round(collected * .55) },
    { label: 'May', revenue: Math.round(collected * .68) },
    { label: 'Jun', revenue: Math.round(collected * .74) },
    { label: 'Jul', revenue: Math.round(collected * .81) },
    { label: 'Aug', revenue: Math.round(collected * .9) },
    { label: 'Sep', revenue: Math.max(collected, monthRevenue) },
  ];
  const maxRevenue = Math.max(1, ...months.map((m) => m.revenue));
  const recent = [...jobs].slice(0, 5);
  const roster = [...employees]
    .map((e) => ({ e, jobs: jobs.filter((j) => j.detailer === e.name).length }))
    .sort((a, b) => {
      if (a.e.role === 'owner') return -1;
      if (b.e.role === 'owner') return 1;
      return b.jobs - a.jobs || a.e.name.localeCompare(b.e.name);
    })
    .slice(0, 4);

  return (
    <div className="tab-content admin-dashboard nsos-stripe-dash">
      <nav className="nsos-owner-jump" aria-label="Owner shortcuts">
        <a href="#ns-cashflow">Cash flow</a>
        <a href="#ns-appointments">Appointments</a>
        <a href="#ns-team">Team</a>
        <button type="button" onClick={onOpenSchedule}>Open calendar</button>
        <button type="button" onClick={onOpenTeam}>Open team</button>
      </nav>
      <div className="admin-stats-row">
        <div className="admin-stat stat-gold">
          <div className="admin-stat-header"><span>Total Revenue</span><div className="admin-stat-icon"><DollarSign size={16} /></div></div>
          <strong>{money(collected)}</strong>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-header"><span>This Month</span><div className="admin-stat-icon"><TrendingUp size={16} /></div></div>
          <strong>{money(monthRevenue)}</strong>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-header"><span>Customers</span><div className="admin-stat-icon"><Users size={16} /></div></div>
          <strong>{customers.length}</strong>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-header"><span>Appointments</span><div className="admin-stat-icon"><Calendar size={16} /></div></div>
          <strong>{jobs.length}</strong>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-header"><span>Team Members</span><div className="admin-stat-icon"><UserCheck size={16} /></div></div>
          <strong>{employees.length}</strong>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-header"><span>Open jobs</span><div className="admin-stat-icon"><CalendarClock size={16} /></div></div>
          <strong>{jobs.filter((j) => j.status !== 'completed').length}</strong>
        </div>
      </div>

      <section className="phase-panel nsos-cashflow" id="ns-cashflow">
        <div className="phase-panel-head"><div><span className="eyebrow">STRIPE</span><h3><BarChart2 size={16} /> Monthly Cash Flow</h3></div></div>
        <div className="cashflow-chart">
          {months.map((m) => (
            <div className="cashflow-bar-wrap" key={m.label}>
              <div className="cashflow-amount">{money(m.revenue)}</div>
              <div className="cashflow-bar-bg">
                <div className="cashflow-bar-fill" style={{ height: `${Math.max(12, (m.revenue / maxRevenue) * 100)}%` }} />
              </div>
              <div className="cashflow-label">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-two-col">
        <section className="phase-panel" id="ns-appointments">
          <div className="phase-panel-head">
            <div><span className="eyebrow">Schedule</span><h3><Calendar size={16} /> Recent Appointments</h3></div>
            <button className="btn-outline btn-sm" onClick={onOpenSchedule}>View all</button>
          </div>
          {recent.map((j) => (
            <button className="nsos-job" key={j.id} onClick={() => onOpenJob?.(j.id)} style={{ width: '100%', textAlign: 'left' }}>
              <div>
                <strong>{j.service}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.customer} · {j.time}</div>
              </div>
              <span className={statusClass(j.status)}>{prettyLabel(j.status)}</span>
            </button>
          ))}
          {recent.length === 0 && <div className="ns-empty">No appointments yet.</div>}
        </section>

        <section className="phase-panel" id="ns-team">
          <div className="phase-panel-head">
            <div><span className="eyebrow">Team</span><h3><UserCheck size={16} /> Team Overview</h3></div>
            <button className="btn-outline btn-sm" onClick={onOpenTeam}>View all</button>
          </div>
          <div className="team-overview nsos-team-overview">
            <div className="team-stat"><Car size={18} /><div><strong>{detailers.length}</strong><span>Detailers</span></div></div>
            <div className="team-stat"><Users size={18} /><div><strong>{d2dAgents.length}</strong><span>D2D Agents</span></div></div>
            <div className="team-stat"><UserCheck size={18} /><div><strong>{managers.length}</strong><span>Managers</span></div></div>
          </div>
          {roster.map(({ e, jobs: jobCount }) => (
            <div className="admin-row nsos-team-row" key={e.id}>
              <div className="admin-row-main">
                <Avatar initials={e.initials} hue={e.hue} photo={e.photo} size={32} />
                <span>
                  <strong>{e.name}</strong>
                  <small>{e.title}</small>
                </span>
              </div>
              <div className="admin-row-right">
                <span className="status-badge st-confirmed">{prettyLabel(e.role)}</span>
                <span className="nsos-pill">Level {employeeLevel(e)}</span>
                <small>{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</small>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function ChatThread({ chat, onSend }: { chat: OsChat; onSend: (body: string) => void }) {
  const os = useOs();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chat.name);
  const todayJobs = os.jobs.filter((j) => j.status !== 'completed').slice(0, 3);
  return (
    <div className="nsos-chat">
      <div className="nsos-thread-head">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); os.renameChat(chat.id, name.trim() || chat.name); setEditing(false); }} style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input className="nsos-inline" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="nsos-btn" type="submit">Save</button>
          </form>
        ) : (
          <button className="nsos-ghost-title" onClick={() => { setName(chat.name); setEditing(true); }}>{chat.name}</button>
        )}
      </div>
      <div className="nsos-thread">
        {chat.topic && <div className="nsos-topic">#{chat.topic}</div>}
        {(chat.messages || []).map((m) => (
          <div className={`nsos-bubble ${m.mine ? 'mine' : ''}`} key={m.id}>
            {!m.mine && <b>{m.from}</b>}
            {m.body}
            <time>{m.at}</time>
          </div>
        ))}
      </div>
      <div className="nsos-chips">
        {todayJobs.map((j) => (
          <button key={j.id} type="button" onClick={() => onSend(`Job card: ${j.customer} · ${j.service} · ${prettyLabel(j.status)} · ${j.address}`)}>Share {firstWord(j.customer, 'job')}</button>
        ))}
      </div>
      <form className="nsos-composer" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; onSend(draft.trim()); setDraft(''); }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!draft.trim()) return;
              onSend(draft.trim());
              setDraft('');
            }
          }}
          placeholder={`Message ${chat.name}`}
          rows={1}
        />
        <button className="nsos-btn" type="submit"><Send size={14} />Send</button>
      </form>
    </div>
  );
}

export function PeopleHome({ employees, onOpen, onHire }: { employees: OsEmployee[]; onOpen: (id: string) => void; onHire: () => void }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const rows = employees.filter((e) => {
    const hit = `${e.name} ${e.title} ${e.department}`.toLowerCase().includes(q.toLowerCase());
    return hit && (role === 'all' || e.role === role);
  });
  return (
    <div>
      <div className="nsos-actions" style={{ marginBottom: 14 }}>
        <div className="nsos-search" style={{ flex: 1 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search directory" /></div>
        <select className="nsos-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {[...new Set(employees.map((e) => e.role))].map((r) => <option key={r} value={r}>{prettyLabel(r)}</option>)}
        </select>
        <button className="nsos-btn" onClick={onHire}><Plus size={14} />Add employee</button>
      </div>
      <div className="data-table nsos-dir">
        <div className="data-table-head nsos-dir-head">
          <span>Person</span><span>Role</span><span>Status</span><span>Hours</span><span>Pay</span><span>Onboarding</span>
        </div>
        {rows.length === 0 && <div className="nsos-empty">No teammates match that search.</div>}
        {rows.map((e) => (
          <button className="data-table-row nsos-dir-row" key={e.id} onClick={() => onOpen(e.id)}>
            <span className="dt-cell dt-name">
              <Avatar initials={e.initials} hue={e.hue} photo={e.photo} size={36} />
              <span><strong>{e.name}</strong><small>{e.title} · {e.location}</small></span>
            </span>
            <span className="dt-cell" data-label="Role"><strong>{e.department}</strong><small>{prettyLabel(e.role)}</small></span>
            <span className="dt-cell" data-label="Status"><span className={`nsos-pill ${e.status === 'active' ? 'green' : e.status === 'leave' ? 'gold' : 'red'}`}>{e.status}</span></span>
            <span className="dt-cell" data-label="Hours"><strong>{e.hours_week}h</strong></span>
            <span className="dt-cell" data-label="Pay"><strong>{payLine(e)}</strong></span>
            <span className="dt-cell" data-label="Onboarding">
              <strong>{e.onboarding}%</strong>
              <i className="nsos-onboard"><b style={{ width: `${e.onboarding}%` }} /></i>
              {e.onboarding < 100 && <span className="nsos-pill gold">packet</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PeopleProfile({ employee }: { employee: OsEmployee }) {
  const os = useOs();
  const needsOnboarding = employee.onboarding < 100;
  const [tab, setTab] = useState(needsOnboarding ? 'onboarding' : 'overview');
  const shifts = os.shifts.filter((s) => s.employeeId === employee.id);
  const off = os.timeOff.filter((t) => t.employeeId === employee.id);
  const tabs = needsOnboarding
    ? ['onboarding', 'overview', 'employment', 'documents', 'pay', 'schedule']
    : ['overview', 'onboarding', 'employment', 'documents', 'pay', 'schedule'];
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Avatar initials={employee.initials} hue={employee.hue} photo={employee.photo} size={64} />
        <div style={{ flex: 1 }}>
          <span className="nsos-eyebrow">{employee.department}{needsOnboarding ? ' · onboarding' : ''}</span>
          <h2>{employee.name}</h2>
          <p style={{ color: 'var(--os-muted)' }}>{employee.title} · {employee.location}{needsOnboarding ? ` · ${employee.onboarding}% packet` : ''}</p>
        </div>
        <select className="nsos-select" value={employee.status} onChange={(e) => os.updateEmployee(employee.id, { status: e.target.value as OsEmployee['status'] })}>
          <option value="active">Active</option>
          <option value="leave">Leave</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="nsos-tabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'onboarding' && <OnboardingTab employee={employee} />}
      {tab === 'overview' && (
        <div className="nsos-kpis">
          <div className="nsos-kpi"><span>Hours this week</span><strong>{employee.hours_week}</strong></div>
          <div className="nsos-kpi"><span>Onboarding</span><strong>{employee.onboarding}%</strong></div>
          <div className="nsos-kpi"><span>Status</span><strong>{employee.status}</strong></div>
          <div className="nsos-kpi"><span>Pay</span><strong style={{ fontSize: 16 }}>{payLine(employee)}</strong></div>
        </div>
      )}
      {tab === 'employment' && (
        <div className="nsos-card nsos-hire-edit">
          <p style={{ color: 'var(--os-muted)', marginBottom: 12 }}>This hire stays editable. Change name, title, role, or contact without recreating the packet.</p>
          <label className="nsos-field">Full name
            <input value={employee.name} onChange={(ev) => os.updateEmployee(employee.id, { name: ev.target.value })} />
          </label>
          <label className="nsos-field">Job title
            <input value={employee.title} onChange={(ev) => os.updateEmployee(employee.id, { title: ev.target.value })} />
          </label>
          <label className="nsos-field">System role
            <select className="nsos-select" value={employee.role} onChange={(ev) => os.updateEmployee(employee.id, { role: ev.target.value })}>
              {SYSTEM_ROLES.map((r) => <option value={r.value} key={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="nsos-field">Department
            <input value={employee.department} onChange={(ev) => os.updateEmployee(employee.id, { department: ev.target.value })} />
          </label>
          <label className="nsos-field">Email
            <input type="email" value={employee.email} onChange={(ev) => os.updateEmployee(employee.id, { email: ev.target.value })} />
          </label>
          <label className="nsos-field">Phone
            <input value={employee.phone} onChange={(ev) => os.updateEmployee(employee.id, { phone: ev.target.value })} />
          </label>
          <label className="nsos-field">Work location
            <input value={employee.location} onChange={(ev) => os.updateEmployee(employee.id, { location: ev.target.value })} />
          </label>
          <label className="nsos-field">Hours this week
            <input type="number" value={employee.hours_week} onChange={(ev) => os.updateEmployee(employee.id, { hours_week: Number(ev.target.value) })} />
          </label>
        </div>
      )}
      {tab === 'documents' && (
        <div className="nsos-card">
          {(employee.documents || []).map((d) => (
            <button key={d.id} className="nsos-job" style={{ width: '100%', textAlign: 'left' }} onClick={() => os.toggleDocument(employee.id, d.id)}>
              <span>{d.name}</span>
              <span className={`nsos-pill ${d.status === 'complete' ? 'green' : d.status === 'review' ? 'gold' : 'red'}`}>{d.status}</span>
            </button>
          ))}
          <p style={{ color: 'var(--os-muted)', fontSize: 12, marginTop: 8 }}>Tap a document to cycle missing → review → complete. Onboarding % follows the checklist.</p>
        </div>
      )}
      {tab === 'pay' && (
        <div className="nsos-card nsos-hire-edit">
          <p style={{ color: 'var(--os-muted)', marginBottom: 12 }}>Pay mix is per person. Change it here after the hire lands.</p>
          <label className="nsos-field">Pay structure
            <select className="nsos-select" value={employee.pay_type} onChange={(ev) => os.updateEmployee(employee.id, { pay_type: ev.target.value })}>
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="base_commission">Weekly draw + commission</option>
              <option value="commission_only">Commission only</option>
              <option value="per_job">Per completed job</option>
              <option value="hourly_plus_commission">Hourly + commission</option>
              <option value="salary_plus_commission">Salary + commission</option>
              <option value="custom">Custom mix</option>
            </select>
          </label>
          <label className="nsos-field">Pay schedule
            <select className="nsos-select" value={employee.pay_schedule} onChange={(ev) => os.updateEmployee(employee.id, { pay_schedule: ev.target.value })}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="semimonthly">Twice monthly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="nsos-field">Hourly rate
            <input type="number" min="0" step="0.25" value={employee.hourly_rate} onChange={(ev) => os.updateEmployee(employee.id, { hourly_rate: Number(ev.target.value) })} />
          </label>
          <label className="nsos-field">Annual salary
            <input type="number" min="0" step="500" value={employee.annual_salary} onChange={(ev) => os.updateEmployee(employee.id, { annual_salary: Number(ev.target.value) })} />
          </label>
          <label className="nsos-field">Weekly draw
            <input type="number" min="0" step="25" value={employee.weekly_base} onChange={(ev) => os.updateEmployee(employee.id, { weekly_base: Number(ev.target.value) })} />
          </label>
          <label className="nsos-field">Commission %
            <input type="number" min="0" max="100" step="0.25" value={employee.commission_rate} onChange={(ev) => os.updateEmployee(employee.id, { commission_rate: Number(ev.target.value) })} />
          </label>
          <label className="nsos-field">Per-job rate
            <input type="number" min="0" step="5" value={employee.per_job_rate} onChange={(ev) => os.updateEmployee(employee.id, { per_job_rate: Number(ev.target.value) })} />
          </label>
          <p style={{ marginTop: 12 }}>{payLine(employee)}</p>
        </div>
      )}
      {tab === 'schedule' && (
        <div className="nsos-card">
          <div className="nsos-avail">
            {WEEKDAYS.map((d) => (
              <button key={d} className={employee.availability?.[d] ? 'on' : ''} onClick={() => os.setAvailability(employee.id, d, !employee.availability?.[d])}>{d}</button>
            ))}
          </div>
          {shifts.map((s) => <div key={s.id} style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--os-line)' }}>{s.day} · {s.start}–{s.end}</div>)}
          {off.map((t) => <div key={t.id} style={{ fontSize: 13, color: 'var(--os-muted)' }}>Time-off {t.from}–{t.to} · {t.status}</div>)}
        </div>
      )}
      {tab === 'activity' && (
        <div className="nsos-card">
          {os.activity.filter((a) => String(a.text || '').includes(firstWord(employee.name))).slice(0, 8).map((a) => (
            <div key={a.id} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--os-line)' }}>{a.at} · {a.text}</div>
          ))}
          {os.jobs.filter((j) => j.detailer === employee.name).map((j) => (
            <div key={j.id} style={{ fontSize: 13, padding: '8px 0' }}>{j.time} · {j.customer} · {prettyLabel(j.status)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScheduleView() {
  const os = useOs();
  const [bench, setBench] = useState<string>(os.employees[0]?.id || '');
  const emp = (id: string) => os.employees.find((e) => e.id === id);
  return (
    <div>
      <div className="nsos-actions" style={{ marginBottom: 12 }}>
        <select className="nsos-select" value={bench} onChange={(e) => setBench(e.target.value)}>
          {os.employees.filter((e) => e.status !== 'inactive').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <span style={{ color: 'var(--os-muted)', fontSize: 12 }}>Drag a shift between days, or add from the bench onto a column.</span>
      </div>
      <div className="nsos-card">
        <span className="nsos-eyebrow">Staff board</span>
        <h3>This week</h3>
        <div className="nsos-kanban nsos-week" style={{ marginTop: 12 }}>
          {SHIFT_DAYS.map((d) => (
            <div
              className="nsos-col nsos-drop"
              key={d}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const shiftId = e.dataTransfer.getData('shift');
                const employeeId = e.dataTransfer.getData('employee');
                if (shiftId) os.moveShift(shiftId, d);
                else if (employeeId) os.addShift(employeeId, d);
                else if (bench) os.addShift(bench, d);
              }}
            >
              <h3>{d}</h3>
              {os.shifts.filter((s) => s.day === d).map((s) => {
                const person = emp(s.employeeId);
                if (!person) return null;
                return (
                  <div
                    className="nsos-shift"
                    key={s.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('shift', s.id)}
                  >
                    <strong><GripVertical size={12} /> {firstWord(person.name)}</strong>
                    <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{s.start}–{s.end}</div>
                    <button className="nsos-icon-btn" onClick={() => os.removeShift(s.id)} aria-label="Remove shift"><Trash2 size={12} /></button>
                  </div>
                );
              })}
              <button className="nsos-ghost-add" onClick={() => bench && os.addShift(bench, d)}>+ Add {firstWord(emp(bench)?.name)}</button>
            </div>
          ))}
        </div>
      </div>
      <div className="nsos-grid-2" style={{ marginTop: 14 }}>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Availability</span>
          {os.employees.filter((e) => e.status === 'active').map((e) => (
            <div key={e.id} className="nsos-avail-row">
              <b>{firstWord(e.name)}</b>
              <div className="nsos-avail">
                {WEEKDAYS.map((d) => (
                  <button key={d} className={e.availability?.[d] ? 'on' : ''} onClick={() => os.setAvailability(e.id, d, !e.availability?.[d])}>{d.slice(0, 1)}</button>
                ))}
              </div>
            </div>
          ))}
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Time-off</span>
          {os.timeOff.map((t) => {
            const person = emp(t.employeeId);
            return (
              <div className="nsos-job" key={t.id}>
                <div>
                  <strong>{person?.name}</strong>
                  <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{t.from}–{t.to} · {t.reason}</div>
                </div>
                <div className="nsos-actions">
                  {t.status === 'pending' ? (
                    <>
                      <button className="nsos-btn" onClick={() => os.setTimeOffStatus(t.id, 'approved')}>Approve</button>
                      <button className="nsos-btn ghost" onClick={() => os.setTimeOffStatus(t.id, 'denied')}>Deny</button>
                    </>
                  ) : <span className={`nsos-pill ${t.status === 'approved' ? 'green' : 'red'}`}>{t.status}</span>}
                </div>
              </div>
            );
          })}
          <button className="nsos-btn ghost" style={{ marginTop: 8 }} onClick={() => bench && os.requestTimeOff(bench, 'Personal day')}>Request time-off for bench</button>
        </section>
      </div>
    </div>
  );
}

export function CalendarView({ onOpen }: { onOpen: (id: string) => void }) {
  const os = useOs();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [bookError, setBookError] = useState('');
  const today = new Date();
  const calDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [picked, setPicked] = useState(today.getDay());
  const [filter, setFilter] = useState<'all' | 'jobs' | 'leads' | 'shifts'>('all');
  const weekStart = new Date(today);
  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(today.getDate() - today.getDay());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const pickedDate = week[picked];
  const dayLabel = (offset: number) => {
    if (offset === today.getDay()) return 'Today';
    if (offset === (today.getDay() + 1) % 7) return 'Tomorrow';
    return calDays[offset];
  };
  const [draft, setDraft] = useState({
    customer: '', email: '', phone: '', service: 'Luxe Signature', vehicle: '', address: '', time: '10:00 AM',
    price: 275, detailer: os.employees.find((e) => e.role === 'detailer')?.name || 'Marcus Hale',
  });
  const query = q.toLowerCase();
  const label = dayLabel(picked);
  const weekday = calDays[picked] as typeof WEEKDAYS[number];
  const jobsToday = os.jobs.filter((j) => {
    const hit = `${j.customer} ${j.service} ${j.vehicle} ${j.address}`.toLowerCase().includes(query);
    return hit && jobMatchesDay(j, pickedDate);
  });
  const leadsToday = os.leads.filter((l) => `${l.name} ${l.address}`.toLowerCase().includes(query) && ['appointment_set', 'interested', 'sold', 'estimate'].includes(srStatus(l.status).key));
  const shiftsToday = os.shifts.filter((s) => s.day === weekday);
  const showJobs = filter === 'all' || filter === 'jobs';
  const showLeads = filter === 'all' || filter === 'leads';
  const showShifts = filter === 'all' || filter === 'shifts';
  const groups = jobsToday.reduce((m, j) => {
    const clock = String(j.time || '').split('·')[1]?.trim() || j.time || 'Anytime';
    m.set(clock, [...(m.get(clock) || []), j]);
    return m;
  }, new Map<string, OsJob[]>());
  const bookAppointment = (confirm: boolean) => {
    if (!draft.customer.trim()) return;
    if (slotConflict(os.jobs, draft.detailer, pickedDate, draft.time)) {
      setBookError(`${draft.detailer} needs job time plus a travel buffer through ${draft.time} on ${label}. Pick a later window or another tech.`);
      return;
    }
    setBookError('');
    const id = os.createJob({
      ...draft,
      time: formatJobWindow(pickedDate, draft.time),
      confirm,
    });
    setOpen(false);
    setDraft({ ...draft, customer: '', email: '', phone: '', vehicle: '', address: '' });
    onOpen(id);
  };
  return (
    <div className="nsos-cal">
      <div className="nsos-cal-toolbar">
        <div>
          <span className="nsos-eyebrow">Appointment calendar</span>
          <h3>{label}</h3>
          <p className="nsos-cal-date">{pickedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="nsos-btn" onClick={() => { setOpen((v) => !v); setBookError(''); }}><Plus size={14} />New appointment</button>
      </div>
      <div className="nsos-week" role="tablist" aria-label="This week">
        {week.map((d, i) => (
          <button key={d.toISOString()} type="button" className={picked === i ? 'active' : ''} onClick={() => setPicked(i)}>
            <small>{calDays[i]}</small>
            <b>{d.getDate()}</b>
          </button>
        ))}
      </div>
      <div className="nsos-tabs" style={{ marginBottom: 12 }}>
        {([['all', 'Board'], ['jobs', 'Jobs'], ['leads', 'Leads'], ['shifts', 'Shifts']] as const).map(([id, name]) => (
          <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{name}</button>
        ))}
      </div>
      <div className="nsos-search" style={{ marginBottom: 12 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the day" /></div>
      {open && (
        <form className="nsos-card nsos-book-form" style={{ marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); bookAppointment(false); }}>
          <span className="nsos-eyebrow">Book into {label}</span>
          <p className="nsos-book-hint">Sends a confirmation request. Use Confirm now only after the customer agrees to the window.</p>
          <div className="form-row">
            <label className="nsos-field">Customer<input required autoComplete="name" value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} /></label>
            <label className="nsos-field">Vehicle<input value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })} placeholder="Year make model" /></label>
          </div>
          <div className="form-row">
            <label className="nsos-field">Phone<input type="tel" autoComplete="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="919-000-0000" /></label>
            <label className="nsos-field">Email<input type="email" autoComplete="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@email.com" /></label>
          </div>
          <label className="nsos-field">Service
            <ServiceMenuSelect value={draft.service} onChange={(name, pkg) => setDraft({ ...draft, service: name, price: pkg?.price ?? draft.price })} />
          </label>
          <div className="form-row">
            <label className="nsos-field">When
              <select value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })}>
                {APPT_SLOTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="nsos-field">Detailer
              <select value={draft.detailer} onChange={(e) => setDraft({ ...draft, detailer: e.target.value })}>
                <option value="">Unassigned</option>
                {os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager' || e.role === 'owner').map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>
          <label className="nsos-field">Address<input required value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Street, city, NC" /></label>
          {bookError && <div className="nsos-book-error" role="alert">{bookError}</div>}
          <div className="nsos-actions">
            <button className="nsos-btn" type="submit">Send confirmation request</button>
            <button className="nsos-btn ghost" type="button" onClick={() => bookAppointment(true)}>Confirm now</button>
          </div>
        </form>
      )}
      {showLeads && leadsToday.length > 0 && <div className="nsos-eyebrow">Lead follow-ups</div>}
      {showLeads && leadsToday.map((l) => (
        <div className="nsos-job" key={l.id}>
          <div><strong>{l.name}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{l.address} · {prettyLabel(l.status)}</div></div>
          <span className="nsos-pill gold">{l.rep}</span>
        </div>
      ))}
      {showShifts && shiftsToday.length > 0 && <div className="nsos-eyebrow">Shifts</div>}
      {showShifts && shiftsToday.map((s) => {
        const person = os.employees.find((e) => e.id === s.employeeId);
        return (
          <div className="nsos-job" key={s.id}>
            <div><strong>{person?.name || 'Teammate'}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{s.start}–{s.end} · on shift</div></div>
            <span className="nsos-pill">{s.day}</span>
          </div>
        );
      })}
      {showJobs && jobsToday.length === 0 && (
        <div className="nsos-empty">Nothing booked {label.toLowerCase()}. Pick a window — it lands on this day.</div>
      )}
      {filter === 'leads' && leadsToday.length === 0 && <div className="nsos-empty">No lead follow-ups sitting on the board.</div>}
      {filter === 'shifts' && shiftsToday.length === 0 && <div className="nsos-empty">No shifts on {label}. Add them from Team → Schedule.</div>}
      {showJobs && [...groups.entries()].map(([clock, list]) => (
        <section key={clock} style={{ marginBottom: 16 }}>
          <div className="nsos-eyebrow">{clock}</div>
          {list.map((j) => (
            <button className="nsos-job" key={j.id} onClick={() => onOpen(j.id)} style={{ width: '100%', textAlign: 'left' }}>
              <div>
                <strong>{j.service}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.customer} · {j.vehicle}</div>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}><CalendarDays size={12} /> {j.time} · {j.address}</div>
              </div>
              <span className={statusClass(j.status)}>{prettyLabel(j.status)}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function DispatchView({ onOpen }: { onOpen?: (id: string) => void }) {
  const os = useOs();
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'live'>('all');
  const techs = os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager');
  const openJobs = os.jobs.filter(jobOpen);
  const unassigned = openJobs.filter(jobUnassigned);
  const live = openJobs.filter((j) => j.status === 'en_route' || j.status === 'arrived' || j.status === 'in_progress');
  const visible = (jobs: OsJob[]) => {
    if (filter === 'unassigned') return jobs.filter(jobUnassigned);
    if (filter === 'live') return jobs.filter((j) => j.status === 'en_route' || j.status === 'arrived' || j.status === 'in_progress');
    return jobs;
  };
  const drop = (detailer: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('job');
    if (jobId) os.assignJob(jobId, detailer);
  };
  const card = (j: OsJob) => (
    <button
      className="dispatch-job nsos-st-job"
      key={j.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('job', j.id)}
      onClick={() => onOpen?.(j.id)}
    >
      <div className="nsos-st-job-top">
        <span>{jobClock(j.time)}</span>
        <b className={statusClass(j.status)}>{prettyLabel(j.status)}</b>
      </div>
      <strong>{j.customer}</strong>
      <small>{j.service} · {money(j.price)}</small>
      <small>{j.address}</small>
    </button>
  );
  return (
    <div className="nsos-st">
      <div className="nsos-st-bar">
        <div className="nsos-kpis nsos-st-kpis">
          <div className="nsos-kpi"><span>Unassigned</span><strong>{unassigned.length}</strong></div>
          <div className="nsos-kpi"><span>In field</span><strong>{live.length}</strong></div>
          <div className="nsos-kpi"><span>Open jobs</span><strong>{openJobs.length}</strong></div>
          <div className="nsos-kpi"><span>Technicians</span><strong>{techs.length}</strong></div>
        </div>
        <div className="nsos-tabs">
          {([['all', 'All jobs'], ['unassigned', 'Unassigned'], ['live', 'Live']] as const).map(([id, label]) => (
            <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="dispatch-board nsos-st-board">
        <section className="dispatch-column nsos-st-col" onDragOver={(e) => e.preventDefault()} onDrop={drop('')}>
          <h3>Unassigned <span>{visible(unassigned).length}</span></h3>
          {visible(unassigned).map(card)}
          {visible(unassigned).length === 0 && <div className="nsos-empty" style={{ padding: 12 }}>Drop a job here to unassign</div>}
        </section>
        {techs.map((c) => {
          const mine = visible(openJobs.filter((j) => j.detailer === c.name));
          const inField = mine.some((j) => j.status === 'en_route' || j.status === 'arrived' || j.status === 'in_progress');
          return (
            <section className="dispatch-column nsos-st-col" key={c.id} onDragOver={(e) => e.preventDefault()} onDrop={drop(c.name)}>
              <h3>
                <Avatar initials={c.initials} hue={c.hue} photo={c.photo} size={28} />
                <span>{c.name}</span>
                <small>{mine.length} open</small>
                <i className={inField ? 'online' : ''} />
              </h3>
              {mine.map(card)}
              {mine.length === 0 && <div className="nsos-empty" style={{ padding: 12 }}>Drop a job card to assign</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

const TERRITORY_ZONES = [
  { id: 'west', name: 'West Shore', color: '#7aa2d4' },
  { id: 'central', name: 'Central Corridor', color: '#c8a96a' },
  { id: 'east', name: 'East Ridge', color: '#d46a5a' },
] as const;
type TerritoryZoneId = (typeof TERRITORY_ZONES)[number]['id'];
const TERRITORY_REPS_KEY = 'nsos-territory-reps';

function zoneOf(x: number): TerritoryZoneId {
  if (x < 33) return 'west';
  if (x < 66) return 'central';
  return 'east';
}
function streetOf(address: string) {
  return String(address || '').replace(/^\s*\d+[A-Za-z-]*\s+/, '').replace(/,.*/, '').trim() || address || 'Unnamed street';
}
function readTerritoryReps(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(TERRITORY_REPS_KEY) || '{}'); } catch { return {}; }
}

export function TerritoriesView({ onMap, onPipeline }: { onMap?: () => void; onPipeline?: () => void }) {
  const os = useOs();
  const [zone, setZone] = useState<TerritoryZoneId | 'all'>('all');
  const [street, setStreet] = useState('');
  const [active, setActive] = useState<string | null>(os.leads[0]?.id || null);
  const [reps, setReps] = useState<Record<string, string>>(readTerritoryReps);
  const lead = os.leads.find((l) => l.id === active) || os.leads[0];
  const me = os.employees.find((e) => e.role === 'owner');
  const d2dReps = ['Unassigned', ...os.employees.filter((e) => e.role === 'd2d_agent' || e.role === 'owner').map((e) => e.name)];
  const inZone = (x: number) => zone === 'all' || zoneOf(x) === zone;
  const pins = os.leads.filter((l) => inZone(l.x) && (!street || streetOf(l.address) === street));
  const boards = TERRITORY_ZONES.map((z) => {
    const doors = os.leads.filter((l) => zoneOf(l.x) === z.id);
    const streets = [...new Set(doors.map((l) => streetOf(l.address)))];
    const worked = doors.filter((l) => isWorkedLead(l.status)).length;
    const sold = doors.filter((l) => srStatus(l.status).key === 'sold').length;
    const assigned = reps[z.id] || (doors.find((l) => l.rep && l.rep !== 'Unassigned')?.rep) || 'Unassigned';
    return { ...z, doors, streets, worked, sold, assigned };
  });
  const streetRows = [...new Map(
    (zone === 'all' ? os.leads : os.leads.filter((l) => zoneOf(l.x) === zone)).map((l) => {
      const name = streetOf(l.address);
      return [name, { name, zone: zoneOf(l.x), doors: os.leads.filter((x) => streetOf(x.address) === name) }] as const;
    }),
  ).values()].sort((a, b) => a.name.localeCompare(b.name));
  const assignZone = (id: TerritoryZoneId, name: string) => {
    const next = { ...reps, [id]: name };
    setReps(next);
    try { localStorage.setItem(TERRITORY_REPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    os.leads.filter((l) => zoneOf(l.x) === id).forEach((l) => os.assignLead(l.id, name));
  };
  const selectedZone = TERRITORY_ZONES.find((z) => z.id === (lead ? zoneOf(lead.x) : zone));
  return (
    <div className="nsos-territories" aria-label="Territories">
      <div className="nsos-sr-kpis">
        <div className="nsos-kpi"><span>Neighborhoods</span><strong>{TERRITORY_ZONES.length}</strong></div>
        <div className="nsos-kpi"><span>Streets</span><strong>{streetRows.length}</strong></div>
        <div className="nsos-kpi"><span>Doors</span><strong>{os.leads.length}</strong></div>
        <div className="nsos-kpi"><span>Assigned</span><strong>{boards.filter((z) => z.assigned !== 'Unassigned').length}</strong></div>
      </div>
      <div className="nsos-territory-actions">
        <div className="nsos-tabs">
          {([['all', 'All areas'], ['west', 'West Shore'], ['central', 'Central Corridor'], ['east', 'East Ridge']] as const).map(([id, label]) => (
            <button key={id} type="button" className={zone === id ? 'active' : ''} onClick={() => { setZone(id); setStreet(''); }}>{label}</button>
          ))}
        </div>
        <div className="nsos-territory-links">
          <button type="button" className="nsos-btn ghost" onClick={() => onMap?.()}>Knock map</button>
          <button type="button" className="nsos-btn ghost" onClick={() => onPipeline?.()}>Pipeline</button>
        </div>
      </div>
      <div className="nsos-territory-cards">
        {boards.map((z) => (
          <article
            key={z.id}
            className={`nsos-territory-card ${zone === z.id ? 'selected' : ''}`}
          >
            <button type="button" className="nsos-territory-card-main" onClick={() => { setZone(z.id); setStreet(''); }}>
              <i style={{ background: z.color }} />
              <div>
                <strong>{z.name}</strong>
                <small>{z.streets.length} streets · {z.doors.length} doors</small>
              </div>
              <span>{z.worked} worked · {z.sold} sold</span>
            </button>
            <label className="nsos-field">
              Rep
              <div className="owner-lead-assign">
                <select value={z.assigned} onChange={(e) => assignZone(z.id, e.target.value)}>
                  {d2dReps.map((n) => <option key={n}>{n}</option>)}
                </select>
                <button type="button" className="nsos-btn ghost" disabled={!me || z.assigned === me.name} onClick={() => { if (me) assignZone(z.id, me.name); }}>
                  {me && z.assigned === me.name ? 'Assigned to you' : 'Assign to me'}
                </button>
              </div>
            </label>
          </article>
        ))}
      </div>
      <div className="nsos-sr-layout nsos-territory-layout">
        <div className="nsos-sr-map-wrap">
          <div className="nsos-sr-legend">
            {TERRITORY_ZONES.map((z) => <span key={z.id}><i style={{ background: z.color }} /> {z.name}</span>)}
          </div>
          <div className="nsos-map nsos-sr-map nsos-territory-map">
            <div className="nsos-sr-zones" aria-hidden>
              <b>West Shore</b><b>Central Corridor</b><b>East Ridge</b>
            </div>
            {pins.map((l) => (
              <SrMapPin
                key={l.id}
                lead={l}
                className={`zone-${zoneOf(l.x)} ${street && streetOf(l.address) === street ? 'street-hit' : ''}`}
                selected={l.id === lead?.id}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
                onClick={() => { setActive(l.id); setZone(zoneOf(l.x)); }}
              />
            ))}
            {!pins.length && <div className="nsos-empty nsos-map-empty">No doors in this neighborhood yet.</div>}
          </div>
        </div>
        <aside className="nsos-sr-side">
          {lead && (
            <div className="nsos-card nsos-sr-card">
              <span className="nsos-eyebrow">{selectedZone?.name || 'Territory'} · {streetOf(lead.address)}</span>
              <h3>{lead.name}</h3>
              <p style={{ color: 'var(--os-muted)' }}>{lead.address} · {lead.phone || 'No phone'} · {money(lead.value)}</p>
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>{lead.rep} · {srStatus(lead.status).name}</p>
              <button type="button" className="nsos-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onMap?.()}>Open on knock map</button>
            </div>
          )}
          <div className="nsos-card nsos-street-board">
            <span className="nsos-eyebrow">Streets</span>
            {streetRows.length ? streetRows.map((row) => {
              const meta = TERRITORY_ZONES.find((z) => z.id === row.zone);
              const worked = row.doors.filter((l) => isWorkedLead(l.status)).length;
              return (
                <button
                  key={row.name}
                  type="button"
                  className={`nsos-street-row ${street === row.name ? 'active-row' : ''}`}
                  onClick={() => { setStreet(row.name); setZone(row.zone); setActive(row.doors[0]?.id || null); }}
                >
                  <i style={{ background: meta?.color }} />
                  <div>
                    <strong>{row.name}</strong>
                    <small>{meta?.name} · {worked}/{row.doors.length} worked</small>
                  </div>
                  <span className="nsos-pill blue">{row.doors.length}</span>
                </button>
              );
            }) : <div className="nsos-empty">No streets in this area yet. Log a door from the knock map.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

const emptyDoorDraft = () => ({
  first_name: '', last_name: '', phone: '', alt_phone: '', email: '',
  street1: '', street2: '', city: '', state: 'NC', postal_code: '',
});

export function D2DView({ onBook, onPipeline }: { onBook?: (jobId: string) => void; onPipeline?: () => void }) {
  const os = useOs();
  const [active, setActive] = useState<string | null>(os.leads[0]?.id || null);
  const [note, setNote] = useState('');
  const [door, setDoor] = useState(emptyDoorDraft);
  const [zone, setZone] = useState<'all' | 'west' | 'central' | 'east'>('all');
  const [pinFilter, setPinFilter] = useState<string | 'all'>('all');
  const [pane, setPane] = useState<'map' | 'pitch' | 'list'>(() => {
    const next = new URLSearchParams(window.location.search).get('pane');
    return next === 'pitch' || next === 'list' ? next : 'map';
  });
  const [presenting, setPresenting] = useState(() => new URLSearchParams(window.location.search).get('present') === '1');
  const lead = os.leads.find((l) => l.id === active) || os.leads[0];
  const me = os.employees.find((e) => e.role === 'owner');
  const d2dReps = ['Unassigned', ...os.employees.filter((e) => e.role === 'd2d_agent' || e.role === 'owner').map((e) => e.name)];
  const territory = (x: number) => (x < 33 ? 'west' : x < 66 ? 'central' : 'east');
  const pins = os.leads.filter((l) => (zone === 'all' || territory(l.x) === zone) && (pinFilter === 'all' || srStatus(l.status).key === pinFilter));
  const slots = liveOpenSlots(os.jobs, os.employees, 10);
  const knocks = SR_STATUSES.filter((s) => s.knock);
  const leadPin = lead ? srStatus(lead.status) : null;
  const bookLead = (time?: string, service?: string, price?: number, detailer?: string) => {
    if (!lead) return;
    const id = os.convertLead(lead.id, { time, service, price, detailer });
    if (id) onBook?.(id);
  };
  const applyOfferToLead = async (offer: OfferSelection): Promise<ApplyOfferResult> => {
    const hh = offer.household;
    const fields = householdAsLeadFields(hh);
    const identity = composedLeadIdentity(fields, hh.name, hh.address);
    if (!lead && !identity.name && !identity.address && !fields.phone) {
      return { saved: false, error: 'Add a name, phone, or street before saving.' };
    }
    const extra: Partial<OsLead> = {
      first_name: fields.first_name,
      last_name: fields.last_name,
      phone: fields.phone || lead?.phone || '',
      alt_phone: fields.alt_phone,
      email: fields.email,
      street1: fields.street1,
      street2: fields.street2,
      city: fields.city,
      state: fields.state,
      postal_code: fields.postal_code,
      vehicle: fields.vehicle,
      value: offer.amount || lead?.value,
      service: offer.name || lead?.service,
      status: offer.createPortalAccount && !offer.name ? 'customer' : 'interested',
      temp: 'hot',
      notes: offer.name ? `${offer.name} · ${money(offer.amount)}` : (offer.createPortalAccount ? 'Customer portal account opened at the door.' : lead?.notes || ''),
    };
    let leadId = lead?.id;
    if (!leadId) {
      leadId = os.addLead(identity.name || 'New household', identity.address || 'Address pending', extra);
      setActive(leadId);
    } else {
      os.patchLead(leadId, {
        name: identity.name || lead!.name,
        address: identity.address || lead!.address,
        ...extra,
      });
    }
    if (!offer.createPortalAccount) return { saved: true };
    if (!fields.email.trim()) return { saved: false, error: 'Email is required to open their customer portal login.' };
    const userId = os.ensureCustomer({
      name: identity.name || fields.email,
      email: fields.email,
      phone: fields.phone,
      vehicle: fields.vehicle,
      address: identity.address,
      member: offer.type === 'membership' && Boolean(offer.name),
    });
    os.patchLead(leadId, { portal_user_id: userId, email: fields.email, status: extra.status });
    return {
      saved: true,
      account: {
        user_id: userId,
        email: fields.email.trim().toLowerCase(),
        created: true,
        existing: false,
        emailed: false,
        password: offer.portalPassword,
        login_url: `${window.location.origin}/login`,
      },
    };
  };
  const saveLeadFields = (patch: Partial<OsLead>) => {
    if (!lead) return;
    const next = { ...lead, ...patch };
    const fields = fieldsFromLead(next);
    const identity = composedLeadIdentity(fields, next.name, next.address);
    os.patchLead(lead.id, { ...patch, ...fields, ...identity, value: Number(fields.value || next.value || 0) });
  };
  const doorRow = (l: OsLead) => {
    const pin = srStatus(l.status);
    return (
      <button className={`nsos-sr-door ${l.id === lead?.id ? 'active-row' : ''}`} key={l.id} onClick={() => { setActive(l.id); setPane('map'); }}>
        <SrStatusDot status={l.status} />
        <div>
          <strong>{l.name}</strong>
          <small>{l.address} · {territory(l.x)} · {l.rep}</small>
          <small>{l.activity[0] ? `${l.activity[0].at} · ${l.activity[0].body}` : 'Not knocked yet'}</small>
        </div>
        <span className={`nsos-pill ${srPillTone(l.status)}`}>{pin.abbr}</span>
      </button>
    );
  };
  return (
    <div className="nsos-sr" data-pane={pane}>
      <div className="nsos-seg" role="tablist" aria-label="Leads view">
        {([['map', 'Map'], ['pitch', 'Pitch'], ['list', 'Doors']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} className={pane === id ? 'active' : ''} onClick={() => setPane(id)}>{label}</button>
        ))}
        <button type="button" className="nsos-seg-link" onClick={() => onPipeline?.()}>Pipeline</button>
      </div>
      <div className="nsos-sr-kpis">
        <div className="nsos-kpi"><span>Doors</span><strong>{os.leads.length}</strong></div>
        <div className="nsos-kpi"><span>Touched</span><strong>{os.leads.filter((l) => isWorkedLead(l.status)).length}</strong></div>
        <div className="nsos-kpi"><span>Open windows</span><strong>{slots.length}</strong></div>
        <div className="nsos-kpi"><span>Sold</span><strong>{os.leads.filter((l) => srStatus(l.status).key === 'sold').length}</strong></div>
      </div>
      {pane === 'pitch' ? (
        <div className="nsos-pitch">
          <div className="nsos-pitch-lead">
            <span className="nsos-eyebrow">{lead ? `${territory(lead.x)} door · ${leadPin?.abbr}` : 'No door selected'}</span>
            <h3>{lead?.name || 'Pick a household on the map'}</h3>
            <p>{lead ? `${lead.address} · Next open window ${slots[0]?.window || 'TBD'}` : 'Add a lead on Map, or tap Account in the pitch to open their customer portal here.'}</p>
            {lead && (
              <div className="nsos-pitch-slots">
                {slots.slice(0, 4).map((slot) => (
                  <button key={slot.id} type="button" onClick={() => bookLead(slot.window, undefined, undefined, slot.tech)}>
                    <strong>{slot.time}</strong>
                    <small>{slot.dateLabel} · {slot.tech}</small>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="nsos-btn" onClick={() => setPresenting(true)}>Present to customer</button>
          </div>
          {!presenting && (
          <SalesPresentation
            embedded
            initialMode={typeof window !== 'undefined' && window.innerWidth <= 860 ? 'quote' : 'presentation'}
            householdSeed={lead ? fieldsFromLead(lead) : undefined}
            customerName={lead?.name}
            customerPhone={lead?.phone}
            customerEmail={lead?.email}
            customerAddress={lead?.address}
            leadId={lead?.id}
            slots={slots}
            onBookSlot={(offer, slot) => { void applyOfferToLead(offer); bookLead(slot.window, offer.name, offer.amount, slot.tech); }}
            onSelectOffer={(offer) => { void applyOfferToLead(offer); }}
            onApplyAndSave={applyOfferToLead}
          />
          )}
        </div>
      ) : pane === 'list' ? (
        <div className="nsos-sr-doors nsos-sr-doors-board">
          <div className="nsos-sr-doors-head">
            <div>
              <span className="nsos-eyebrow">Neighborhood doors</span>
              <h3>{pins.length} households in {zone === 'all' ? 'all areas' : zone}</h3>
            </div>
            <div className="nsos-tabs">
              {([['all', 'All areas'], ['west', 'West'], ['central', 'Central'], ['east', 'East']] as const).map(([id, name]) => (
                <button key={id} className={zone === id ? 'active' : ''} onClick={() => setZone(id)}>{name}</button>
              ))}
            </div>
          </div>
          {pins.map(doorRow)}
          {!pins.length && <div className="nsos-empty">No doors in this area. Log one from the map.</div>}
        </div>
      ) : (
      <div className="nsos-sr-layout">
        <div className="nsos-sr-map-wrap">
          <div className="nsos-sr-legend nsos-sr-pin-legend">
            <button type="button" className={pinFilter === 'all' ? 'active' : ''} onClick={() => setPinFilter('all')}>All</button>
            {SR_STATUSES.filter((s) => s.knock || s.key === 'unworked').map((s) => (
              <button type="button" key={s.key} className={pinFilter === s.key ? 'active' : ''} onClick={() => setPinFilter(pinFilter === s.key ? 'all' : s.key)}>
                <i style={{ background: s.color }} />{s.abbr}
              </button>
            ))}
          </div>
          <div className="nsos-map nsos-sr-map">
            <div className="nsos-sr-zones" aria-hidden>
              <b>West</b><b>Central</b><b>East</b>
            </div>
            {pins.map((l) => (
              <SrMapPin
                key={l.id}
                lead={l}
                selected={l.id === lead?.id}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
                onClick={() => setActive(l.id)}
              />
            ))}
          </div>
        </div>
        <aside className="nsos-sr-side">
          <div className="nsos-tabs">
            {([['all', 'All areas'], ['west', 'West'], ['central', 'Central'], ['east', 'East']] as const).map(([id, label]) => (
              <button key={id} className={zone === id ? 'active' : ''} onClick={() => setZone(id)}>{label}</button>
            ))}
          </div>
          <form className="nsos-card nsos-add-door" onSubmit={(e) => {
            e.preventDefault();
            const identity = composedLeadIdentity(door, 'New household', 'Address pending');
            if (!identity.name && !door.phone.trim() && !identity.address) return;
            const id = os.addLead(identity.name || 'New household', identity.address || 'Address pending', {
              ...door,
              phone: door.phone.trim(),
              email: door.email.trim(),
              alt_phone: door.alt_phone.trim(),
              status: 'unworked',
            });
            setDoor(emptyDoorDraft());
            setActive(id);
          }}>
            <span className="nsos-eyebrow">Add a lead</span>
            <h3>Household record</h3>
            <div className="nsos-add-door-grid nsos-sr-lead-grid">
              <label className="nsos-field">First name<input value={door.first_name} onChange={(e) => setDoor({ ...door, first_name: e.target.value })} placeholder="First" /></label>
              <label className="nsos-field">Last name<input value={door.last_name} onChange={(e) => setDoor({ ...door, last_name: e.target.value })} placeholder="Last" /></label>
              <label className="nsos-field">Phone<input value={door.phone} onChange={(e) => setDoor({ ...door, phone: e.target.value })} placeholder="919-555-0100" inputMode="tel" /></label>
              <label className="nsos-field">Alt phone<input value={door.alt_phone} onChange={(e) => setDoor({ ...door, alt_phone: e.target.value })} placeholder="Optional" inputMode="tel" /></label>
              <label className="nsos-field wide">Email<input value={door.email} onChange={(e) => setDoor({ ...door, email: e.target.value })} placeholder="name@email.com" /></label>
              <label className="nsos-field wide">Street 1<input value={door.street1} onChange={(e) => setDoor({ ...door, street1: e.target.value })} placeholder="210 Forest Pines Dr" /></label>
              <label className="nsos-field">Street 2<input value={door.street2} onChange={(e) => setDoor({ ...door, street2: e.target.value })} placeholder="Apt / unit" /></label>
              <label className="nsos-field">City<input value={door.city} onChange={(e) => setDoor({ ...door, city: e.target.value })} /></label>
              <label className="nsos-field">State<input value={door.state} onChange={(e) => setDoor({ ...door, state: e.target.value })} /></label>
              <label className="nsos-field">ZIP<input value={door.postal_code} onChange={(e) => setDoor({ ...door, postal_code: e.target.value })} /></label>
            </div>
            <button className="nsos-btn" type="submit"><Plus size={15} />Save lead</button>
          </form>
          {lead && (
            <div className="nsos-card nsos-sr-card">
              <span className="nsos-eyebrow">{territory(lead.x)} territory · {leadPin?.abbr} {leadPin?.name}</span>
              <h3>{lead.name}</h3>
              <p style={{ color: 'var(--os-muted)' }}>{lead.address}</p>
              <div className="nsos-sr-lead-grid">
                <label className="nsos-field">First name<input value={lead.first_name} onChange={(e) => saveLeadFields({ first_name: e.target.value })} /></label>
                <label className="nsos-field">Last name<input value={lead.last_name} onChange={(e) => saveLeadFields({ last_name: e.target.value })} /></label>
                <label className="nsos-field">Phone<input value={lead.phone} onChange={(e) => saveLeadFields({ phone: e.target.value })} inputMode="tel" /></label>
                <label className="nsos-field">Alt phone<input value={lead.alt_phone} onChange={(e) => saveLeadFields({ alt_phone: e.target.value })} inputMode="tel" /></label>
                <label className="nsos-field wide">Email<input value={lead.email} onChange={(e) => saveLeadFields({ email: e.target.value })} /></label>
                <label className="nsos-field wide">Street 1<input value={lead.street1} onChange={(e) => saveLeadFields({ street1: e.target.value })} /></label>
                <label className="nsos-field">Street 2<input value={lead.street2} onChange={(e) => saveLeadFields({ street2: e.target.value })} /></label>
                <label className="nsos-field">City<input value={lead.city} onChange={(e) => saveLeadFields({ city: e.target.value })} /></label>
                <label className="nsos-field">State<input value={lead.state} onChange={(e) => saveLeadFields({ state: e.target.value })} /></label>
                <label className="nsos-field">ZIP<input value={lead.postal_code} onChange={(e) => saveLeadFields({ postal_code: e.target.value })} /></label>
                <label className="nsos-field wide">Vehicle<input value={lead.vehicle} onChange={(e) => saveLeadFields({ vehicle: e.target.value })} placeholder="Year / make / model" /></label>
                <label className="nsos-field">Service<input value={lead.service} onChange={(e) => saveLeadFields({ service: e.target.value })} /></label>
                <label className="nsos-field">Value<input type="number" min="0" value={lead.value || ''} onChange={(e) => saveLeadFields({ value: Number(e.target.value || 0) })} /></label>
                <label className="nsos-field">Callback<input value={lead.follow_up_at} onChange={(e) => saveLeadFields({ follow_up_at: e.target.value })} placeholder="Tonight after 6" /></label>
                <label className="nsos-field">Appointment<input value={lead.appointment_at} onChange={(e) => saveLeadFields({ appointment_at: e.target.value })} placeholder="Fri · 10:00 AM" /></label>
              </div>
              <label className="nsos-field">Assignee
                <div className="owner-lead-assign">
                  <select value={lead.rep} onChange={(e) => os.assignLead(lead.id, e.target.value)}>
                    {d2dReps.map((n) => <option key={n}>{n}</option>)}
                  </select>
                  <button
                    type="button"
                    className="nsos-btn ghost"
                    disabled={!me || lead.rep === me.name}
                    onClick={() => { if (me) os.assignLead(lead.id, me.name); }}
                  >
                    {me && lead.rep === me.name ? 'Assigned to you' : 'Assign to me'}
                  </button>
                </div>
              </label>
              <div className="nsos-sr-knocks">
                {knocks.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`nsos-sr-knock ${lead.status === s.key ? 'active' : ''}`}
                    style={{ ['--pin' as string]: s.color }}
                    onClick={() => os.setLeadStatus(lead.id, s.key)}
                  >
                    <b>{s.abbr}</b>
                    <small>{s.name}</small>
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; os.addLeadNote(lead.id, note.trim()); setNote(''); }}>
                <label className="nsos-field">Activity note
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened at the door?" />
                </label>
              </form>
              {(lead.activity || []).slice(0, 4).map((a) => (
                <div key={a.id} style={{ fontSize: 12, color: 'var(--os-muted)', padding: '6px 0', borderTop: '1px solid var(--os-line)' }}>{a.at} · {a.author} · {a.body}</div>
              ))}
              <div className="nsos-sr-card-actions">
                {lead.phone && <a className="nsos-btn ghost" href={`tel:${lead.phone}`}>Call</a>}
                <button className="nsos-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPane('pitch')}>Pitch & book a window</button>
              </div>
            </div>
          )}
          <div className="nsos-sr-doors">
            {pins.map(doorRow)}
          </div>
        </aside>
      </div>
      )}
      {presenting && (
        <SalesPresentation
          initialMode="presentation"
          householdSeed={lead ? fieldsFromLead(lead) : undefined}
          customerName={lead?.name}
          customerPhone={lead?.phone}
          customerEmail={lead?.email}
          customerAddress={lead?.address}
          leadId={lead?.id}
          slots={slots}
          onClose={() => setPresenting(false)}
          onBookSlot={(offer, slot) => { void applyOfferToLead(offer); bookLead(slot.window, offer.name, offer.amount, slot.tech); }}
          onSelectOffer={(offer) => { void applyOfferToLead(offer); }}
          onApplyAndSave={applyOfferToLead}
        />
      )}
    </div>
  );
}

export function PipelineView({ onBook }: { onBook?: (jobId: string) => void }) {
  const os = useOs();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<'all' | 'hot' | 'unassigned'>('all');
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState({ first_name: '', last_name: '', phone: '', email: '', street1: '', city: '', state: 'NC', postal_code: '', value: '275' });
  const [dropStage, setDropStage] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (l: { name?: string; address?: string; rep?: string; phone?: string }) =>
    `${l.name || ''} ${l.address || ''} ${l.rep || ''} ${l.phone || ''}`.toLowerCase().includes(needle);
  const live = os.leads.filter((l) => !isClosedLead(l.status) || srStatus(l.status).key === 'sold');
  const rows = live.filter((l) => {
    if (!match(l)) return false;
    if (focus === 'hot' && l.temp !== 'hot') return false;
    if (focus === 'unassigned' && l.rep && l.rep !== 'Unassigned') return false;
    return true;
  });
  const total = rows.filter((l) => srStatus(l.status).key !== 'sold').reduce((s, l) => s + Number(l.value || 0), 0);
  const hot = live.filter((l) => l.temp === 'hot' && srStatus(l.status).key !== 'sold');
  const unassigned = live.filter((l) => !l.rep || l.rep === 'Unassigned');
  const sold = os.leads.filter((l) => l.status === 'sold').length;
  const reps = os.employees.filter((e) => e.role === 'd2d_agent' || e.role === 'owner');
  const me = os.employees.find((e) => e.role === 'owner');
  return (
    <div className="owner-demo-pipeline">
      <div className="owner-leads-head-actions" style={{ marginBottom: 12 }}>
        <button type="button" className="nsos-btn" onClick={() => setCompose((v) => !v)}>
          <Plus size={15} />{compose ? 'Close form' : 'New Lead'}
        </button>
      </div>
      {compose && (
      <form
        className="nsos-card owner-lead-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.first_name.trim() && !draft.last_name.trim() && !draft.street1.trim()) return;
          const identity = composedLeadIdentity({
            first_name: draft.first_name, last_name: draft.last_name, phone: draft.phone, alt_phone: '', email: draft.email,
            street1: draft.street1, street2: '', city: draft.city, state: draft.state, postal_code: draft.postal_code,
            notes: '', vehicle: '', service: '', value: draft.value, follow_up_at: '', appointment_at: '',
          }, 'New household', 'Address pending');
          os.addLead(identity.name, identity.address, {
            ...draft,
            phone: draft.phone.trim(),
            email: draft.email.trim(),
            value: Number(draft.value || 0),
            status: 'unworked',
          });
          setDraft({ first_name: '', last_name: '', phone: '', email: '', street1: '', city: '', state: 'NC', postal_code: '', value: '275' });
          setCompose(false);
        }}
      >
        <span className="nsos-eyebrow">NEW LEAD</span>
        <h3>Log a household</h3>
        <div className="owner-lead-compose-grid nsos-sr-lead-grid">
          <label className="nsos-field">First name<input value={draft.first_name} onChange={(e) => setDraft((p) => ({ ...p, first_name: e.target.value }))} placeholder="First" /></label>
          <label className="nsos-field">Last name<input value={draft.last_name} onChange={(e) => setDraft((p) => ({ ...p, last_name: e.target.value }))} placeholder="Last" /></label>
          <label className="nsos-field">Phone<input value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} placeholder="919-555-0100" /></label>
          <label className="nsos-field">Email<input value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} /></label>
          <label className="nsos-field wide">Street<input value={draft.street1} onChange={(e) => setDraft((p) => ({ ...p, street1: e.target.value }))} placeholder="Street" /></label>
          <label className="nsos-field">City<input value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} /></label>
          <label className="nsos-field">State<input value={draft.state} onChange={(e) => setDraft((p) => ({ ...p, state: e.target.value }))} /></label>
          <label className="nsos-field">ZIP<input value={draft.postal_code} onChange={(e) => setDraft((p) => ({ ...p, postal_code: e.target.value }))} /></label>
          <label className="nsos-field">Value<input type="number" min="0" value={draft.value} onChange={(e) => setDraft((p) => ({ ...p, value: e.target.value }))} /></label>
        </div>
        <button className="nsos-btn" type="submit"><Plus size={15} />Add to pipeline</button>
      </form>
      )}
      <div className="nsos-alerts owner-lead-exceptions">
        {hot.length > 0 && (
          <button type="button" className={`nsos-alert hot ${focus === 'hot' ? 'selected' : ''}`} onClick={() => setFocus((v) => v === 'hot' ? 'all' : 'hot')}>
            <em>{hot.length}</em><span><b>Hot leads</b><small>Ready to quote or book</small></span>
          </button>
        )}
        {unassigned.length > 0 && (
          <button type="button" className={`nsos-alert hot ${focus === 'unassigned' ? 'selected' : ''}`} onClick={() => setFocus((v) => v === 'unassigned' ? 'all' : 'unassigned')}>
            <em>{unassigned.length}</em><span><b>Unassigned</b><small>Need a rep on the door</small></span>
          </button>
        )}
        {!hot.length && !unassigned.length && <div className="ns-empty">Nothing needs you. Drag a card or log a new door.</div>}
      </div>
      <div className="nsos-actions" style={{ marginBottom: 12 }}>
        <div className="nsos-search" style={{ flex: 1 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals, streets, or reps" /></div>
      </div>
      <div className="nsos-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="nsos-kpi"><span>Open pipeline</span><strong>{money(total)}</strong></div>
        <div className="nsos-kpi"><span>Close rate</span><strong>{Math.round((sold / Math.max(1, os.leads.length)) * 100)}%</strong></div>
        <div className="nsos-kpi"><span>Unassigned</span><strong>{unassigned.length}</strong></div>
      </div>
      {!rows.length && <div className="ns-empty">No leads match these filters.</div>}
      <div className="nsos-kanban">
        {LEAD_STAGES.map((s) => {
          const col = rows.filter((l) => l.status === s);
          return (
            <div
              className={`nsos-col nsos-drop ${dropStage === s ? 'drop-ready' : ''}`}
              key={s}
              onDragOver={(e) => { e.preventDefault(); setDropStage(s); }}
              onDragLeave={() => setDropStage((v) => v === s ? '' : v)}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('lead');
                setDropStage('');
                if (id) os.setLeadStatus(id, s);
              }}
            >
              <h3>{srStatus(s).name}<span>{col.length}</span></h3>
              {col.map((l) => (
                <div className="nsos-lead" key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData('lead', l.id)}>
                  <strong className="nsos-lead-name">{l.name || 'Untitled lead'}</strong>
                  <small className="nsos-lead-addr">{l.address || 'No address'}</small>
                  <div className="nsos-lead-meta">
                    <span className={`nsos-temp ${l.temp}`}>{l.temp}</span>
                    <select
                      value={l.rep || 'Unassigned'}
                      onChange={(e) => os.assignLead(l.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="Unassigned">Unassigned</option>
                      {reps.map((r) => <option key={r.id} value={r.name}>{r.name}{r.role === 'owner' ? ' · Owner' : ''}</option>)}
                    </select>
                    {me && l.rep !== me.name && (
                      <button type="button" className="nsos-btn ghost" onClick={(e) => { e.stopPropagation(); os.assignLead(l.id, me.name); }}>Assign to me</button>
                    )}
                    <b>{money(l.value)}</b>
                  </div>
                  {(s === 'appointment_set' || s === 'sold' || s === 'interested' || s === 'estimate') && (
                    <button className="nsos-btn ghost" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={() => { const id = os.convertLead(l.id); if (id) onBook?.(id); }}>Book job</button>
                  )}
                </div>
              ))}
              {!col.length && <div className="lead-column-empty">Drop a card here.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomersView({ onOpenJob }: { onOpenJob?: (id: string) => void }) {
  const os = useOs();
  const [q, setQ] = useState('');
  const [id, setId] = useState(os.customers[0]?.id || '');
  const [note, setNote] = useState('');
  const customer = os.customers.find((c) => c.id === id) || os.customers[0];
  const rows = os.customers.filter((c) => `${c.name} ${c.vehicle} ${c.address}`.toLowerCase().includes(q.toLowerCase()));
  const jobs = os.jobs.filter((j) => j.customer === customer?.name);
  const pays = os.payments.filter((p) => p.customer === customer?.name);
  if (!customer) return <div className="nsos-empty">No customers yet.</div>;
  return (
    <div className="nsos-grid-2">
      <div>
        <div className="nsos-search" style={{ marginBottom: 10 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records" /></div>
        {rows.map((c) => (
          <button className={`nsos-row ${c.id === customer.id ? 'active' : ''}`} key={c.id} onClick={() => setId(c.id)}>
            <Avatar initials={initialsOf(c.name)} hue="#7c6a4a" photo={c.photo} />
            <span><strong>{c.name}</strong><small>{c.vehicle}</small></span>
            {c.member && <span className="nsos-pill gold">member</span>}
          </button>
        ))}
      </div>
      <div className="nsos-card">
        <span className="nsos-eyebrow">Customer record</span>
        <h3>{customer.name}</h3>
        <p style={{ color: 'var(--os-muted)' }}>{customer.email} · {customer.phone}</p>
        <p style={{ color: 'var(--os-muted)', marginBottom: 12 }}>{customer.address} · {customer.vehicle}</p>
        <button className={`nsos-btn ${customer.member ? '' : 'ghost'}`} onClick={() => os.toggleMember(customer.id)}>
          {customer.member ? 'Luxe member' : 'Add membership'}
        </button>
        <div className="nsos-kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="nsos-kpi"><span>Lifetime</span><strong>{money(jobs.reduce((s, j) => s + j.price, 0))}</strong></div>
          <div className="nsos-kpi"><span>Jobs</span><strong>{jobs.length}</strong></div>
        </div>
        <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Timeline</h4>
        {jobs.map((j) => (
          <button key={j.id} className="nsos-job" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenJob?.(j.id)}>
            <span>{j.time} · {j.service}</span>
            <span className="nsos-pill gold">{prettyLabel(j.status)}</span>
          </button>
        ))}
        {pays.map((p) => (
          <div key={p.id} className="nsos-job"><span>{p.at} · {p.method}</span><b>{money(p.amount)}</b></div>
        ))}
        {(customer.notes || []).map((n) => (
          <div key={n.id} style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--os-line)' }}>{n.at} · {n.author}: {n.body}</div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; os.addCustomerNote(customer.id, note.trim()); setNote(''); }}>
          <label className="nsos-field">Add note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, SMS, or follow-up" />
          </label>
        </form>
      </div>
    </div>
  );
}

function stepIndex(status: JobStatus) {
  const mapped = status === 'arrived' ? 'en_route' : status;
  return Math.max(0, JOB_STEPS.indexOf(mapped));
}

export function CustomerPortalCard({ job }: { job: OsJob }) {
  const idx = stepIndex(job.status);
  const lastSms = (job.comms || []).find((c) => c.channel === 'sms');
  return (
    <div className="nsos-portal">
      <span className="nsos-eyebrow">Customer portal</span>
      <strong>Track your appointment</strong>
      <p>{firstWord(job.customer, 'Customer')}, your {job.service} is {JOB_STEP_LABELS[idx]}.</p>
      <div className="nsos-status">
        {JOB_STEP_LABELS.map((label, i) => (
          <span key={label} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{label}</span>
        ))}
      </div>
      {lastSms && <div className="nsos-portal-sms">{lastSms.preview}</div>}
    </div>
  );
}

export function PremiumEmail({
  headline, time, service, vehicle, detailer, price, step,
}: {
  headline: string; time: string; service: string; vehicle: string; detailer: string; price: string; step: number;
}) {
  return (
    <div className="nsos-email">
      <header>NORTH SPLASH AUTO LUXE</header>
      <div className="hero">
        <h2>{headline}</h2>
        <div className="meta">
          <div><b>{time}</b></div>
          <div>{service}</div>
          <div>{vehicle}</div>
          <div className="nsos-email-detailer">
            <span className="nsos-avatar" style={{ width: 36, height: 36, background: '#c8a96a', fontSize: 11 }}>{String(detailer || 'D').slice(0, 1)}</span>
            <span>Assigned Detailer<br /><b>{detailer}</b></span>
          </div>
          <div><b>{price}</b></div>
        </div>
      </div>
      <div className="cta">VIEW APPOINTMENT</div>
      <div className="nsos-status nsos-status-light">
        {JOB_STEP_LABELS.map((s, i) => <span key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>{s}</span>)}
      </div>
      <footer>North Splash Auto Luxe · North Carolina · hello@northsplash.com · 330-990-3956</footer>
    </div>
  );
}

export function JobDetail({ job }: { job: OsJob }) {
  const os = useOs();
  const [note, setNote] = useState('');
  const idx = stepIndex(job.status);
  const vars = {
    customer_first_name: firstWord(job.customer, 'Customer'),
    detailer_name: firstWord(job.detailer, 'Detailer'),
    vehicle: job.vehicle,
    service: job.service,
    appointment_time: job.time,
    price: money(job.price),
    eta: job.eta || '15 min',
    portal_link: 'northsplash.com/appointment',
  };
  return (
    <div>
      <div className="nsos-card">
        {(job.photos || [])[0] && <img className="nsos-hero-photo" src={job.photos[0].src} alt={job.vehicle} />}
        <span className="nsos-eyebrow">{job.time}</span>
        <h2>{job.service}</h2>
        <p style={{ color: 'var(--os-muted)' }}>{job.customer} · {job.vehicle}</p>
        {job.status === 'scheduled' && (
          <div className="nsos-confirm-banner">
            <div>
              <strong>Waiting on confirmation</strong>
              <p>Confirmation request {job.email || job.phone ? `sent to ${job.email || job.phone}` : 'queued'}. The window is not locked until you mark it confirmed.</p>
            </div>
            <button type="button" className="nsos-btn" onClick={() => os.setJobStatus(job.id, 'confirmed')}>Mark confirmed</button>
          </div>
        )}
        {job.status === 'confirmed' && (
          <div className="nsos-confirm-banner done">
            <div>
              <strong>Confirmed</strong>
              <p>Booking confirmation sent. {job.time}{job.detailer ? ` · ${job.detailer}` : ''}.</p>
            </div>
          </div>
        )}
        <div className="nsos-status">
          {JOB_STEP_LABELS.map((label, i) => (
            <button
              key={label}
              className={i < idx ? 'done' : i === idx ? 'now' : ''}
              onClick={() => os.setJobStatus(job.id, JOB_STEPS[i])}
            >{label}</button>
          ))}
        </div>
        <div className="nsos-live-route">
          <div className="nsos-live-map" aria-hidden>
            <span className="nsos-live-dot-job" style={{ left: '28%', top: '42%' }} />
            <span className="nsos-live-dot-tech" style={{ left: job.status === 'en_route' ? '48%' : '28%', top: job.status === 'en_route' ? '58%' : '42%' }} />
            <i className="nsos-live-path" />
          </div>
          <div>
            <span className="nsos-eyebrow">Live job status</span>
            <h3>{prettyLabel(job.status)}</h3>
            <p style={{ color: 'var(--os-muted)' }}>{job.eta ? `ETA ${job.eta}` : job.time} · {job.detailer || 'Unassigned'}</p>
            <p style={{ color: 'var(--os-muted)', fontSize: 12 }}>{job.address}</p>
          </div>
        </div>
        <p style={{ marginTop: 12 }}><MapPin size={14} /> {job.address}</p>
        <label className="nsos-field">Assigned detailer
          <select value={job.detailer} onChange={(e) => os.assignJob(job.id, e.target.value)}>
            <option value="">Unassigned</option>
            {os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager' || e.role === 'owner').map((e) => (
              <option key={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <p>{money(job.price)} · <span className={`nsos-pill ${job.payment === 'paid' ? 'green' : job.payment === 'refunded' ? 'red' : 'gold'}`}>{job.payment}</span></p>
        <CustomerPortalCard job={job} />
        <label className="nsos-field">Window
          <input value={job.time} onChange={(e) => os.rescheduleJob(job.id, e.target.value)} />
        </label>
        <div className="nsos-actions" style={{ marginTop: 14 }}>
          <a className="nsos-btn ghost" href={`https://maps.apple.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"><Navigation size={14} />Directions</a>
          {job.status !== 'completed' && job.status !== 'en_route' && job.status !== 'arrived' && job.status !== 'in_progress' && (
            <button className="nsos-btn" onClick={() => os.setJobStatus(job.id, 'en_route')}>En route</button>
          )}
          {job.status === 'en_route' && <button className="nsos-btn" onClick={() => os.setJobStatus(job.id, 'arrived')}>Arrived</button>}
          {(job.status === 'en_route' || job.status === 'arrived') && <button className="nsos-btn" onClick={() => os.setJobStatus(job.id, 'in_progress')}>Start job</button>}
          {job.status === 'in_progress' && <button className="nsos-btn" onClick={() => os.setJobStatus(job.id, 'completed')}>Complete</button>}
          {job.payment === 'due' && <button className="nsos-btn" onClick={() => os.collectJob(job.id)}><CreditCard size={14} />Collect {money(job.price)}</button>}
          <button className="nsos-btn ghost" onClick={() => {
            const crew = os.chats.find((c) => c.channel_type === 'crew' || (c.kind === 'space' && String(c.name || '').toLowerCase().includes('crew')));
            if (crew) os.shareToChat(crew.id, `${job.customer} · ${job.service} is ${prettyLabel(job.status)} at ${job.address}`);
          }}>Share to crew</button>
        </div>
      </div>
      <div className="nsos-grid-2" style={{ marginTop: 14 }}>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Job notes</span>
          <label className="nsos-field">Internal
            <textarea rows={3} value={job.internal_notes || ''} onChange={(e) => os.setJobNotes(job.id, e.target.value)} />
          </label>
          <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; os.addJobNote(job.id, note.trim()); setNote(''); }}>
            <label className="nsos-field">Customer-visible note
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" />
            </label>
          </form>
          {job.notes?.map((n) => <div key={n.id} style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--os-line)' }}>{n.at} · {n.author}: {n.body}</div>)}
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Service checklist</span>
          <h3>{job.service}</h3>
          <p style={{ color: 'var(--os-muted)', fontSize: 12 }}>{(job.checklist || []).filter((s) => s.done).length}/{(job.checklist || []).length} steps</p>
          <div className="job-checklist nsos-job-checklist">
            {(job.checklist || []).map((step) => (
              <button key={step.id} type="button" className={step.done ? 'completed' : ''} onClick={() => os.toggleJobChecklist(job.id, step.id)}>
                <span className="check-box">{step.done ? <Check size={15} /> : null}</span>
                <span>{step.label}{step.required ? <small>Required</small> : null}</span>
              </button>
            ))}
            {!(job.checklist || []).length && <div className="nsos-empty">No service steps for this job.</div>}
          </div>
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Photos</span>
          <div className="nsos-photos">
            {(job.photos || []).map((p) => (
              <figure key={p.id}>
                <img src={p.src} alt={p.label} />
                <figcaption>{p.label}</figcaption>
              </figure>
            ))}
          </div>
          {(job.photos || []).length === 0 && <div className="nsos-empty">No photos yet.</div>}
          <div className="nsos-actions" style={{ marginTop: 8 }}>
            <button className="nsos-btn ghost" onClick={() => os.addJobPhoto(job.id, 'before')}>Add before</button>
            <button className="nsos-btn ghost" onClick={() => os.addJobPhoto(job.id, 'after')}>Add after</button>
          </div>
        </section>
      </div>
      <section className="nsos-card" style={{ marginTop: 14 }}>
        <span className="nsos-eyebrow">Customer messages</span>
        <h3>Email + SMS on this job</h3>
        {(job.comms || []).length === 0 && <p className="nsos-empty">Advance the status bar to send the matching customer templates.</p>}
        {(job.comms || []).map((c) => (
          <div className="nsos-job" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{c.preview}</div>
            </div>
            <span className="nsos-pill blue">{c.channel} · {c.at}</span>
          </div>
        ))}
        <p style={{ color: 'var(--os-muted)', fontSize: 12, marginTop: 8 }}>Preview with live job variables: {fillTemplate('{customer_first_name} · {service} · {eta}', vars)}</p>
      </section>
    </div>
  );
}

export function PaymentsView() {
  const os = useOs();
  const [filter, setFilter] = useState('all');
  const [method, setMethod] = useState('all');
  const rows = os.payments.filter((p) => (filter === 'all' || p.status === filter) && (method === 'all' || String(p.method || '').toLowerCase().includes(method)));
  const collected = os.payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
  return (
    <div>
      <div className="nsos-kpis">
        <div className="nsos-kpi"><span>Collected</span><strong>{money(collected)}</strong></div>
        <div className="nsos-kpi"><span>Pending</span><strong>{money(os.payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}</strong></div>
        <div className="nsos-kpi"><span>Refunded</span><strong>{money(os.payments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0))}</strong></div>
        <div className="nsos-kpi"><span>Failed</span><strong>{os.payments.filter((p) => p.status === 'failed').length}</strong></div>
      </div>
      <div className="nsos-tabs">
        {['all', 'succeeded', 'pending', 'refunded', 'failed'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="nsos-tabs">
        {['all', 'visa', 'apple', 'invoice', 'membership'].map((f) => (
          <button key={f} className={method === f ? 'active' : ''} onClick={() => setMethod(f)}>{f}</button>
        ))}
      </div>
      {rows.length === 0 && <div className="nsos-empty">No payments in this filter.</div>}
      {rows.map((p) => (
        <div className="nsos-job" key={p.id}>
          <div><strong>{p.customer}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{p.method} · {p.at}</div></div>
          <div style={{ textAlign: 'right' }}>
            <strong>{money(p.amount)}</strong>
            <div className="nsos-actions" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
              <span className={`nsos-pill ${p.status === 'succeeded' ? 'green' : p.status === 'pending' ? 'gold' : 'red'}`}>{p.status}</span>
              {p.status === 'succeeded' && <button className="nsos-btn ghost" onClick={() => os.refundPayment(p.id)}>Refund</button>}
              {p.status === 'pending' && p.jobId && <button className="nsos-btn" onClick={() => os.collectJob(p.jobId!)}>Collect</button>}
              {p.status === 'failed' && <button className="nsos-btn" onClick={() => os.retryPayment(p.id)}>Retry</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsView() {
  const os = useOs();
  const max = Math.max(1, ...revenueDays.map((d) => d.v));
  const gross = os.jobs.reduce((s, j) => s + (j.payment === 'refunded' ? 0 : j.price), 0);
  const labor = os.employees.reduce((s, e) => s + (e.hourly_rate * e.hours_week || e.annual_salary / 52), 0);
  const close = Math.round((os.leads.filter((l) => l.status === 'sold').length / Math.max(1, os.leads.length)) * 100);
  const avg = os.jobs.length ? Math.round(os.jobs.reduce((s, j) => s + j.price, 0) / os.jobs.length) : 0;
  return (
    <div>
      <div className="nsos-kpis">
        <div className="nsos-kpi"><span>Gross (jobs)</span><strong>{money(gross)}</strong></div>
        <div className="nsos-kpi"><span>Est. labor</span><strong>{money(Math.round(labor))}</strong></div>
        <div className="nsos-kpi"><span>Close rate</span><strong>{close}%</strong></div>
        <div className="nsos-kpi"><span>Avg ticket</span><strong>{money(avg)}</strong></div>
      </div>
      <div className="nsos-grid-2">
        <div className="nsos-card">
          <span className="nsos-eyebrow">Volume</span>
          <div className="nsos-chart">{revenueDays.map((d) => <div className="nsos-bar" key={d.d}><i style={{ height: `${(d.v / max) * 130}px` }} /><span>{d.d}</span></div>)}</div>
        </div>
        <div className="nsos-card">
          <span className="nsos-eyebrow">By service</span>
          {[...os.jobs.reduce((m, j) => m.set(j.service, (m.get(j.service) || 0) + j.price), new Map<string, number>())].map(([name, v]) => (
            <div className="nsos-job" key={name}><span>{name}</span><b>{money(v)}</b></div>
          ))}
        </div>
        <div className="nsos-card">
          <span className="nsos-eyebrow">By detailer</span>
          {[...os.jobs.reduce((m, j) => m.set(j.detailer, (m.get(j.detailer) || 0) + j.price), new Map<string, number>())].map(([name, v]) => (
            <div className="nsos-job" key={name}><span>{name}</span><b>{money(v)}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HireView({ onHire, onOpen }: { onHire: (name?: string, title?: string) => void; onOpen?: (id: string) => void }) {
  const os = useOs();
  const stages = ['Applied', 'Screen', 'Interview', 'Offer', 'Onboarding'] as const;
  const [focus, setFocus] = useState<(typeof stages)[number]>('Applied');
  const [openId, setOpenId] = useState<string | null>(null);
  const stageOf = (c: { stage: string; progress: number }) => {
    if (c.progress >= 85 || /offer/i.test(c.stage)) return 'Offer';
    if (c.progress >= 70 || /background/i.test(c.stage)) return 'Interview';
    if (c.progress >= 40) return 'Screen';
    return 'Applied';
  };
  useEffect(() => {
    const first = os.candidates.find((c) => /website/i.test(c.source || '') && stageOf(c) === 'Applied');
    if (first) setOpenId(first.id);
  }, []);
  const onboard = os.employees.filter((e) => e.onboarding < 100);
  const website = os.candidates.filter((c) => /website/i.test(c.source || ''));
  const rowsFor = (stage: string) => os.candidates.filter((c) => stageOf(c) === stage);
  const focusedRows = focus === 'Onboarding' ? [] : rowsFor(focus);
  const count = (stage: string) => (stage === 'Onboarding' ? onboard.length : rowsFor(stage).length);

  const renderCandidate = (c: (typeof os.candidates)[number], compact?: boolean) => {
    const open = openId === c.id || !compact;
    return (
      <div className={`nsos-card nsos-hire-card${open ? ' open' : ''}`} key={c.id}>
        <button type="button" className="nsos-hire-card-hit" onClick={() => setOpenId(open && compact ? null : c.id)}>
          <span className="nsos-eyebrow">{c.role}{c.source ? ` · ${c.source}` : ''}</span>
          <h3>{c.name}</h3>
          <p>{[c.city, c.phone].filter(Boolean).join(' · ') || 'No contact yet'}</p>
        </button>
        {open && (
          <>
            {c.email ? <p className="nsos-hire-meta">{c.email}</p> : null}
            {c.startDate && !(c.notes && /start/i.test(c.notes)) ? <p className="nsos-hire-meta">Can start {c.startDate}</p> : null}
            {c.notes ? <p className="nsos-hire-notes">{c.notes}</p> : <p className="nsos-hire-empty">No written answers on this card yet.</p>}
            <p className="nsos-hire-meta">Next: {c.checklist?.find((item) => !item.done)?.label || 'Convert to teammate'}</p>
            <div className="nsos-hire-actions">
              {c.phone ? <a className="nsos-btn ghost" href={`tel:${c.phone.replace(/\D/g, '')}`}>Call</a> : null}
              <button className="nsos-btn ghost" type="button" onClick={() => onHire(c.name, c.role)}>Hire</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="nsos-hire">
      <div className="nsos-hire-head">
        <div>
          <span className="nsos-eyebrow">Hiring</span>
          <h2>
            {website.length ? `${website.length} website ${website.length === 1 ? 'application' : 'applications'}` : 'Hiring board'}
            <span>{os.candidates.length} in pipeline</span>
          </h2>
        </div>
        <button className="nsos-btn ghost" onClick={() => onHire()}>+ Add hire</button>
      </div>
      <div className="nsos-hire-stages" role="tablist" aria-label="Hiring stages">
        {stages.map((stage) => (
          <button
            key={stage}
            type="button"
            role="tab"
            aria-selected={focus === stage}
            className={focus === stage ? 'active' : ''}
            onClick={() => {
              setFocus(stage);
              setOpenId(stage === 'Onboarding' ? null : (rowsFor(stage)[0]?.id || null));
            }}
          >
            {stage === 'Onboarding' ? 'Onboard' : stage} {count(stage)}
          </button>
        ))}
      </div>
      <div className="nsos-hire-list">
        {focus === 'Onboarding' && onboard.map((e) => (
          <button className="nsos-lead" type="button" key={e.id} onClick={() => onOpen?.(e.id)}>
            <strong className="nsos-lead-name">{e.name}</strong>
            <small className="nsos-lead-addr">{e.email}</small>
            <div style={{ marginTop: 8, fontSize: 12 }}>{e.onboarding}% · next {remainingStepLabels(e.onboarding_packet)[0] || 'done'}</div>
          </button>
        ))}
        {focus === 'Onboarding' && !onboard.length && <p className="nsos-hire-empty">Nobody is in an onboarding packet.</p>}
        {focusedRows.map((c) => renderCandidate(c, true))}
        {focus !== 'Onboarding' && !focusedRows.length && <p className="nsos-hire-empty">No candidates in {focus}.</p>}
      </div>
    </div>
  );
}

export function SettingsView() {
  const os = useOs();
  const [page, setPage] = useState('company');
  const items = [
    ['company', 'Company'],
    ['branding', 'Branding'],
    ['booking', 'Booking'],
    ['payments', 'Payments'],
    ['notifications', 'Notifications'],
    ['team', 'Team access'],
    ['data', 'Demo data'],
  ];
  const s = os.settings;
  return (
    <div className="nsos-settings">
      <nav>{items.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</nav>
      <div className="nsos-card">
        {page === 'company' && (
          <>
            <label className="nsos-field">Company name<input value={s.company} onChange={(e) => os.saveSettings({ company: e.target.value })} /></label>
            <label className="nsos-field">Primary market<input value={s.market} onChange={(e) => os.saveSettings({ market: e.target.value })} /></label>
            <label className="nsos-field">Support phone<input value={s.phone} onChange={(e) => os.saveSettings({ phone: e.target.value })} /></label>
            <label className="nsos-field">Support email<input value={s.supportEmail} onChange={(e) => os.saveSettings({ supportEmail: e.target.value })} /></label>
            <label className="nsos-field">Timezone<input value={s.timezone} onChange={(e) => os.saveSettings({ timezone: e.target.value })} /></label>
          </>
        )}
        {page === 'branding' && <p>Gold #c8a96a, cream paper, Playfair display. Customer emails, SMS, and portal share one status bar: Appointment → Confirmed → En Route → In Progress → Complete.</p>}
        {page === 'booking' && (
          <label className="nsos-field">Deposit percent
            <input type="number" value={s.depositPercent} onChange={(e) => os.saveSettings({ depositPercent: Number(e.target.value) })} />
          </label>
        )}
        {page === 'payments' && <p>Transactions live in Payments. Collect on the job, refund from the ledger, retry failed memberships.</p>}
        {page === 'notifications' && (
          <p>Job status changes fire enabled templates. Collect and refund send payment messages too. Edit copy in Communications.</p>
        )}
        {page === 'team' && <p>Owner, admin, manager, detailer, D2D, office, finance, recruiter — plus custom titles. Pay is never locked to a role.</p>}
        {page === 'data' && (
          <>
            <p style={{ marginBottom: 12 }}>This preview stores OS state in your browser. Reset restores the seed company.</p>
            <button className="nsos-btn danger" onClick={os.resetDemo}>Reset demo data</button>
          </>
        )}
      </div>
    </div>
  );
}

export function CommsView() {
  const os = useOs();
  const templates = os.templates;
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const [preview, setPreview] = useState<'email' | 'sms' | null>(null);
  const selected = templates.find((t) => t.id === selectedId) || templates[0];
  const liveJob = os.jobs[0];
  const vars = liveJob ? {
    customer_first_name: firstWord(liveJob.customer, 'Customer'),
    detailer_name: firstWord(liveJob.detailer, 'Detailer'),
    vehicle: liveJob.vehicle,
    service: liveJob.service,
    appointment_time: liveJob.time,
    price: money(liveJob.price),
    eta: liveJob.eta || SAMPLE_VARS.eta,
    portal_link: SAMPLE_VARS.portal_link,
  } : SAMPLE_VARS;
  const stepNow = liveJob ? stepIndex(liveJob.status) : 1;
  return (
    <div>
      <p className="nsos-comm-lead">Status changes on a job fire these templates — nobody in the office has to text the customer.</p>
      <div className="nsos-status" style={{ marginBottom: 16 }}>
        {JOB_STEP_LABELS.map((s, i) => <span key={s} className={i < stepNow ? 'done' : i === stepNow ? 'now' : ''}>{s}</span>)}
      </div>
      <div className="nsos-grid-2">
        <aside>
          {COMM_GROUPS.map((g) => (
            <section key={g.id} style={{ marginBottom: 14 }}>
              <div className="nsos-eyebrow">{g.title}</div>
              {templates.filter((t) => t.category === g.id).map((t) => (
                <label key={t.id} className={`nsos-comm-row ${selected?.id === t.id ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={t.is_enabled}
                    onChange={(e) => os.patchTemplate(t.id, { is_enabled: e.target.checked })}
                  />
                  <button type="button" onClick={() => setSelectedId(t.id)}>
                    <strong>{t.name}</strong>
                    <small>{t.timing_label} · {channelLabel(t)}</small>
                  </button>
                </label>
              ))}
            </section>
          ))}
        </aside>
        {selected && (
          <div className="nsos-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div>
                <span className="nsos-eyebrow">Edit template</span>
                <h3>{selected.name}</h3>
              </div>
              <label className="nsos-pill gold"><input type="checkbox" checked={selected.is_enabled} onChange={(e) => os.patchTemplate(selected.id, { is_enabled: e.target.checked })} /> Enabled</label>
            </div>
            <p style={{ color: 'var(--os-muted)', margin: '6px 0 12px' }}>{selected.timing_label}</p>
            <div className="nsos-actions" style={{ marginBottom: 10 }}>
              <label className="nsos-pill"><input type="checkbox" checked={selected.email_enabled} onChange={(e) => os.patchTemplate(selected.id, { email_enabled: e.target.checked })} /> Email</label>
              <label className="nsos-pill"><input type="checkbox" checked={selected.sms_enabled} onChange={(e) => os.patchTemplate(selected.id, { sms_enabled: e.target.checked })} /> SMS</label>
            </div>
            <label className="nsos-field">Timing offset (minutes)
              <input type="number" value={selected.send_delay_minutes} onChange={(e) => os.patchTemplate(selected.id, { send_delay_minutes: Number(e.target.value) })} />
            </label>
            <label className="nsos-field">Email subject<input value={selected.subject} onChange={(e) => os.patchTemplate(selected.id, { subject: e.target.value })} /></label>
            <label className="nsos-field">Email body<textarea rows={5} value={selected.body} onChange={(e) => os.patchTemplate(selected.id, { body: e.target.value })} /></label>
            <label className="nsos-field">SMS<textarea rows={3} value={selected.sms_body} onChange={(e) => os.patchTemplate(selected.id, { sms_body: e.target.value })} /></label>
            <div className="nsos-actions">
              {COMM_VARIABLES.map((v) => <button key={v} className="nsos-btn ghost" type="button" onClick={() => os.patchTemplate(selected.id, { body: `${selected.body} ${v}` })}>{v}</button>)}
            </div>
            <div className="nsos-actions" style={{ marginTop: 12 }}>
              <button className="nsos-btn ghost" type="button" onClick={() => setPreview('email')}><Bell size={14} />Preview email</button>
              <button className="nsos-btn ghost" type="button" onClick={() => setPreview('sms')}><Smartphone size={14} />Preview SMS</button>
              <button className="nsos-btn" type="button" onClick={() => os.sendTestComm(selected.id, liveJob?.id)}>Send test</button>
            </div>
          </div>
        )}
      </div>
      {preview && selected && (
        <div className="nsos-modal" onClick={() => setPreview(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {preview === 'email' ? (
              <PremiumEmail
                headline={fillTemplate(selected.subject, vars)}
                time={vars.appointment_time}
                service={vars.service}
                vehicle={vars.vehicle}
                detailer={vars.detailer_name}
                price={vars.price}
                step={stepNow}
              />
            ) : (
              <div className="nsos-sms"><div className="bubble">{fillTemplate(selected.sms_body, vars)}</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HireModal({
  open, onClose, onSave, preset,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: EmployeeDraft) => void;
  preset?: Partial<EmployeeDraft>;
}) {
  const [draft, setDraft] = useState<EmployeeDraft>(() => ({ ...emptyEmployeeDraft(), ...preset }));
  useEffect(() => {
    if (open) setDraft({ ...emptyEmployeeDraft(), ...preset });
  }, [open, preset?.name, preset?.title]);
  if (!open) return null;
  return (
    <div className="nsos-modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2>Add a new hire</h2>
          <button className="nsos-btn ghost" onClick={onClose}>Close</button>
        </div>
        <AddEmployeeForm
          value={draft}
          onChange={setDraft}
          submitting={false}
          submitLabel="Create hire & open packet"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setDraft(emptyEmployeeDraft());
          }}
        />
      </div>
    </div>
  );
}

export function MoreGrid({ onPick }: { onPick: (id: string) => void }) {
  const items = [
    ['command_center', 'Command Center', 'Jobs, cash, and exceptions'],
    ['people', 'Employees', 'Directory and pay mix'],
    ['schedule', 'Hours', 'Shifts and availability'],
    ['calendar', 'Appointments', 'Customer calendar'],
    ['dispatch', 'Dispatch', 'Technician columns'],
    ['d2d', 'D2D portal', 'Neighborhood map'],
    ['pipeline', 'Lead pipeline', 'Stages and ownership'],
    ['customers', 'Customers', 'Household records'],
    ['jobs', 'Detailer jobs', 'Live job packets'],
    ['payments', 'Payments', 'Ledger and refunds'],
    ['reports', 'Reports', 'KPI snapshot'],
    ['hire', 'Hiring', 'Onboarding packets'],
    ['comms', 'Communications', 'Status templates'],
    ['settings', 'Settings', 'Company and locations'],
    ['chat', 'Chat', 'Google Chat / Teams'],
  ] as const;
  return (
    <div className="nsos-more">
      {items.map(([id, title, sub]) => (
        <button key={id} onClick={() => onPick(id)}>
          <strong>{title}</strong>
          <small>{sub}</small>
        </button>
      ))}
    </div>
  );
}

const TITLES_SAFE: Record<string, string> = {
  home: 'command_center', schedule: 'hours', dispatch: 'dispatch', payments: 'payments',
  hire: 'hiring', comms: 'communications', settings: 'settings',
};

export function OmniSearch({
  onGo, onOpenPerson, onOpenJob, onOpenChat,
}: {
  onGo: (id: string) => void;
  onOpenPerson: (id: string) => void;
  onOpenJob: (id: string) => void;
  onOpenChat: (id: string) => void;
}) {
  const os = useOs();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const hits = !query ? [] : [
    ...os.employees.filter((e) => `${e.name} ${e.title}`.toLowerCase().includes(query)).map((e) => ({ id: e.id, kind: 'person' as const, title: e.name, sub: e.title })),
    ...os.jobs.filter((j) => `${j.customer} ${j.service} ${j.vehicle}`.toLowerCase().includes(query)).map((j) => ({ id: j.id, kind: 'job' as const, title: j.customer, sub: j.service })),
    ...os.leads.filter((l) => `${l.name} ${l.address}`.toLowerCase().includes(query)).map((l) => ({ id: l.id, kind: 'lead' as const, title: l.name, sub: l.address })),
    ...os.chats.filter((c) => String(c.name || '').toLowerCase().includes(query)).map((c) => ({ id: c.id, kind: 'chat' as const, title: c.name, sub: c.preview })),
    ...(['home', 'schedule', 'dispatch', 'payments', 'hire', 'comms', 'settings'] as const)
      .filter((id) => id.includes(query) || String(TITLES_SAFE[id] || '').includes(query))
      .map((id) => ({ id, kind: 'view' as const, title: id, sub: 'Workspace' })),
  ].slice(0, 8);
  return (
    <div className="nsos-omni">
      <div className="nsos-search">
        <Search size={14} />
        <input
          value={q}
          placeholder="Search people, jobs, chats"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        />
      </div>
      {open && query && (
        <div className="nsos-omni-list">
          {hits.length === 0 && <div className="nsos-empty">Nothing matches.</div>}
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (h.kind === 'person') { onGo('people'); onOpenPerson(h.id); }
                else if (h.kind === 'job') onOpenJob(h.id);
                else if (h.kind === 'lead') onGo('d2d');
                else if (h.kind === 'chat') onOpenChat(h.id);
                else onGo(h.id);
                setQ('');
                setOpen(false);
              }}
            >
              <strong>{h.title}</strong>
              <small>{h.kind} · {h.sub}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function JobsHome({ jobs, onOpen }: { jobs: OsJob[]; onOpen: (id: string) => void }) {
  const os = useOs();
  const [filter, setFilter] = useState('open');
  const rows = jobs.filter((j) => filter === 'all' || (filter === 'open' ? j.status !== 'completed' : j.status === filter));
  return (
    <div>
      <div className="detail-menu-board">
        {(['exterior', 'interior', 'full'] as const).map((family) => (
          <section className="nsos-card" key={family}>
            <span className="nsos-eyebrow">{DETAIL_FAMILY_COPY[family].kicker}</span>
            <h3>{DETAIL_FAMILY_COPY[family].title}</h3>
            <p className="detail-selves-blurb">{DETAIL_FAMILY_COPY[family].blurb}</p>
            <div className="detail-menu-selves">
              {packagesForFamily(family).map((pkg) => (
                <div key={pkg.id} className={pkg.featured ? 'featured' : ''}>
                  <small>{pkg.tag}</small>
                  <strong>{pkg.self === 'essential' ? 'Essential' : pkg.self === 'signature' ? 'Signature' : 'Elite'}</strong>
                  <b>{money(pkg.price)}</b>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="nsos-tabs">
        {['open', 'en_route', 'arrived', 'in_progress', 'completed', 'all'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{prettyLabel(f)}</button>
        ))}
      </div>
      {rows.length === 0 && <div className="nsos-empty">No jobs in this filter.</div>}
      {rows.map((j) => (
        <div className="nsos-job nsos-job-card" key={j.id}>
          <button type="button" onClick={() => onOpen(j.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 0, color: 'inherit', minHeight: 44 }}>
            <strong>{j.customer}</strong>
            <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.service} · {j.vehicle}</div>
            <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.time} · {j.address}</div>
          </button>
          <div className="nsos-job-actions" style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
            <span className={`nsos-pill ${j.status === 'completed' ? 'green' : 'gold'}`}>{prettyLabel(j.status)}</span>
            {j.status === 'confirmed' || j.status === 'scheduled' ? (
              <button className="nsos-btn" onClick={() => os.setJobStatus(j.id, 'en_route')}>En route</button>
            ) : j.status === 'en_route' ? (
              <button className="nsos-btn" onClick={() => os.setJobStatus(j.id, 'arrived')}>Arrived</button>
            ) : j.status === 'arrived' ? (
              <button className="nsos-btn" onClick={() => os.setJobStatus(j.id, 'in_progress')}>Start</button>
            ) : j.status === 'in_progress' ? (
              <button className="nsos-btn" onClick={() => os.setJobStatus(j.id, 'completed')}>Finish</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
