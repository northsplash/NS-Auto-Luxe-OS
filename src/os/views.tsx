import { useEffect, useState } from 'react';
import {
  Bell, CalendarDays, Check, CreditCard, GripVertical, MapPin, Navigation, Plus, Search, Send, Smartphone, Trash2,
} from 'lucide-react';
import AddEmployeeForm from '@/components/AddEmployeeForm';
import { channelLabel, COMM_GROUPS, COMM_VARIABLES, fillTemplate, SAMPLE_VARS } from '@/lib/communicationCatalog';
import { emptyEmployeeDraft, type EmployeeDraft } from '@/lib/rolePresets';
import { money } from '@/lib/data';
import {
  JOB_STEP_LABELS, JOB_STEPS, LEAD_STAGES, OS_SERVICES, SHIFT_DAYS, WEEKDAYS, payLine, revenueDays,
  type JobStatus, type OsChat, type OsEmployee, type OsJob,
} from './demoData';
import { useOs } from './osStore';

export function Avatar({ initials, hue, size = 40 }: { initials: string; hue: string; size?: number }) {
  return <span className="nsos-avatar" style={{ width: size, height: size, background: hue, fontSize: size * 0.32 }}>{initials}</span>;
}

export function OwnerDashboard({ onOpenJob, onOpenPayments, onOpenPipeline }: { onOpenJob?: (id: string) => void; onOpenPayments?: () => void; onOpenPipeline?: () => void }) {
  const { jobs, payments, activity, leads } = useOs();
  const max = Math.max(...revenueDays.map((d) => d.v), 1);
  const week = revenueDays.reduce((s, d) => s + d.v, 0);
  const collected = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
  const open = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const refunded = payments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const today = jobs.filter((j) => j.time.includes('Today'));
  const field = jobs.filter((j) => j.status === 'en_route' || j.status === 'in_progress' || j.status === 'arrived').length;
  const sold = leads.filter((l) => l.status === 'sold').length;
  const inbox = jobs.flatMap((j) => (j.comms || []).slice(0, 1).map((c) => ({ ...c, job: j })));
  return (
    <div>
      <div className="nsos-kpis">
        <button className="nsos-kpi" onClick={onOpenPayments}><span>Gross volume</span><strong>{money(week)}</strong><em>+12% vs last week</em></button>
        <button className="nsos-kpi" onClick={onOpenPayments}><span>Net collected</span><strong>{money(collected)}</strong><em>{money(open)} open</em></button>
        <button className="nsos-kpi" onClick={() => today[0] && onOpenJob?.(today[0].id)}><span>Jobs today</span><strong>{today.length}</strong><em>{field} in field</em></button>
        <button className="nsos-kpi" onClick={onOpenPipeline}><span>Pipeline closes</span><strong>{sold}</strong><em>{money(refunded)} refunded</em></button>
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
            {activity.length === 0 && <li className="nsos-empty">No activity yet.</li>}
            {activity.slice(0, 8).map((a) => (
              <li key={a.id}><i className="nsos-dot" /><span><b style={{ color: 'var(--os-cream)', fontWeight: 600 }}>{a.at}</b> · {a.text}</span></li>
            ))}
          </ul>
        </section>
      </div>
      <div className="nsos-grid-2" style={{ marginTop: 14 }}>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Payouts</span>
          <h3>Latest transactions</h3>
          {payments.slice(0, 5).map((p) => (
            <button key={p.id} className="nsos-job" style={{ width: '100%', textAlign: 'left' }} onClick={onOpenPayments}>
              <div><strong>{p.customer}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{p.method} · {p.at}</div></div>
              <b>{money(p.amount)}</b>
            </button>
          ))}
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Customer inbox</span>
          <h3>Latest SMS / email</h3>
          {inbox.length === 0 && <div className="nsos-empty">Advance a job status to send the first message.</div>}
          {inbox.slice(0, 5).map((c) => (
            <button key={c.id} className="nsos-job" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenJob?.(c.job.id)}>
              <div>
                <strong>{c.job.customer} · {c.name}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{c.preview}</div>
              </div>
              <span className="nsos-pill blue">{c.channel}</span>
            </button>
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
        {chat.messages.map((m) => (
          <div className={`nsos-bubble ${m.mine ? 'mine' : ''}`} key={m.id}>
            {!m.mine && <b>{m.from}</b>}
            {m.body}
            <time>{m.at}</time>
          </div>
        ))}
      </div>
      <div className="nsos-chips">
        {todayJobs.map((j) => (
          <button key={j.id} type="button" onClick={() => onSend(`Job card: ${j.customer} · ${j.service} · ${j.status.replaceAll('_', ' ')} · ${j.address}`)}>Share {j.customer.split(' ')[0]}</button>
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
        <div className="nsos-search" style={{ flex: 1 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" /></div>
        <select className="nsos-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {[...new Set(employees.map((e) => e.role))].map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
        </select>
        <button className="nsos-btn" onClick={onHire}><Plus size={14} />Add employee</button>
      </div>
      {rows.length === 0 && <div className="nsos-empty">No teammates match that search.</div>}
      {rows.map((e) => (
        <button className="nsos-job" key={e.id} onClick={() => onOpen(e.id)} style={{ width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar initials={e.initials} hue={e.hue} />
            <div>
              <strong>{e.name}</strong>
              <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{e.title} · {e.department} · {e.hours_week}h</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`nsos-pill ${e.status === 'active' ? 'green' : e.status === 'leave' ? 'gold' : 'red'}`}>{e.status}</span>
            <div style={{ color: 'var(--os-muted)', fontSize: 12, marginTop: 6 }}>{payLine(e)}</div>
            <div style={{ color: 'var(--os-muted)', fontSize: 11, marginTop: 4 }}>Onboarding {e.onboarding}%</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PeopleProfile({ employee }: { employee: OsEmployee }) {
  const os = useOs();
  const [tab, setTab] = useState('overview');
  const shifts = os.shifts.filter((s) => s.employeeId === employee.id);
  const off = os.timeOff.filter((t) => t.employeeId === employee.id);
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <Avatar initials={employee.initials} hue={employee.hue} size={64} />
        <div style={{ flex: 1 }}>
          <span className="nsos-eyebrow">{employee.department}</span>
          <h2>{employee.name}</h2>
          <p style={{ color: 'var(--os-muted)' }}>{employee.title} · {employee.location}</p>
        </div>
        <select className="nsos-select" value={employee.status} onChange={(e) => os.updateEmployee(employee.id, { status: e.target.value as OsEmployee['status'] })}>
          <option value="active">Active</option>
          <option value="leave">Leave</option>
          <option value="inactive">Inactive</option>
        </select>
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
          <label className="nsos-field" style={{ marginTop: 12 }}>Hours this week
            <input type="number" value={employee.hours_week} onChange={(e) => os.updateEmployee(employee.id, { hours_week: Number(e.target.value) })} />
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
        <div className="nsos-card">
          <p>Paid as <b>{employee.pay_type.replaceAll('_', ' ')}</b> on a {employee.pay_schedule} schedule.</p>
          <p style={{ marginTop: 8 }}>{payLine(employee)}</p>
          <p style={{ color: 'var(--os-muted)', marginTop: 8 }}>Add employee supports any mix of salary, hourly, draw, commission, per-job, and custom rules — including admins.</p>
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
          {os.activity.filter((a) => a.text.includes(employee.name.split(' ')[0])).slice(0, 8).map((a) => (
            <div key={a.id} style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--os-line)' }}>{a.at} · {a.text}</div>
          ))}
          {os.jobs.filter((j) => j.detailer === employee.name).map((j) => (
            <div key={j.id} style={{ fontSize: 13, padding: '8px 0' }}>{j.time} · {j.customer} · {j.status.replaceAll('_', ' ')}</div>
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
        <span className="nsos-eyebrow">Deputy-style board</span>
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
                    <strong><GripVertical size={12} /> {person.name.split(' ')[0]}</strong>
                    <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{s.start}–{s.end}</div>
                    <button className="nsos-icon-btn" onClick={() => os.removeShift(s.id)} aria-label="Remove shift"><Trash2 size={12} /></button>
                  </div>
                );
              })}
              <button className="nsos-ghost-add" onClick={() => bench && os.addShift(bench, d)}>+ Add {emp(bench)?.name.split(' ')[0]}</button>
            </div>
          ))}
        </div>
      </div>
      <div className="nsos-grid-2" style={{ marginTop: 14 }}>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Availability</span>
          {os.employees.filter((e) => e.status === 'active').map((e) => (
            <div key={e.id} className="nsos-avail-row">
              <b>{e.name.split(' ')[0]}</b>
              <div className="nsos-avail">
                {WEEKDAYS.map((d) => (
                  <button key={d} className={e.availability[d] ? 'on' : ''} onClick={() => os.setAvailability(e.id, d, !e.availability[d])}>{d.slice(0, 1)}</button>
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
  const [draft, setDraft] = useState({
    customer: '', service: OS_SERVICES[2].name, vehicle: '', address: '', time: 'Tomorrow · 10:00 AM',
    price: OS_SERVICES[2].price, detailer: os.employees.find((e) => e.role === 'detailer')?.name || 'Marcus Hale',
  });
  const rows = os.jobs.filter((j) => `${j.customer} ${j.service} ${j.vehicle}`.toLowerCase().includes(q.toLowerCase()));
  const groups = rows.reduce((m, j) => {
    const day = j.time.split('·')[0].trim() || 'Upcoming';
    m.set(day, [...(m.get(day) || []), j]);
    return m;
  }, new Map<string, OsJob[]>());
  return (
    <div>
      <div className="nsos-actions" style={{ marginBottom: 12 }}>
        <div className="nsos-search" style={{ flex: 1 }}><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search appointments" /></div>
        <button className="nsos-btn" onClick={() => setOpen((v) => !v)}><Plus size={14} />New appointment</button>
      </div>
      {open && (
        <form className="nsos-card" style={{ marginBottom: 14 }} onSubmit={(e) => {
          e.preventDefault();
          if (!draft.customer.trim()) return;
          const id = os.createJob(draft);
          setOpen(false);
          setDraft({ ...draft, customer: '', vehicle: '', address: '' });
          onOpen(id);
        }}>
          <span className="nsos-eyebrow">Jobber-style booking</span>
          <div className="form-row">
            <label className="nsos-field">Customer<input required value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} /></label>
            <label className="nsos-field">Vehicle<input value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })} placeholder="Year make model" /></label>
          </div>
          <label className="nsos-field">Service
            <select value={draft.service} onChange={(e) => {
              const svc = OS_SERVICES.find((s) => s.name === e.target.value) || OS_SERVICES[2];
              setDraft({ ...draft, service: svc.name, price: svc.price });
            }}>
              {OS_SERVICES.map((s) => <option key={s.name} value={s.name}>{s.name} · {money(s.price)}</option>)}
            </select>
          </label>
          <div className="form-row">
            <label className="nsos-field">When<input value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
            <label className="nsos-field">Detailer
              <select value={draft.detailer} onChange={(e) => setDraft({ ...draft, detailer: e.target.value })}>
                {os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager' || e.role === 'owner').map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>
          <label className="nsos-field">Address<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
          <button className="nsos-btn" type="submit">Book and confirm</button>
        </form>
      )}
      {rows.length === 0 && <div className="nsos-empty">No appointments match.</div>}
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} style={{ marginBottom: 16 }}>
          <div className="nsos-eyebrow">{day}</div>
          {list.map((j) => (
            <button className="nsos-job" key={j.id} onClick={() => onOpen(j.id)} style={{ width: '100%', textAlign: 'left' }}>
              <div>
                <strong>{j.service}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{j.customer} · {j.vehicle}</div>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}><CalendarDays size={12} /> {j.time} · {j.address}</div>
              </div>
              <span className={`nsos-pill ${j.status === 'completed' ? 'green' : j.status === 'en_route' || j.status === 'in_progress' ? 'gold' : 'blue'}`}>{j.status.replaceAll('_', ' ')}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function DispatchView({ onOpen }: { onOpen?: (id: string) => void }) {
  const os = useOs();
  const crews = os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager' || e.role === 'owner');
  const unassigned = os.jobs.filter((j) => j.status !== 'completed' && !crews.some((c) => c.name === j.detailer));
  const drop = (detailer: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('job');
    if (jobId) os.assignJob(jobId, detailer);
  };
  return (
    <div>
      {unassigned.length > 0 && (
        <div className="nsos-card" style={{ marginBottom: 12 }} onDragOver={(e) => e.preventDefault()} onDrop={drop('Unassigned')}>
          <span className="nsos-eyebrow">Unassigned</span>
          {unassigned.map((j) => (
            <div className="nsos-shift" draggable key={j.id} onDragStart={(e) => e.dataTransfer.setData('job', j.id)}>
              <strong>{j.customer}</strong>
              <div style={{ fontSize: 12, color: 'var(--os-muted)' }}>{j.service}</div>
            </div>
          ))}
        </div>
      )}
      <div className="nsos-dispatch">
        {crews.map((c) => (
          <section className="nsos-card nsos-drop" key={c.id} onDragOver={(e) => e.preventDefault()} onDrop={drop(c.name)}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <Avatar initials={c.initials} hue={c.hue} />
              <div>
                <strong>{c.name}</strong>
                <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{c.title} · {os.jobs.filter((j) => j.detailer === c.name && j.status !== 'completed').length} open</div>
              </div>
            </div>
            {os.jobs.filter((j) => j.detailer === c.name && j.status !== 'completed').map((j) => (
              <button
                className="nsos-shift"
                key={j.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('job', j.id)}
                onClick={() => onOpen?.(j.id)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <strong>{j.customer}</strong>
                <div style={{ fontSize: 12, color: 'var(--os-muted)' }}>{j.service} · {j.time}</div>
                <span className="nsos-pill gold">{j.status.replaceAll('_', ' ')}</span>
              </button>
            ))}
            {os.jobs.filter((j) => j.detailer === c.name && j.status !== 'completed').length === 0 && (
              <div className="nsos-empty" style={{ padding: 12 }}>Drop a job here</div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function D2DView({ onBook }: { onBook?: (jobId: string) => void }) {
  const os = useOs();
  const [active, setActive] = useState<string | null>(os.leads[0]?.id || null);
  const [note, setNote] = useState('');
  const [door, setDoor] = useState({ name: '', address: '' });
  const lead = os.leads.find((l) => l.id === active) || os.leads[0];
  const doors = os.leads.filter((l) => l.status !== 'new' && l.status !== 'dnk').length;
  const appts = os.leads.filter((l) => l.status === 'appointment' || l.status === 'sold').length;
  return (
    <div className="nsos-grid-2">
      <div className="nsos-map">
        {os.leads.map((l) => (
          <button
            key={l.id}
            className={`nsos-pin ${l.temp} ${l.id === lead?.id ? 'selected' : ''}`}
            style={{ left: `${l.x}%`, top: `${l.y}%` }}
            title={l.address}
            onClick={() => setActive(l.id)}
          />
        ))}
      </div>
      <div>
        <div className="nsos-kpis" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="nsos-kpi"><span>Touched</span><strong>{doors}</strong></div>
          <div className="nsos-kpi"><span>Appointments</span><strong>{appts}</strong></div>
          <div className="nsos-kpi"><span>Sold</span><strong>{os.leads.filter((l) => l.status === 'sold').length}</strong></div>
        </div>
        <form className="nsos-card" style={{ marginBottom: 10 }} onSubmit={(e) => {
          e.preventDefault();
          if (!door.name.trim() || !door.address.trim()) return;
          const id = os.addLead(door.name.trim(), door.address.trim());
          setDoor({ name: '', address: '' });
          setActive(id);
        }}>
          <span className="nsos-eyebrow">Log a door</span>
          <div className="form-row">
            <label className="nsos-field">Name<input value={door.name} onChange={(e) => setDoor({ ...door, name: e.target.value })} placeholder="Resident" /></label>
            <label className="nsos-field">Address<input value={door.address} onChange={(e) => setDoor({ ...door, address: e.target.value })} placeholder="Street" /></label>
          </div>
          <button className="nsos-btn" type="submit">Add pin</button>
        </form>
        {os.leads.map((l) => (
          <button className={`nsos-job ${l.id === lead?.id ? 'active-row' : ''}`} key={l.id} onClick={() => setActive(l.id)} style={{ width: '100%', textAlign: 'left' }}>
            <div><strong>{l.name}</strong><div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{l.address} · {l.rep}</div></div>
            <span className={`nsos-pill ${l.temp === 'hot' ? 'red' : l.temp === 'warm' ? 'gold' : 'blue'}`}>{l.status}</span>
          </button>
        ))}
      </div>
      {lead && (
        <div className="nsos-card" style={{ gridColumn: '1 / -1' }}>
          <span className="nsos-eyebrow">Pin card</span>
          <h3>{lead.name}</h3>
          <p style={{ color: 'var(--os-muted)' }}>{lead.address} · {lead.phone || 'No phone'} · {money(lead.value)}</p>
          <label className="nsos-field">Rep
            <select value={lead.rep} onChange={(e) => os.assignLead(lead.id, e.target.value)}>
              {['Unassigned', ...os.employees.filter((e) => e.role === 'd2d_agent' || e.role === 'owner').map((e) => e.name)].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <div className="nsos-actions" style={{ margin: '8px 0' }}>
            {([...LEAD_STAGES, 'dnk'] as const).map((s) => (
              <button key={s} className={`nsos-btn ${lead.status === s ? '' : 'ghost'}`} onClick={() => os.setLeadStatus(lead.id, s)}>{s}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; os.addLeadNote(lead.id, note.trim()); setNote(''); }}>
            <label className="nsos-field">Knock note
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened at the door?" />
            </label>
          </form>
          {lead.activity.map((a) => <div key={a.id} style={{ fontSize: 12, color: 'var(--os-muted)', padding: '6px 0', borderTop: '1px solid var(--os-line)' }}>{a.at} · {a.author} · {a.body}</div>)}
          <button className="nsos-btn" style={{ marginTop: 10 }} onClick={() => { const id = os.convertLead(lead.id); if (id) onBook?.(id); }}>Book this door</button>
        </div>
      )}
    </div>
  );
}

export function PipelineView({ onBook }: { onBook?: (jobId: string) => void }) {
  const os = useOs();
  const total = os.leads.filter((l) => l.status !== 'dnk').reduce((s, l) => s + l.value, 0);
  return (
    <div>
      <div className="nsos-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="nsos-kpi"><span>Open pipeline</span><strong>{money(total)}</strong></div>
        <div className="nsos-kpi"><span>Close rate</span><strong>{Math.round((os.leads.filter((l) => l.status === 'sold').length / Math.max(1, os.leads.length)) * 100)}%</strong></div>
        <div className="nsos-kpi"><span>Owned by Sofia</span><strong>{os.leads.filter((l) => l.rep.includes('Sofia')).length}</strong></div>
      </div>
      <div className="nsos-kanban">
        {LEAD_STAGES.map((s) => (
          <div
            className="nsos-col nsos-drop"
            key={s}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('lead');
              if (id) os.setLeadStatus(id, s);
            }}
          >
            <h3>{s}<span>{os.leads.filter((l) => l.status === s).length}</span></h3>
            {os.leads.filter((l) => l.status === s).map((l) => (
              <div className="nsos-lead" key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData('lead', l.id)}>
                <strong>{l.name}</strong>
                <small style={{ color: 'var(--os-muted)' }}>{l.address}</small>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                  <span>{l.rep}</span><b>{money(l.value)}</b>
                </div>
                {(s === 'appointment' || s === 'sold') && (
                  <button className="nsos-btn ghost" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={() => { const id = os.convertLead(l.id); if (id) onBook?.(id); }}>Book job</button>
                )}
              </div>
            ))}
          </div>
        ))}
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
            <Avatar initials={c.name.split(' ').map((p) => p[0]).join('').slice(0, 2)} hue="#7c6a4a" />
            <span><strong>{c.name}</strong><small>{c.vehicle}</small></span>
            {c.member && <span className="nsos-pill gold">member</span>}
          </button>
        ))}
      </div>
      <div className="nsos-card">
        <span className="nsos-eyebrow">HubSpot-style record</span>
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
            <span className="nsos-pill gold">{j.status.replaceAll('_', ' ')}</span>
          </button>
        ))}
        {pays.map((p) => (
          <div key={p.id} className="nsos-job"><span>{p.at} · {p.method}</span><b>{money(p.amount)}</b></div>
        ))}
        {customer.notes.map((n) => (
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
      <p>{job.customer.split(' ')[0]}, your {job.service} is {JOB_STEP_LABELS[idx]}.</p>
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
            <span className="nsos-avatar" style={{ width: 36, height: 36, background: '#c8a96a', fontSize: 11 }}>{detailer.slice(0, 1)}</span>
            <span>Assigned Detailer<br /><b>{detailer}</b></span>
          </div>
          <div><b>{price}</b></div>
        </div>
      </div>
      <div className="cta">VIEW APPOINTMENT</div>
      <div className="nsos-status nsos-status-light">
        {JOB_STEP_LABELS.map((s, i) => <span key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>{s}</span>)}
      </div>
      <footer>North Splash Auto Luxe · Raleigh · hello@northsplash.com · (919) 555-0100</footer>
    </div>
  );
}

export function JobDetail({ job }: { job: OsJob }) {
  const os = useOs();
  const [note, setNote] = useState('');
  const idx = stepIndex(job.status);
  const vars = {
    customer_first_name: job.customer.split(' ')[0],
    detailer_name: job.detailer.split(' ')[0],
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
        <span className="nsos-eyebrow">{job.time}</span>
        <h2>{job.service}</h2>
        <p style={{ color: 'var(--os-muted)' }}>{job.customer} · {job.vehicle}</p>
        <div className="nsos-status">
          {JOB_STEP_LABELS.map((label, i) => (
            <button
              key={label}
              className={i < idx ? 'done' : i === idx ? 'now' : ''}
              onClick={() => os.setJobStatus(job.id, JOB_STEPS[i])}
            >{label}</button>
          ))}
        </div>
        <p style={{ marginTop: 12 }}><MapPin size={14} /> {job.address}</p>
        <label className="nsos-field">Assigned detailer
          <select value={job.detailer} onChange={(e) => os.assignJob(job.id, e.target.value)}>
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
            const crew = os.chats.find((c) => c.channel_type === 'crew' || (c.kind === 'space' && c.name.toLowerCase().includes('crew')));
            if (crew) os.shareToChat(crew.id, `${job.customer} · ${job.service} is ${job.status.replaceAll('_', ' ')} at ${job.address}`);
          }}>Share to crew</button>
        </div>
      </div>
      <div className="nsos-grid-2" style={{ marginTop: 14 }}>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Job notes</span>
          <label className="nsos-field">Internal
            <textarea rows={3} value={job.internal_notes} onChange={(e) => os.setJobNotes(job.id, e.target.value)} />
          </label>
          <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; os.addJobNote(job.id, note.trim()); setNote(''); }}>
            <label className="nsos-field">Customer-visible note
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" />
            </label>
          </form>
          {job.notes?.map((n) => <div key={n.id} style={{ fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--os-line)' }}>{n.at} · {n.author}: {n.body}</div>)}
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
        {(job.comms || []).length === 0 && <p className="nsos-empty">Advance the status bar to send the matching Housecall / Uber-style templates.</p>}
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
  const rows = os.payments.filter((p) => (filter === 'all' || p.status === filter) && (method === 'all' || p.method.toLowerCase().includes(method)));
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
  const max = Math.max(...revenueDays.map((d) => d.v));
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

export function HireView({ onHire }: { onHire: (name?: string, title?: string) => void }) {
  const os = useOs();
  return (
    <div className="nsos-grid-3">
      {os.candidates.map((c) => (
        <div className="nsos-card" key={c.id}>
          <span className="nsos-eyebrow">{c.role}</span>
          <h3>{c.name}</h3>
          <p style={{ color: 'var(--os-muted)', margin: '8px 0' }}>{c.stage} · {c.email}</p>
          <div style={{ height: 6, background: '#2a2620', borderRadius: 99, marginBottom: 12 }}>
            <div style={{ width: `${c.progress}%`, height: '100%', background: 'var(--os-gold)', borderRadius: 99 }} />
          </div>
          {c.checklist?.map((item) => (
            <button key={item.id} className="nsos-check" onClick={() => os.toggleChecklist(c.id, item.id)}>
              <span className={item.done ? 'on' : ''}><Check size={12} /></span>
              {item.label}
            </button>
          ))}
          <button className="nsos-btn" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => onHire(c.name, c.role)}>Convert to employee</button>
        </div>
      ))}
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
        {page === 'payments' && <p>Square-style transactions live in Payments. Collect on the job, refund from the ledger, retry failed memberships.</p>}
        {page === 'notifications' && (
          <p>Job status changes fire enabled templates. Collect and refund now send Square-style payment messages too. Edit copy in Communications.</p>
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
    customer_first_name: liveJob.customer.split(' ')[0],
    detailer_name: liveJob.detailer.split(' ')[0],
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
      <p className="nsos-comm-lead">Housecall Pro automation + Jobber templates + Square confirmations + Uber-style day-of SMS. Status changes on a job fire these — nobody in the office has to text the customer.</p>
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

const TITLES_SAFE: Record<string, string> = {
  home: 'dashboard', schedule: 'hours', dispatch: 'dispatch', payments: 'payments',
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
    ...os.chats.filter((c) => c.name.toLowerCase().includes(query)).map((c) => ({ id: c.id, kind: 'chat' as const, title: c.name, sub: c.preview })),
    ...(['home', 'schedule', 'dispatch', 'payments', 'hire', 'comms', 'settings'] as const)
      .filter((id) => id.includes(query) || TITLES_SAFE[id].includes(query))
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
      <div className="nsos-tabs">
        {['open', 'en_route', 'arrived', 'in_progress', 'completed', 'all'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f.replaceAll('_', ' ')}</button>
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
            <span className={`nsos-pill ${j.status === 'completed' ? 'green' : 'gold'}`}>{j.status.replaceAll('_', ' ')}</span>
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
