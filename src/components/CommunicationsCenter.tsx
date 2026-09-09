import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { CheckCircle2, ChevronRight, Eye, Mail, Save, Send, Smartphone, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/AppToast';
import CustomerEmail from '@/components/CustomerEmail';
import { fillMerge, withEmailAliases } from '@/lib/emailLayout';
import { COMM_VARIABLES } from '@/lib/communicationCatalog';

const GROUPS = [
  ['appointments', 'Appointment notifications'],
  ['field', 'Day-of-service updates'],
  ['payments', 'Payments'],
  ['retention', 'Customer retention'],
  ['other', 'Other'],
] as const;

const SAMPLE = withEmailAliases({
  customer_first_name: 'Matthew',
  customer_name: 'Matthew Renner',
  detailer_name: 'Marcus Hale',
  employee_name: 'Marcus Hale',
  vehicle: '2022 BMW 330i',
  service: 'Luxe Signature',
  appointment_time: 'Saturday, September 12 · 10:30 AM',
  appointment_date: 'Saturday, September 12',
  price: '$275.00',
  eta: '10:42 AM',
  address: '412 Forest Hills Dr, Durham NC',
  portal_link: 'https://ns-auto-luxe-os.vercel.app/portal',
});

function prettyEvent(value?: string | null) {
  return String(value || '').replaceAll('_', ' ') || 'Automation';
}

function when(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

type Props = {
  Header: ComponentType<{ tab: string; action?: ReactNode }>;
};

export default function CommunicationsCenter({ Header }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [preview, setPreview] = useState<'email' | 'sms' | 'none'>('none');
  const [filter, setFilter] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = async (keepId?: string) => {
    const [t, l] = await Promise.all([
      supabase.from('communication_templates').select('*').order('category').order('send_delay_minutes'),
      supabase.from('communication_logs').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (t.error) {
      setLoadError(t.error.message);
      return;
    }
    setLoadError('');
    const rows = t.data ?? [];
    setTemplates(rows);
    setLogs(l.data ?? []);
    setSelected((cur: any) => {
      const id = keepId || cur?.id;
      const next = rows.find((row) => row.id === id) || rows[0] || null;
      return next ? { ...next } : null;
    });
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const payload = {
      subject: selected.subject,
      body: selected.body,
      sms_body: selected.sms_body || '',
      is_enabled: selected.is_enabled,
      email_enabled: selected.email_enabled !== false,
      sms_enabled: Boolean(selected.sms_enabled),
      from_email: selected.from_email,
      send_delay_minutes: Number(selected.send_delay_minutes || 0),
      category: selected.category || 'appointments',
      timing_label: selected.timing_label || '',
    };
    const { error } = await supabase.from('communication_templates').update(payload).eq('id', selected.id);
    setSaving(false);
    if (error) {
      showToast('Could not save', error.message);
      return;
    }
    await load(selected.id);
    showToast('Automation saved', selected.name || prettyEvent(selected.event_key));
  };

  const test = async () => {
    if (!selected) return;
    const inbox = testEmail.trim();
    if (!inbox) {
      showToast('Add a test inbox', 'Type the email that should receive this message.');
      return;
    }
    if (selected.email_enabled === false) {
      showToast('Email is off', 'Turn Email on for this automation, then send the test.');
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('send-communication', {
      body: {
        event_key: selected.event_key,
        recipient_email: inbox,
        variables: SAMPLE,
      },
    });
    setTesting(false);
    if (error) {
      showToast('Test did not send', error.message || 'SendGrid or the function rejected the message.');
      return;
    }
    if (data?.skipped) {
      showToast('Template skipped', data.reason || 'Email is disabled for this event.');
      return;
    }
    if (!data?.success) {
      showToast('Test did not send', data?.error || 'The message was not accepted.');
      return;
    }
    showToast('Test email sent', inbox);
    await load(selected.id);
  };

  const filtered = filter === 'all' ? templates : templates.filter((t) => (t.category || 'other') === filter);
  const sent = logs.filter((l) => l.status === 'sent').length;
  const failed = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="tab-content phase300 communications-v25">
      <Header tab="communications" action={<div className="comm-provider-status"><span className="on"><CheckCircle2 size={14} />SendGrid Email</span><span><Smartphone size={14} />SMS ready for provider</span></div>} />
      {loadError && <div className="ns-empty" role="alert"><strong>Templates did not load</strong><p>{loadError}</p></div>}
      <div className="comm-lifecycle-v25">{['Booked', 'Confirmed', 'Reminder', 'Assigned', 'En Route', 'Arrived', 'In Progress', 'Complete', 'Paid', 'Review'].map((x, i) => <div key={x}><span>{i + 1}</span><small>{x}</small></div>)}</div>
      <div className="comm-filter-v25">
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        {GROUPS.slice(0, -1).map(([id, label]) => (
          <button type="button" key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <div className="comm-layout comm-layout-v25">
        <aside className="comm-template-list comm-template-list-v25">
          {GROUPS.map(([gid, title]) => {
            const rows = filtered.filter((t) => (t.category || 'other') === gid);
            if (!rows.length) return null;
            return (
              <section key={gid}>
                <div className="comm-group-title">{title}<span>{rows.length}</span></div>
                {rows.map((t) => (
                  <button type="button" className={selected?.id === t.id ? 'selected' : ''} key={t.id} onClick={() => setSelected({ ...t })}>
                    <span className={`comm-dot ${t.is_enabled ? 'on' : ''}`} />
                    <span>
                      <strong>{t.name || prettyEvent(t.event_key)}</strong>
                      <small>{t.timing_label || `${Number(t.send_delay_minutes || 0)} min`} · {t.email_enabled !== false ? 'Email' : ''}{t.email_enabled !== false && t.sms_enabled ? ' + ' : ''}{t.sms_enabled ? 'SMS' : ''}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </section>
            );
          })}
        </aside>
        <main className="comm-editor comm-editor-v25">
          {selected ? (
            <div className="phase-panel">
              <div className="phase-panel-head">
                <div>
                  <span className="eyebrow">{selected.category || 'AUTOMATION'} / {selected.event_key}</span>
                  <h3>{selected.name || prettyEvent(selected.event_key)}</h3>
                </div>
                <label className="toggle-line">
                  <input type="checkbox" checked={Boolean(selected.is_enabled)} onChange={(e) => setSelected((p: any) => ({ ...p, is_enabled: e.target.checked }))} />
                  Enabled
                </label>
              </div>
              <div className="comm-channel-switches">
                <label><input type="checkbox" checked={selected.email_enabled !== false} onChange={(e) => setSelected((p: any) => ({ ...p, email_enabled: e.target.checked }))} /><Mail size={15} />Email</label>
                <label><input type="checkbox" checked={Boolean(selected.sms_enabled)} onChange={(e) => setSelected((p: any) => ({ ...p, sms_enabled: e.target.checked }))} /><Smartphone size={15} />SMS</label>
              </div>
              <div className="form-row">
                <label>Timing label<input value={selected.timing_label || ''} onChange={(e) => setSelected((p: any) => ({ ...p, timing_label: e.target.value }))} placeholder="24 hours before" /></label>
                <label>Delay / offset minutes<input type="number" value={Number(selected.send_delay_minutes || 0)} onChange={(e) => setSelected((p: any) => ({ ...p, send_delay_minutes: Number(e.target.value) }))} /></label>
              </div>
              <label>From<input value={selected.from_email || 'appointments@northsplash.com'} onChange={(e) => setSelected((p: any) => ({ ...p, from_email: e.target.value }))} /></label>
              <label>Email subject<input value={selected.subject || ''} onChange={(e) => setSelected((p: any) => ({ ...p, subject: e.target.value }))} /></label>
              <label>Email message<textarea rows={9} value={selected.body || ''} onChange={(e) => setSelected((p: any) => ({ ...p, body: e.target.value }))} /></label>
              <label>SMS message<textarea rows={4} maxLength={500} value={selected.sms_body || ''} onChange={(e) => setSelected((p: any) => ({ ...p, sms_body: e.target.value }))} placeholder="North Splash: Your detailer is on the way. ETA {eta}." /><small>{String(selected.sms_body || '').length}/500</small></label>
              <div className="comm-variable-bank">
                <span>Insert</span>
                {COMM_VARIABLES.map((v) => (
                  <button type="button" key={v} onClick={() => setSelected((p: any) => ({ ...p, body: `${p.body || ''}${p.body ? ' ' : ''}${v}` }))}>{v}</button>
                ))}
              </div>
              <div className="comm-actions comm-actions-v25">
                <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save automation'}</button>
                <button type="button" className="btn-outline" onClick={() => setPreview('email')}><Eye size={15} />Preview email</button>
                <button type="button" className="btn-outline" onClick={() => setPreview('sms')}><Smartphone size={15} />Preview SMS</button>
                <input type="email" placeholder="Test recipient email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                <button type="button" className="btn-outline" onClick={() => void test()} disabled={testing}><Send size={15} />{testing ? 'Sending…' : 'Send test'}</button>
              </div>
            </div>
          ) : (
            <div className="empty-inspector"><Mail size={40} /><h3>Select an automation</h3><p>Pick a template to edit copy, channels, and send a test to a real inbox.</p></div>
          )}
        </main>
      </div>
      <section className="phase-panel comm-log comm-log-v25">
        <div className="phase-panel-head">
          <div><span className="eyebrow">DELIVERY HEALTH</span><h3>Recent email activity</h3></div>
          <span>{sent} sent · {failed} failed</span>
        </div>
        {!logs.length && <div className="ns-empty">No messages logged yet. Send a test to confirm SendGrid.</div>}
        {logs.slice(0, 100).map((l) => (
          <div className="comm-log-row" key={l.id}>
            <span className={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'danger' : 'warning'}>{l.status}</span>
            <strong>{l.event_key || l.template_key}</strong>
            <span>{l.recipient_email || '—'}</span>
            <small>{l.error_message ? l.error_message : when(l.created_at)}</small>
          </div>
        ))}
      </section>
      {preview !== 'none' && selected && (
        <div className="comm-preview-backdrop" onClick={() => setPreview('none')}>
          <div className={`comm-preview-modal ${preview}`} onClick={(e) => e.stopPropagation()}>
            <header>
              <div><span className="eyebrow">PREVIEW</span><h3>{preview === 'email' ? 'Customer email' : 'Customer SMS'}</h3></div>
              <button type="button" onClick={() => setPreview('none')}><XCircle size={18} /></button>
            </header>
            {preview === 'email' ? (
              <CustomerEmail
                subject={selected.subject || 'Your North Splash appointment'}
                body={selected.body || ''}
                eventKey={selected.event_key}
                vars={SAMPLE}
                detailerName={SAMPLE.detailer_name}
              />
            ) : (
              <div className="sms-phone-v25">
                <div className="sms-notch" />
                <div className="sms-thread-title">North Splash Auto Luxe</div>
                <div className="sms-bubble">{fillMerge(selected.sms_body || 'North Splash: Your appointment update is ready. {portal_link}', SAMPLE)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
