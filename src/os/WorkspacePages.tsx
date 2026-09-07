import { useMemo, useState, type ReactNode } from 'react';
import { ACADEMY_COURSES } from '@/lib/trainingAcademy';
import { AcademyPreview } from '@/components/TrainingPortal';
import { firstWord, money, prettyLabel } from '@/lib/data';
import { srStatus } from '@/lib/salesRabbitLeads';
import { liveOpenSlots } from './appointmentSlots';
import { payLine } from './demoData';
import { useOs } from './osStore';
import { Avatar } from './views';

export const DEMO_BOARD_TABS = [
  'inventory', 'equipment', 'tasks', 'documents', 'purchasing', 'incidents', 'approvals',
  'locations', 'continuity', 'audit', 'visitors', 'pay_settings', 'permissions',
  'marketing', 'retention', 'client_photos', 'timeclock', 'time_off', 'payroll_approval',
  'training', 'notifications', 'fleet', 'availability', 'archived', 'crews',
] as const;

export type DemoBoardTab = typeof DEMO_BOARD_TABS[number];

function Kpis({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="nsos-kpis">
      {items.map((item) => (
        <div className="nsos-kpi" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
      ))}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="nsos-card nsos-board-empty">
      <h3>{title}</h3>
      <p className="empty-text">{body}</p>
    </div>
  );
}

function Row({ title, sub, meta, action }: { title: string; sub?: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="nsos-job nsos-board-row">
      <div>
        <strong>{title}</strong>
        {sub ? <div className="nsos-board-sub">{sub}</div> : null}
      </div>
      <div className="nsos-board-meta">
        {meta ? <span className="nsos-pill">{meta}</span> : null}
        {action}
      </div>
    </div>
  );
}

const STOCK = [
  { id: 'ceramic', name: 'Ceramic coating kit', bin: 'Charlotte locker', qty: 4, par: 6 },
  { id: 'compound', name: 'Paint correction compound', bin: 'Cary van', qty: 8, par: 4 },
  { id: 'interior', name: 'Interior APC / extract fluid', bin: 'Durham locker', qty: 2, par: 5 },
  { id: 'towels', name: 'Microfiber towels (50)', bin: 'Wilmington locker', qty: 11, par: 8 },
];

const ASSETS = [
  { id: 'van-a', name: 'Sprinter van · NS-1', kind: 'Vehicle', assignee: 'Marcus Hale', status: 'In field' },
  { id: 'van-b', name: 'Transit van · NS-2', kind: 'Vehicle', assignee: 'Noah Patel', status: 'Shop' },
  { id: 'extract', name: 'Extractor 900', kind: 'Tool', assignee: 'Marcus Hale', status: 'Assigned' },
  { id: 'polisher', name: 'Rupes polisher set', kind: 'Tool', assignee: 'Unassigned', status: 'Locker' },
];

const OPS_TASKS = [
  { id: 't1', title: 'Restage ceramic kits before Friday', owner: 'Avery Chen', due: 'Today', status: 'open' },
  { id: 't2', title: 'Order extractor fluid', owner: 'Noah Patel', due: 'Tomorrow', status: 'open' },
  { id: 't3', title: 'Wash NS-1 interior after last job', owner: 'Marcus Hale', due: 'Today', status: 'done' },
];

const BUYS = [
  { id: 'p1', item: 'Gtechniq Crystal Serum', vendor: 'Gtechniq', amount: 420, by: 'Marcus Hale', status: 'pending' },
  { id: 'p2', item: 'Microfiber restock', vendor: 'The Rag Company', amount: 96, by: 'Avery Chen', status: 'approved' },
];

const ISSUES = [
  { id: 'i1', title: 'Water spot on Macan hood', type: 'Quality', who: 'Marcus Hale', job: 'Priya Shah', status: 'open' },
  { id: 'i2', title: 'Late arrival · Forest Hills', type: 'Late', who: 'Marcus Hale', job: 'Matthew Renner', status: 'reviewed' },
];

const SHOPS = [
  { id: 'triangle', name: 'Triangle locker', city: 'Durham, NC', radius: '20 mi', manager: 'Jordan Miles' },
  { id: 'cary', name: 'Cary staging', city: 'Cary, NC', radius: '18 mi', manager: 'Noah Patel' },
  { id: 'charlotte', name: 'Charlotte locker', city: 'Charlotte, NC', radius: '22 mi', manager: 'Sofia Reyes' },
];

const CAMPAIGNS = [
  { id: 'm1', name: 'Neighborhood ceramic week', channel: 'D2D + SMS', budget: 800, booked: 4 },
  { id: 'm2', name: 'Member spring gloss', channel: 'Email', budget: 240, booked: 2 },
  { id: 'm3', name: 'West Charlotte doors', channel: 'Canvass', budget: 0, booked: 6 },
];

function InventoryPage() {
  const [rows, setRows] = useState(STOCK);
  const low = rows.filter((r) => r.qty < r.par).length;
  return (
    <div>
      <Kpis items={[
        { label: 'SKUs', value: String(rows.length) },
        { label: 'Below par', value: String(low) },
        { label: 'On hand', value: String(rows.reduce((s, r) => s + r.qty, 0)) },
        { label: 'Lockers', value: '3' },
      ]} />
      <div className="nsos-card">
        {rows.map((r) => (
          <Row
            key={r.id}
            title={r.name}
            sub={`${r.bin} · par ${r.par}`}
            meta={`${r.qty} on hand`}
            action={(
              <button className="nsos-btn ghost" type="button" onClick={() => setRows((p) => p.map((x) => x.id === r.id ? { ...x, qty: x.qty + 1 } : x))}>
                Restock
              </button>
            )}
          />
        ))}
      </div>
    </div>
  );
}

function EquipmentPage() {
  return (
    <div>
      <Kpis items={[
        { label: 'Assets', value: String(ASSETS.length) },
        { label: 'In field', value: String(ASSETS.filter((a) => a.status === 'In field').length) },
        { label: 'Unassigned', value: String(ASSETS.filter((a) => a.assignee === 'Unassigned').length) },
        { label: 'Vans', value: '2' },
      ]} />
      <div className="nsos-card">
        {ASSETS.map((a) => <Row key={a.id} title={a.name} sub={`${a.kind} · ${a.assignee}`} meta={a.status} />)}
      </div>
    </div>
  );
}

function TasksPage() {
  const [rows, setRows] = useState(OPS_TASKS);
  return (
    <div>
      <Kpis items={[
        { label: 'Open', value: String(rows.filter((t) => t.status === 'open').length) },
        { label: 'Done', value: String(rows.filter((t) => t.status === 'done').length) },
        { label: 'Due today', value: String(rows.filter((t) => t.due === 'Today').length) },
        { label: 'Owners', value: '3' },
      ]} />
      <div className="nsos-card">
        {rows.map((t) => (
          <Row
            key={t.id}
            title={t.title}
            sub={`${t.owner} · ${t.due}`}
            meta={t.status}
            action={t.status === 'open' ? (
              <button className="nsos-btn" type="button" onClick={() => setRows((p) => p.map((x) => x.id === t.id ? { ...x, status: 'done' } : x))}>Mark done</button>
            ) : null}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentsPage() {
  const os = useOs();
  const docs = os.employees.flatMap((e) => (e.documents || []).map((d) => ({ ...d, employee: e.name, employeeId: e.id })));
  const missing = docs.filter((d) => d.status !== 'complete').length;
  return (
    <div>
      <Kpis items={[
        { label: 'Files', value: String(docs.length) },
        { label: 'Need review', value: String(missing) },
        { label: 'People', value: String(os.employees.length) },
        { label: 'Complete', value: String(docs.filter((d) => d.status === 'complete').length) },
      ]} />
      <div className="nsos-card">
        {docs.map((d) => (
          <Row
            key={`${d.employeeId}-${d.id}`}
            title={d.name}
            sub={d.employee}
            meta={d.status}
            action={<button className="nsos-btn ghost" type="button" onClick={() => os.toggleDocument(d.employeeId, d.id)}>Toggle</button>}
          />
        ))}
      </div>
    </div>
  );
}

function PurchasingPage() {
  const [rows, setRows] = useState(BUYS);
  return (
    <div>
      <Kpis items={[
        { label: 'Open $', value: money(rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0)) },
        { label: 'Pending', value: String(rows.filter((r) => r.status === 'pending').length) },
        { label: 'Approved', value: String(rows.filter((r) => r.status === 'approved').length) },
        { label: 'Vendors', value: '2' },
      ]} />
      <div className="nsos-card">
        {rows.map((r) => (
          <Row
            key={r.id}
            title={r.item}
            sub={`${r.vendor} · ${r.by}`}
            meta={`${money(r.amount)} · ${r.status}`}
            action={r.status === 'pending' ? (
              <button className="nsos-btn" type="button" onClick={() => setRows((p) => p.map((x) => x.id === r.id ? { ...x, status: 'approved' } : x))}>Approve</button>
            ) : null}
          />
        ))}
      </div>
    </div>
  );
}

function IncidentsPage() {
  return (
    <div>
      <Kpis items={[
        { label: 'Open', value: String(ISSUES.filter((i) => i.status === 'open').length) },
        { label: 'Reviewed', value: String(ISSUES.filter((i) => i.status === 'reviewed').length) },
        { label: 'Today', value: '1' },
        { label: 'Quality', value: '1' },
      ]} />
      <div className="nsos-card">
        {ISSUES.map((i) => <Row key={i.id} title={i.title} sub={`${i.type} · ${i.who} · ${i.job}`} meta={i.status} />)}
      </div>
    </div>
  );
}

function ApprovalsPage() {
  const os = useOs();
  const pendingOff = os.timeOff.filter((t) => t.status === 'pending');
  const unpaid = os.jobs.filter((j) => j.payment === 'due' && j.status !== 'scheduled');
  return (
    <div>
      <Kpis items={[
        { label: 'Time-off', value: String(pendingOff.length) },
        { label: 'Unpaid jobs', value: String(unpaid.length) },
        { label: 'Purchases', value: String(BUYS.filter((b) => b.status === 'pending').length) },
        { label: 'Incidents', value: String(ISSUES.filter((i) => i.status === 'open').length) },
      ]} />
      <div className="nsos-grid-2">
        <section className="nsos-card">
          <span className="nsos-eyebrow">Time-off</span>
          {pendingOff.length ? pendingOff.map((t) => {
            const person = os.employees.find((e) => e.id === t.employeeId);
            return (
              <Row
                key={t.id}
                title={person?.name || 'Teammate'}
                sub={`${t.from}–${t.to} · ${t.reason}`}
                action={(
                  <div className="nsos-actions">
                    <button className="nsos-btn" type="button" onClick={() => os.setTimeOffStatus(t.id, 'approved')}>Approve</button>
                    <button className="nsos-btn ghost" type="button" onClick={() => os.setTimeOffStatus(t.id, 'denied')}>Deny</button>
                  </div>
                )}
              />
            );
          }) : <p className="empty-text">No time-off waiting.</p>}
        </section>
        <section className="nsos-card">
          <span className="nsos-eyebrow">Unpaid jobs</span>
          {unpaid.length ? unpaid.map((j) => (
            <Row key={j.id} title={j.customer} sub={j.service} meta={money(j.price)} action={<button className="nsos-btn" type="button" onClick={() => os.collectJob(j.id)}>Collect</button>} />
          )) : <p className="empty-text">Nothing to collect.</p>}
        </section>
      </div>
    </div>
  );
}

function LocationsPage() {
  const os = useOs();
  return (
    <div>
      <Kpis items={[
        { label: 'Shops', value: String(SHOPS.length) },
        { label: 'Team', value: String(os.employees.filter((e) => e.status === 'active').length) },
        { label: 'Market', value: os.settings.market },
        { label: 'Phone', value: os.settings.phone },
      ]} />
      <div className="nsos-card">
        {SHOPS.map((s) => {
          const n = os.employees.filter((e) => e.location === s.city.split(',')[0]).length;
          return <Row key={s.id} title={s.name} sub={`${s.city} · ${s.manager} · ${s.radius}`} meta={`${n} people`} />;
        })}
      </div>
    </div>
  );
}

function ContinuityPage() {
  const os = useOs();
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({
      employees: os.employees.length,
      jobs: os.jobs.length,
      customers: os.customers.length,
      leads: os.leads.length,
      payments: os.payments.length,
      exported_at: new Date().toISOString(),
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'north-splash-demo-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="nsos-grid-2">
      <section className="nsos-card">
        <span className="nsos-eyebrow">This browser</span>
        <h3>Demo workspace backup</h3>
        <p className="os-page-lead">Employees, jobs, chats, and payments live in this browser until you reset them.</p>
        <div className="nsos-actions" style={{ marginTop: 12 }}>
          <button className="nsos-btn" type="button" onClick={exportJson}>Download snapshot</button>
          <button className="nsos-btn danger" type="button" onClick={os.resetDemo}>Reset demo data</button>
        </div>
      </section>
      <section className="nsos-card">
        <span className="nsos-eyebrow">Live Owner</span>
        <h3>Supabase is the source of truth</h3>
        <p className="os-page-lead">Sign in at /login for the live company. This cream OS is a working preview, not a second database.</p>
      </section>
    </div>
  );
}

function AuditPage() {
  const os = useOs();
  return (
    <div>
      <Kpis items={[
        { label: 'Events', value: String(os.activity.length) },
        { label: 'Hires', value: String(os.activity.filter((a) => a.kind === 'hire').length) },
        { label: 'Pay', value: String(os.activity.filter((a) => a.kind === 'pay').length) },
        { label: 'Ops', value: String(os.activity.filter((a) => a.kind === 'ops').length) },
      ]} />
      <div className="nsos-card">
        {os.activity.length ? os.activity.map((a) => (
          <Row key={a.id} title={a.text} sub={a.at} meta={prettyLabel(a.kind || 'event')} />
        )) : <Empty title="No audit events yet" body="Hires, payments, and job moves land here." />}
      </div>
    </div>
  );
}

function VisitorsPage() {
  return (
    <div>
      <Kpis items={[
        { label: 'Today', value: '48' },
        { label: 'Sessions', value: '31' },
        { label: 'Direct', value: '18' },
        { label: 'Mobile', value: '22' },
      ]} />
      <div className="nsos-card">
        <Row title="/" sub="Marketing site" meta="19 views" />
        <Row title="/book" sub="Booking flow" meta="11 views" />
        <Row title="/login" sub="Owner / field sign-in" meta="8 views" />
        <p className="empty-text" style={{ marginTop: 12 }}>Live traffic lands on Owner → Site Visitors when Supabase is connected. These counts are demo traffic for the cream OS.</p>
      </div>
    </div>
  );
}

function PaySettingsPage() {
  const os = useOs();
  return (
    <div>
      <Kpis items={[
        { label: 'Plans', value: String(new Set(os.employees.map((e) => e.pay_type)).size) },
        { label: 'Hourly', value: String(os.employees.filter((e) => e.hourly_rate > 0).length) },
        { label: 'Salary', value: String(os.employees.filter((e) => e.annual_salary > 0).length) },
        { label: 'Commission', value: String(os.employees.filter((e) => e.commission_rate > 0).length) },
      ]} />
      <div className="nsos-card">
        {os.employees.map((e) => (
          <Row key={e.id} title={e.name} sub={`${e.title} · ${prettyLabel(e.pay_type)} · ${e.pay_schedule}`} meta={payLine(e)} />
        ))}
      </div>
    </div>
  );
}

function PermissionsPage() {
  const os = useOs();
  const portals = ['Owner', 'Admin', 'D2D', 'Detail', 'Finance'] as const;
  const access: Record<string, readonly boolean[]> = {
    owner: [true, true, true, true, true],
    admin: [false, true, true, true, true],
    manager: [false, true, true, true, true],
    d2d_agent: [false, false, true, false, false],
    detailer: [false, false, false, true, false],
    office: [false, true, false, false, false],
  };
  return (
    <div>
      <p className="os-page-lead" style={{ marginBottom: 14 }}>Who can open Owner, People, Finance, and field modes. Pay is never locked to a role.</p>
      <div className="nsos-card nsos-perm-table">
        <div className="nsos-board-row nsos-perm-head">
          <strong>Person</strong>
          {portals.map((p) => <span key={p}>{p}</span>)}
        </div>
        {os.employees.map((e) => {
          const row = access[e.role] || access.office;
          return (
            <div className="nsos-board-row nsos-perm-row" key={e.id}>
              <div>
                <strong>{e.name}</strong>
                <div className="nsos-board-sub">{prettyLabel(e.role)}</div>
              </div>
              {row.map((on, i) => <span key={portals[i]} className={on ? 'nsos-pill gold' : 'nsos-pill'}>{on ? 'Open' : '—'}</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketingPage() {
  const os = useOs();
  const booked = os.leads.filter((l) => ['appointment_set', 'sold', 'customer'].includes(srStatus(l.status).key)).length;
  return (
    <div>
      <Kpis items={[
        { label: 'Campaigns', value: String(CAMPAIGNS.length) },
        { label: 'Booked from them', value: String(booked) },
        { label: 'Spend', value: money(CAMPAIGNS.reduce((s, c) => s + c.budget, 0)) },
        { label: 'Open doors', value: String(os.leads.filter((l) => !['do_not_knock', 'sold', 'customer', 'not_interested'].includes(srStatus(l.status).key)).length) },
      ]} />
      <div className="nsos-card">
        {CAMPAIGNS.map((c) => <Row key={c.id} title={c.name} sub={c.channel} meta={`${money(c.budget)} · ${c.booked} booked`} />)}
      </div>
    </div>
  );
}

function RetentionPage() {
  const os = useOs();
  const done = os.jobs.filter((j) => j.status === 'completed');
  const members = os.customers.filter((c) => c.member);
  return (
    <div>
      <Kpis items={[
        { label: 'Due in 30 days', value: String(done.length) },
        { label: 'Members', value: String(members.length) },
        { label: 'Households', value: String(os.customers.length) },
        { label: 'Hot leads', value: String(os.leads.filter((l) => l.temp === 'hot' && srStatus(l.status).key !== 'sold').length) },
      ]} />
      <div className="nsos-card">
        {done.length ? done.map((j) => (
          <Row key={j.id} title={j.customer} sub={`${j.service} · ${j.time}`} meta="Ask to rebook" />
        )) : <Empty title="No completed jobs yet" body="Finished details become 30-day follow-ups here." />}
      </div>
    </div>
  );
}

function PhotosPage() {
  const os = useOs();
  const tiles = os.jobs.flatMap((j) => (j.photos || []).map((p) => ({ ...p, jobId: j.id, customer: j.customer, vehicle: j.vehicle, service: j.service })));
  const job = os.jobs.find((j) => j.status === 'completed') || os.jobs[0];
  return (
    <div>
      <Kpis items={[
        { label: 'Shots', value: String(tiles.length) },
        { label: 'Before', value: String(tiles.filter((t) => t.kind === 'before').length) },
        { label: 'After', value: String(tiles.filter((t) => t.kind === 'after').length) },
        { label: 'Jobs', value: String(new Set(tiles.map((t) => t.jobId)).size) },
      ]} />
      {job && (
        <div className="nsos-actions" style={{ marginBottom: 12 }}>
          <button className="nsos-btn" type="button" onClick={() => os.addJobPhoto(job.id, 'before')}>Add before</button>
          <button className="nsos-btn ghost" type="button" onClick={() => os.addJobPhoto(job.id, 'after')}>Add after</button>
        </div>
      )}
      {tiles.length ? (
        <div className="nsos-photo-grid">
          {tiles.map((t) => (
            <figure className="nsos-photo-tile" key={t.id}>
              <img src={t.src} alt="" />
              <figcaption>
                <strong>{t.customer}</strong>
                <small>{t.label} · {t.service}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty title="No client photos yet" body="Add a before or after from a completed job." />}
    </div>
  );
}

function TimeClockPage() {
  const os = useOs();
  const live = os.jobs.filter((j) => j.status === 'en_route' || j.status === 'arrived' || j.status === 'in_progress');
  const clocked = os.employees.filter((e) => live.some((j) => j.detailer === e.name));
  return (
    <div>
      <Kpis items={[
        { label: 'On the clock', value: String(clocked.length) },
        { label: 'Hours this week', value: String(os.employees.reduce((s, e) => s + e.hours_week, 0)) },
        { label: 'In field', value: String(live.length) },
        { label: 'Off clock', value: String(os.employees.filter((e) => e.status === 'active').length - clocked.length) },
      ]} />
      <div className="nsos-card">
        {os.employees.filter((e) => e.status !== 'inactive').map((e) => {
          const on = clocked.some((c) => c.id === e.id);
          return <Row key={e.id} title={e.name} sub={`${e.title} · ${e.hours_week}h week`} meta={on ? 'Clocked in' : 'Off clock'} />;
        })}
      </div>
    </div>
  );
}

function TimeOffPage() {
  const os = useOs();
  const [bench, setBench] = useState(os.employees.find((e) => e.status === 'active')?.id || '');
  return (
    <div>
      <Kpis items={[
        { label: 'Pending', value: String(os.timeOff.filter((t) => t.status === 'pending').length) },
        { label: 'Approved', value: String(os.timeOff.filter((t) => t.status === 'approved').length) },
        { label: 'Denied', value: String(os.timeOff.filter((t) => t.status === 'denied').length) },
        { label: 'Requests', value: String(os.timeOff.length) },
      ]} />
      <div className="nsos-actions" style={{ marginBottom: 12 }}>
        <select className="nsos-select" value={bench} onChange={(e) => setBench(e.target.value)}>
          {os.employees.filter((e) => e.status !== 'inactive').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="nsos-btn" type="button" onClick={() => bench && os.requestTimeOff(bench, 'Personal day')}>Request time-off</button>
      </div>
      <div className="nsos-card">
        {os.timeOff.map((t) => {
          const person = os.employees.find((e) => e.id === t.employeeId);
          return (
            <Row
              key={t.id}
              title={person?.name || 'Teammate'}
              sub={`${t.from}–${t.to} · ${t.reason}`}
              meta={t.status}
              action={t.status === 'pending' ? (
                <div className="nsos-actions">
                  <button className="nsos-btn" type="button" onClick={() => os.setTimeOffStatus(t.id, 'approved')}>Approve</button>
                  <button className="nsos-btn ghost" type="button" onClick={() => os.setTimeOffStatus(t.id, 'denied')}>Deny</button>
                </div>
              ) : null}
            />
          );
        })}
        {!os.timeOff.length && <Empty title="No time-off yet" body="Request a day for the person on the bench." />}
      </div>
    </div>
  );
}

function TimesheetPage() {
  const os = useOs();
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const field = os.employees.filter((e) => e.role === 'detailer' || e.role === 'd2d_agent' || e.role === 'manager');
  return (
    <div>
      <Kpis items={[
        { label: 'Cards', value: String(field.length) },
        { label: 'Approved', value: String(Object.values(ok).filter(Boolean).length) },
        { label: 'Hours', value: String(field.reduce((s, e) => s + e.hours_week, 0)) },
        { label: 'Cutoff', value: 'Friday' },
      ]} />
      <div className="nsos-card">
        {field.map((e) => (
          <Row
            key={e.id}
            title={e.name}
            sub={`${e.hours_week}h · ${payLine(e)}`}
            meta={ok[e.id] ? 'approved' : 'needs review'}
            action={!ok[e.id] ? (
              <button className="nsos-btn" type="button" onClick={() => setOk((p) => ({ ...p, [e.id]: true }))}>Approve</button>
            ) : null}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingPage() {
  const os = useOs();
  const [preview, setPreview] = useState<'d2d' | 'detail' | null>(null);
  const d2d = os.employees.filter((e) => e.role === 'd2d_agent' && e.status === 'active');
  const detail = os.employees.filter((e) => e.role === 'detailer' && e.status === 'active');
  if (preview) {
    return (
      <div>
        <button type="button" className="nsos-btn" style={{ marginBottom: 14 }} onClick={() => setPreview(null)}>← Academy roster</button>
        <AcademyPreview track={preview} />
      </div>
    );
  }
  return (
    <div>
      <Kpis items={[
        { label: 'Courses', value: String(ACADEMY_COURSES.length) },
        { label: 'D2D assigned', value: String(d2d.length) },
        { label: 'Detail assigned', value: String(detail.length) },
        { label: 'Packets open', value: String(os.employees.filter((e) => e.onboarding < 100).length) },
      ]} />
      <div className="nsos-grid-2">
        {ACADEMY_COURSES.map((c) => (
          <section className="nsos-card" key={c.id}>
            <span className="nsos-eyebrow">{c.track === 'd2d' ? 'Door-to-door' : 'Detailing'}</span>
            <h3>{c.title}</h3>
            <p className="os-page-lead">{c.description}</p>
            <p style={{ margin: '10px 0 8px', fontSize: 13 }}>{c.lessons.length} lessons · {c.drills.length} drills · {c.questions.length} quiz · {c.duration_minutes} min · pass {c.passing_score}%</p>
            <ol className="academy-owner-lessons">
              {c.lessons.map((l) => <li key={l.id}>{l.title}</li>)}
            </ol>
            <button type="button" className="nsos-btn" style={{ marginTop: 12 }} onClick={() => setPreview(c.track)}>Open {c.track === 'd2d' ? 'D2D' : 'detailer'} academy</button>
            {(c.track === 'd2d' ? d2d : detail).map((e) => (
              <div className="nsos-job" key={e.id}>
                <span>{e.name}</span>
                <span className="nsos-pill">{e.onboarding < 100 ? `${e.onboarding}% packet` : 'Assigned'}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function NotificationsPage() {
  const os = useOs();
  const enabled = os.templates.filter((t) => t.is_enabled).length;
  return (
    <div>
      <Kpis items={[
        { label: 'Alerts', value: String(os.activity.length) },
        { label: 'Templates on', value: String(enabled) },
        { label: 'Unread chats', value: String(os.chats.reduce((s, c) => s + (c.unread || 0), 0)) },
        { label: 'Unassigned', value: String(os.jobs.filter((j) => !j.detailer && j.status !== 'completed').length) },
      ]} />
      <div className="nsos-card">
        {os.activity.slice(0, 12).map((a) => <Row key={a.id} title={a.text} sub={a.at} meta={prettyLabel(a.kind || 'alert')} />)}
        {!os.activity.length && <Empty title="No alerts yet" body="Job moves, hires, and payments appear here." />}
      </div>
    </div>
  );
}

function FleetPage({ onOpenJob }: { onOpenJob?: (id: string) => void }) {
  const os = useOs();
  const fleets = os.customers.filter((c) => c.member);
  return (
    <div>
      <Kpis items={[
        { label: 'Fleet accounts', value: String(fleets.length) },
        { label: 'Members', value: String(fleets.length) },
        { label: 'Households', value: String(os.customers.length) },
        { label: 'Open jobs', value: String(os.jobs.filter((j) => j.status !== 'completed').length) },
      ]} />
      {fleets.length ? fleets.map((c) => {
        const jobs = os.jobs.filter((j) => j.customer === c.name);
        return (
          <section className="nsos-card" key={c.id} style={{ marginBottom: 12 }}>
            <span className="nsos-eyebrow">Luxe member</span>
            <h3>{c.name}</h3>
            <p className="os-page-lead">{c.vehicle} · {c.address}</p>
            {jobs.map((j) => (
              <button key={j.id} className="nsos-job" type="button" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenJob?.(j.id)}>
                <span>{j.time} · {j.service}</span>
                <span className="nsos-pill gold">{prettyLabel(j.status)}</span>
              </button>
            ))}
            {!jobs.length && <p className="empty-text">No jobs on this account yet.</p>}
          </section>
        );
      }) : <Empty title="No fleet accounts yet" body="Turn on membership from a customer record to treat them as a fleet account." />}
    </div>
  );
}

function AvailabilityPage() {
  const os = useOs();
  const slots = liveOpenSlots(os.jobs, os.employees, 12);
  return (
    <div>
      <Kpis items={[
        { label: 'Open slots', value: String(slots.length) },
        { label: 'Techs available', value: String(os.employees.filter((e) => e.role === 'detailer' && e.status === 'active').length) },
        { label: 'Booked today', value: String(os.jobs.filter((j) => String(j.time || '').includes('Today')).length) },
        { label: 'Unassigned', value: String(os.jobs.filter((j) => !j.detailer && j.status !== 'completed').length) },
      ]} />
      <div className="nsos-card">
        {slots.map((s) => <Row key={s.id} title={s.window} sub={s.tech} meta="Open" />)}
        {!slots.length && <Empty title="No open windows" body="Every tech window on the board is already booked." />}
      </div>
    </div>
  );
}

function ArchivedPage({ onOpenJob }: { onOpenJob?: (id: string) => void }) {
  const os = useOs();
  const done = os.jobs.filter((j) => j.status === 'completed');
  return (
    <div>
      <Kpis items={[
        { label: 'Completed', value: String(done.length) },
        { label: 'Collected', value: money(done.filter((j) => j.payment === 'paid').reduce((s, j) => s + j.price, 0)) },
        { label: 'Photos', value: String(done.reduce((s, j) => s + (j.photos?.length || 0), 0)) },
        { label: 'History', value: String(os.jobs.length) },
      ]} />
      <div className="nsos-card">
        {done.length ? done.map((j) => (
          <button key={j.id} className="nsos-job" type="button" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenJob?.(j.id)}>
            <span><strong>{j.customer}</strong><div className="nsos-board-sub">{j.service} · {j.time}</div></span>
            <span className="nsos-pill gold">{money(j.price)}</span>
          </button>
        )) : <Empty title="No archived details" body="Completed jobs stay here for history and photos." />}
      </div>
    </div>
  );
}

function CrewsPage({ onOpenJob }: { onOpenJob?: (id: string) => void }) {
  const os = useOs();
  const groups = useMemo(() => {
    const map = new Map<string, typeof os.employees>();
    os.employees.filter((e) => e.role === 'detailer' || e.role === 'manager' || e.role === 'owner').forEach((e) => {
      const key = e.location || 'Unassigned';
      map.set(key, [...(map.get(key) || []), e]);
    });
    return [...map.entries()];
  }, [os.employees]);
  const today = os.jobs.filter((j) => String(j.time || '').includes('Today') && j.status !== 'completed');
  return (
    <div>
      <Kpis items={[
        { label: 'Crews', value: String(groups.length) },
        { label: 'Techs', value: String(os.employees.filter((e) => e.role === 'detailer').length) },
        { label: 'Today', value: String(today.length) },
        { label: 'Unassigned', value: String(today.filter((j) => !j.detailer).length) },
      ]} />
      <div className="nsos-grid-2">
        {groups.map(([loc, people]) => (
          <section className="nsos-card" key={loc}>
            <span className="nsos-eyebrow">{loc}</span>
            <h3>{loc} crew</h3>
            {people.map((e) => (
              <div className="nsos-job" key={e.id}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar initials={e.initials} hue={e.hue} photo={e.photo} size={32} />
                  <span><strong>{e.name}</strong><div className="nsos-board-sub">{e.title}</div></span>
                </span>
                <span className="nsos-pill">{firstWord(e.role)}</span>
              </div>
            ))}
            {today.filter((j) => people.some((p) => p.name === j.detailer)).map((j) => (
              <button key={j.id} className="nsos-job" type="button" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenJob?.(j.id)}>
                <span>{j.time} · {j.customer}</span>
                <span className="nsos-pill gold">{prettyLabel(j.status)}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function DemoWorkspacePage({ tab, onOpenJob }: { tab: DemoBoardTab; onOpenJob?: (id: string) => void }) {
  switch (tab) {
    case 'inventory': return <InventoryPage />;
    case 'equipment': return <EquipmentPage />;
    case 'tasks': return <TasksPage />;
    case 'documents': return <DocumentsPage />;
    case 'purchasing': return <PurchasingPage />;
    case 'incidents': return <IncidentsPage />;
    case 'approvals': return <ApprovalsPage />;
    case 'locations': return <LocationsPage />;
    case 'continuity': return <ContinuityPage />;
    case 'audit': return <AuditPage />;
    case 'visitors': return <VisitorsPage />;
    case 'pay_settings': return <PaySettingsPage />;
    case 'permissions': return <PermissionsPage />;
    case 'marketing': return <MarketingPage />;
    case 'retention': return <RetentionPage />;
    case 'client_photos': return <PhotosPage />;
    case 'timeclock': return <TimeClockPage />;
    case 'time_off': return <TimeOffPage />;
    case 'payroll_approval': return <TimesheetPage />;
    case 'training': return <TrainingPage />;
    case 'notifications': return <NotificationsPage />;
    case 'fleet': return <FleetPage onOpenJob={onOpenJob} />;
    case 'availability': return <AvailabilityPage />;
    case 'archived': return <ArchivedPage onOpenJob={onOpenJob} />;
    case 'crews': return <CrewsPage onOpenJob={onOpenJob} />;
    default: return <Empty title="Missing page" body="This workspace item is listed but not wired yet." />;
  }
}
