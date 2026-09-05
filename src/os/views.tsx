import { useState } from 'react';
import {
  Bell, CalendarDays, MapPin, Navigation, Plus, Search, Send, Smartphone,
} from 'lucide-react';
import AddEmployeeForm from '@/components/AddEmployeeForm';
import { channelLabel, COMM_GROUPS, COMM_VARIABLES, fillTemplate, SAMPLE_VARS, type CommunicationTemplate } from '@/lib/communicationCatalog';
import { emptyEmployeeDraft, type EmployeeDraft } from '@/lib/rolePresets';
import { money } from '@/lib/data';
import {
  payLine, revenueDays, type OsChat, type OsEmployee, type OsJob, type OsLead, type OsPayment, type OsCandidate,
} from './demoData';

export function Avatar({ initials, hue, size = 40 }: { initials: string; hue: string; size?: number }) {
  return <span className="nsos-avatar" style={{ width: size, height: size, background: hue, fontSize: size * 0.32 }}>{initials}</span>;
}

export function OwnerDashboard({ jobs, payments }: { jobs: OsJob[]; payments: OsPayment[] }) {
  const max = Math.max(...revenueDays.map((d) => d.v));
  const week = revenueDays.reduce((s, d) => s + d.v, 0);
  return (
    <div>
      <div className="nsos-kpis">
        <div className="nsos-kpi"><span>Week revenue</span><strong>{money(week)}</strong><em>+12% vs last week</em></div>
        <div className="nsos-kpi"><span>Jobs today</span><strong>{jobs.filter((j) => j.time.includes('Today')).length}</strong><em>2 in field</em></div>
        <div className="nsos-kpi"><span>Collected</span><strong>{money(payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0))}</strong><em>Square + invoices</em></div>
        <div className="nsos-kpi"><span>Open invoices</span><strong>{money(payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}</strong><em>1 due after service</em></div>
      </div>
      <div className="nsos-grid-2">
        <section className="nsos-card">
          <span className="nsos-eyebrow">Revenue</span>
          <h3>Last 7 days</h3>
          <div className="nsos-chart">
            {revenueDays.map((d) => (
              <div className="nsos-bar" key={d.d}>
                <i style={{ height: `${Math.max(12, (d.v / max) * 130)}px` }} />
                <span>{d.d}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Recent activity</span>
          <h3>Live operations</h3>
          <ul className="nsos-activity">
            <li><i className="nsos-dot" /><span>Marcus tapped En Route for Matthew’s BMW.</span></li>
            <li><i className="nsos-dot" /><span>Sofia set a Friday appointment at 44 Birch.</span></li>
            <li><i className="nsos-dot" /><span>Priya Shah paid $650 ceramic by Apple Pay.</span></li>
            <li><i className="nsos-dot" /><span>Elena’s onboarding is 60% — documents outstanding.</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export function ChatThread({ chat, onSend }: { chat: OsChat; onSend: (body: string) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="nsos-chat">
      <div className="nsos-thread">
        {chat.messages.map((m) => (
          <div className={`nsos-bubble ${m.mine ? 'mine' : ''}`} key={m.id}>
            {!m.mine && <b>{m.from}</b>}
            {m.body}
            <time>{m.at}</time>
          </div>
        ))}
      </div>
      <form className="nsos-composer" onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; onSend(draft.trim()); setDraft(''); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${chat.name}`} rows={1} />
        <button className="nsos-btn" type="submit"><Send size={14} />Send</button>
      </form>
    </div>
  );
}

export function PeopleHome({ employees, onOpen, onHire }: { employees: OsEmployee[]; onOpen: (id: string) => void; onHire: () => void }) {
  const [q, setQ] = useState('');
  const rows = employees.filter((e) => `${e.name} ${e.title} ${e.department}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="nsos-actions" style={{ marginBottom: 14 }}>
        <div className="nsos-search" style={{ flex: 1 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" /></div>
        <button className="nsos-btn" onClick={onHire}><Plus size={14} />Add employee</button>
      </div>
      {rows.map((e) => (
        <button className="nsos-job" key={e.id} onClick={() => onOpen(e.id)} style={{ width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar initials={e.initials} hue={e.hue} />
            <div>
              <strong>{e.name}</strong>
              <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{e.title} · {e.department}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`nsos-pill ${e.status === 'active' ? 'green' : e.status === 'leave' ? 'gold' : 'red'}`}>{e.status}</span>
            <div style={{ color: 'var(--os-muted)', fontSize: 12, marginTop: 6 }}>{payLine(e)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PeopleProfile({ employee }: { employee: OsEmployee }) {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Avatar initials={employee.initials} hue={employee.hue} size={64} />
        <div>
          <span className="nsos-eyebrow">{employee.department}</span>
          <h2>{employee.name}</h2>
          <p style={{ color: 'var(--os-muted)' }}>{employee.title} · {employee.location}</p>
        </div>
      </div>
      <div className="nsos-tabs">
        {['overview', 'employment', 'documents', 'pay', 'schedule', 'activity'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="nsos-kpis">
          <div className="nsos-kpi"><span>Hours this week</span><strong>{employee.hours_week}</strong></div>
          <div className="nsos-kpi"><span>Onboarding</span><strong>{employee.onboarding}%</strong></div>
          <div className="nsos-kpi"><span>Status</span><strong>{employee.status}</strong></div>
          <div className="nsos-kpi"><span>Pay</span><strong style={{ fontSize: 16 }}>{payLine(employee)}</strong></div>
        </div>
      )}
      {tab === 'employment' && (
        <div className="nsos-card">
          <p><b>Email</b> · {employee.email}</p>
          <p><b>Phone</b> · {employee.phone}</p>
          <p><b>System role</b> · {employee.role.replaceAll('_', ' ')}</p>
          <p><b>Job title</b> · {employee.title}</p>
        </div>
      )}
      {tab === 'documents' && <div className="nsos-card">Offer letter, I-9, W-4, and handbook acknowledgements attach on this tab once storage is connected.</div>}
      {tab === 'pay' && (
        <div className="nsos-card">
          <p>This person is paid as <b>{employee.pay_type.replaceAll('_', ' ')}</b> on a {employee.pay_schedule} schedule.</p>
          <p style={{ marginTop: 8 }}>{payLine(employee)}</p>
          <p style={{ color: 'var(--os-muted)', marginTop: 8 }}>Open Add employee to see the full mix of salary, hourly, commission, and custom rules — every hire can be different, including admins.</p>
        </div>
      )}
      {tab === 'schedule' && <div className="nsos-card">Tue–Sat field coverage. Time-off: none pending.</div>}
      {tab === 'activity' && <div className="nsos-card">Clocked in at 8:58 AM. En route to Oakwood BMW.</div>}
    </div>
  );
}

export function ScheduleView({ employees }: { employees: OsEmployee[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="nsos-card">
      <span className="nsos-eyebrow">Deputy-style board</span>
      <h3>This week</h3>
      <div className="nsos-kanban" style={{ gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))', marginTop: 12 }}>
        {days.map((d) => (
          <div className="nsos-col" key={d}>
            <h3>{d}</h3>
            {employees.filter((e) => e.status === 'active').slice(0, d === 'Sat' ? 2 : 3).map((e) => (
              <div className="nsos-shift" key={e.id + d} draggable>
                <strong>{e.name.split(' ')[0]}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{d === 'Sat' ? '9a–2p' : '8:30a–5p'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ jobs, onOpen }: { jobs: OsJob[]; onOpen: (id: string) => void }) {
  return (
    <div>
      {jobs.map((j) => (
        <button className="nsos-job" key={j.id} onClick={() => onOpen(j.id)} style={{ width: '100%', textAlign: 'left' }}>
          <div>
            <strong>{j.service}</strong>
            <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.customer} · {j.vehicle}</div>
            <div style={{ color: 'var(--os-muted)', fontSize: 12 }}><CalendarDays size={12} /> {j.time} · {j.address}</div>
          </div>
          <span className="nsos-pill gold">{j.status.replaceAll('_', ' ')}</span>
        </button>
      ))}
    </div>
  );
}

export function DispatchView({ jobs, employees }: { jobs: OsJob[]; employees: OsEmployee[] }) {
  const crews = employees.filter((e) => e.role === 'detailer' || e.role === 'manager');
  return (
    <div className="nsos-dispatch">
      {crews.map((c) => (
        <section className="nsos-card" key={c.id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <Avatar initials={c.initials} hue={c.hue} />
            <div><strong>{c.name}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{c.title}</div></div>
          </div>
          {jobs.filter((j) => j.detailer === c.name && j.status !== 'completed').map((j) => (
            <div className="nsos-shift" key={j.id}>
              <strong>{j.customer}</strong>
              <div style={{ fontSize: 12, color: 'var(--os-muted)' }}>{j.service} · {j.time}</div>
              <span className="nsos-pill gold">{j.status.replaceAll('_', ' ')}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function D2DView({ leads }: { leads: OsLead[] }) {
  return (
    <div className="nsos-grid-2">
      <div className="nsos-map">
        {leads.map((l, i) => (
          <span key={l.id} className={`nsos-pin ${l.temp}`} style={{ left: `${18 + (i * 13) % 70}%`, top: `${22 + (i * 17) % 55}%` }} title={l.address} />
        ))}
      </div>
      <div>
        <div className="nsos-kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="nsos-kpi"><span>Doors today</span><strong>42</strong></div>
          <div className="nsos-kpi"><span>Appointments</span><strong>3</strong></div>
        </div>
        {leads.map((l) => (
          <div className="nsos-job" key={l.id}>
            <div><strong>{l.name}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{l.address} · {l.rep}</div></div>
            <span className={`nsos-pill ${l.temp === 'hot' ? 'red' : l.temp === 'warm' ? 'gold' : 'blue'}`}>{l.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineView({ leads }: { leads: OsLead[] }) {
  const stages: OsLead['status'][] = ['new', 'knocked', 'interested', 'appointment', 'sold'];
  return (
    <div className="nsos-kanban">
      {stages.map((s) => (
        <div className="nsos-col" key={s}>
          <h3>{s}<span>{leads.filter((l) => l.status === s).length}</span></h3>
          {leads.filter((l) => l.status === s).map((l) => (
            <div className="nsos-lead" key={l.id}>
              <strong>{l.name}</strong>
              <small style={{ color: 'var(--os-muted)' }}>{l.address}</small>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                <span>{l.rep}</span><b>{money(l.value)}</b>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CustomersView({ jobs }: { jobs: OsJob[] }) {
  const names = [...new Set(jobs.map((j) => j.customer))];
  return (
    <div>
      {names.map((n) => {
        const rows = jobs.filter((j) => j.customer === n);
        return (
          <div className="nsos-card" key={n} style={{ marginBottom: 10 }}>
            <strong>{n}</strong>
            <div style={{ color: 'var(--os-muted)', fontSize: 12, margin: '4px 0 8px' }}>{rows[0].vehicle} · {rows.length} jobs · {money(rows.reduce((s, j) => s + j.price, 0))} lifetime</div>
            {rows.map((j) => <div key={j.id} style={{ fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--os-line)' }}>{j.time} · {j.service} · {j.status.replaceAll('_', ' ')}</div>)}
          </div>
        );
      })}
    </div>
  );
}

export function JobDetail({ job, onStatus }: { job: OsJob; onStatus: (status: OsJob['status']) => void }) {
  const steps: OsJob['status'][] = ['scheduled', 'confirmed', 'en_route', 'in_progress', 'completed'];
  const idx = Math.max(0, steps.indexOf(job.status === 'arrived' ? 'en_route' : job.status));
  return (
    <div className="nsos-card">
      <span className="nsos-eyebrow">{job.time}</span>
      <h2>{job.service}</h2>
      <p style={{ color: 'var(--os-muted)' }}>{job.customer} · {job.vehicle}</p>
      <div className="nsos-status">
        {['Appointment', 'Confirmed', 'En Route', 'In Progress', 'Complete'].map((label, i) => (
          <span key={label} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{label}</span>
        ))}
      </div>
      <p style={{ marginTop: 12 }}><MapPin size={14} /> {job.address}</p>
      <p>Assigned: {job.detailer}</p>
      <p>{money(job.price)} · {job.payment}</p>
      <div className="nsos-actions" style={{ marginTop: 14 }}>
        <a className="nsos-btn ghost" href={`https://maps.apple.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"><Navigation size={14} />Directions</a>
        {job.status !== 'en_route' && job.status !== 'completed' && <button className="nsos-btn" onClick={() => onStatus('en_route')}>En route</button>}
        {job.status === 'en_route' && <button className="nsos-btn" onClick={() => onStatus('in_progress')}>Start job</button>}
        {job.status === 'in_progress' && <button className="nsos-btn" onClick={() => onStatus('completed')}>Complete</button>}
      </div>
    </div>
  );
}

export function PaymentsView({ payments }: { payments: OsPayment[] }) {
  const [filter, setFilter] = useState('all');
  const rows = payments.filter((p) => filter === 'all' || p.status === filter);
  return (
    <div>
      <div className="nsos-tabs">
        {['all', 'succeeded', 'pending', 'refunded', 'failed'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {rows.map((p) => (
        <div className="nsos-job" key={p.id}>
          <div><strong>{p.customer}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{p.method} · {p.at}</div></div>
          <div style={{ textAlign: 'right' }}>
            <strong>{money(p.amount)}</strong>
            <div><span className={`nsos-pill ${p.status === 'succeeded' ? 'green' : p.status === 'pending' ? 'gold' : 'red'}`}>{p.status}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsView() {
  const max = Math.max(...revenueDays.map((d) => d.v));
  return (
    <div>
      <div className="nsos-kpis">
        <div className="nsos-kpi"><span>Gross</span><strong>{money(12630)}</strong></div>
        <div className="nsos-kpi"><span>Labor</span><strong>{money(4180)}</strong></div>
        <div className="nsos-kpi"><span>Close rate</span><strong>28%</strong></div>
        <div className="nsos-kpi"><span>Avg ticket</span><strong>{money(312)}</strong></div>
      </div>
      <div className="nsos-card">
        <span className="nsos-eyebrow">Volume</span>
        <div className="nsos-chart">{revenueDays.map((d) => <div className="nsos-bar" key={d.d}><i style={{ height: `${(d.v / max) * 130}px` }} /><span>{d.d}</span></div>)}</div>
      </div>
    </div>
  );
}

export function HireView({ candidates }: { candidates: OsCandidate[] }) {
  return (
    <div className="nsos-grid-3">
      {candidates.map((c) => (
        <div className="nsos-card" key={c.id}>
          <span className="nsos-eyebrow">{c.role}</span>
          <h3>{c.name}</h3>
          <p style={{ color: 'var(--os-muted)', margin: '8px 0' }}>{c.stage}</p>
          <div style={{ height: 6, background: '#2a2620', borderRadius: 99 }}>
            <div style={{ width: `${c.progress}%`, height: '100%', background: 'var(--os-gold)', borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsView() {
  const [page, setPage] = useState('company');
  const items = [
    ['company', 'Company'],
    ['branding', 'Branding'],
    ['booking', 'Booking'],
    ['payments', 'Payments'],
    ['notifications', 'Notifications'],
    ['team', 'Team access'],
  ];
  return (
    <div className="nsos-settings">
      <nav>{items.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</nav>
      <div className="nsos-card">
        {page === 'company' && (
          <>
            <label className="nsos-field">Company name<input defaultValue="North Splash Auto Luxe" /></label>
            <label className="nsos-field">Primary market<input defaultValue="Raleigh–Durham" /></label>
            <label className="nsos-field">Support phone<input defaultValue="330-000-0000" /></label>
          </>
        )}
        {page === 'branding' && <p>Gold #c8a96a, cream paper, Playfair display. Customer emails, SMS, and portal share one status bar.</p>}
        {page === 'booking' && <p>Jobber-style packages, deposits, and confirmation requests live here.</p>}
        {page === 'payments' && <p>Square payments, invoices, memberships, and refunds.</p>}
        {page === 'notifications' && <p>Jump to Communications to edit Housecall Pro–style automations.</p>}
        {page === 'team' && <p>Owner, admin, manager, detailer, D2D, office, finance, recruiter — plus custom titles.</p>}
      </div>
    </div>
  );
}

export function CommsView({ templates, onChange }: { templates: CommunicationTemplate[]; onChange: (next: CommunicationTemplate[]) => void }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const [preview, setPreview] = useState<'email' | 'sms' | null>(null);
  const selected = templates.find((t) => t.id === selectedId) || templates[0];
  const patch = (partial: Partial<CommunicationTemplate>) => onChange(templates.map((t) => t.id === selected.id ? { ...t, ...partial } : t));
  return (
    <div>
      <div className="nsos-status" style={{ marginBottom: 16 }}>
        {['Appointment', 'Confirmed', 'En Route', 'In Progress', 'Complete'].map((s, i) => <span key={s} className={i < 2 ? 'done' : i === 2 ? 'now' : ''}>{s}</span>)}
      </div>
      <div className="nsos-grid-2">
        <aside>
          {COMM_GROUPS.map((g) => (
            <section key={g.id} style={{ marginBottom: 14 }}>
              <div className="nsos-eyebrow">{g.title}</div>
              {templates.filter((t) => t.category === g.id).map((t) => (
                <button className={`nsos-row ${selected?.id === t.id ? 'active' : ''}`} key={t.id} onClick={() => setSelectedId(t.id)}>
                  <span className={`nsos-pill ${t.is_enabled ? 'green' : ''}`}>{t.is_enabled ? 'on' : 'off'}</span>
                  <span><strong>{t.name}</strong><small>{t.timing_label} · {channelLabel(t)}</small></span>
                </button>
              ))}
            </section>
          ))}
        </aside>
        {selected && (
          <div className="nsos-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <h3>{selected.name}</h3>
              <label className="nsos-pill gold"><input type="checkbox" checked={selected.is_enabled} onChange={(e) => patch({ is_enabled: e.target.checked })} /> Enabled</label>
            </div>
            <p style={{ color: 'var(--os-muted)', margin: '6px 0 12px' }}>{selected.timing_label}</p>
            <label className="nsos-field">Email subject<input value={selected.subject} onChange={(e) => patch({ subject: e.target.value })} /></label>
            <label className="nsos-field">Email body<textarea rows={5} value={selected.body} onChange={(e) => patch({ body: e.target.value })} /></label>
            <label className="nsos-field">SMS<textarea rows={3} value={selected.sms_body} onChange={(e) => patch({ sms_body: e.target.value })} /></label>
            <div className="nsos-actions">
              {COMM_VARIABLES.map((v) => <button key={v} className="nsos-btn ghost" type="button" onClick={() => navigator.clipboard.writeText(v)}>{v}</button>)}
            </div>
            <div className="nsos-actions" style={{ marginTop: 12 }}>
              <button className="nsos-btn ghost" type="button" onClick={() => setPreview('email')}><Bell size={14} />Preview email</button>
              <button className="nsos-btn ghost" type="button" onClick={() => setPreview('sms')}><Smartphone size={14} />Preview SMS</button>
            </div>
          </div>
        )}
      </div>
      {preview && selected && (
        <div className="nsos-modal" onClick={() => setPreview(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {preview === 'email' ? (
              <div className="nsos-email">
                <header>NORTH SPLASH AUTO LUXE</header>
                <div className="hero">
                  <h2>{fillTemplate(selected.subject)}</h2>
                  <div className="meta">
                    <div>{SAMPLE_VARS.appointment_time}</div>
                    <div>{SAMPLE_VARS.service}</div>
                    <div>{SAMPLE_VARS.vehicle}</div>
                    <div>Assigned · {SAMPLE_VARS.detailer_name}</div>
                    <div>{SAMPLE_VARS.price}</div>
                  </div>
                </div>
                <div className="cta">VIEW APPOINTMENT</div>
                <div className="nsos-status" style={{ padding: '0 16px 12px' }}>
                  {['Appointment', 'Confirmed', 'En Route', 'In Progress', 'Complete'].map((s, i) => <span key={s} className={i < 2 ? 'done' : ''}>{s}</span>)}
                </div>
                <footer>North Splash Auto Luxe · Raleigh · {SAMPLE_VARS.portal_link}</footer>
              </div>
            ) : (
              <div className="nsos-sms"><div className="bubble">{fillTemplate(selected.sms_body)}</div></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function HireModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (draft: EmployeeDraft) => void }) {
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployeeDraft());
  if (!open) return null;
  return (
    <div className="nsos-modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2>Add employee</h2>
          <button className="nsos-btn ghost" onClick={onClose}>Close</button>
        </div>
        <AddEmployeeForm
          value={draft}
          onChange={setDraft}
          submitting={false}
          submitLabel="Save to directory"
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
    ['home', 'Owner dashboard', 'Stripe-style KPIs'],
    ['people', 'Employees', 'Homebase + Rippling directory'],
    ['schedule', 'Hours', 'Deputy scheduling'],
    ['calendar', 'Appointments', 'Jobber calendar'],
    ['dispatch', 'Dispatch', 'ServiceTitan board'],
    ['d2d', 'D2D portal', 'SalesRabbit map'],
    ['pipeline', 'Lead pipeline', 'SPOTIO + HubSpot'],
    ['customers', 'Customers', 'HubSpot CRM'],
    ['jobs', 'Detailer jobs', 'Housecall Pro'],
    ['payments', 'Payments', 'Square'],
    ['reports', 'Reports', 'Stripe analytics'],
    ['hire', 'Hiring', 'Gusto onboarding'],
    ['comms', 'Communications', 'Housecall Pro automations'],
    ['settings', 'Settings', 'Stripe settings nav'],
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

