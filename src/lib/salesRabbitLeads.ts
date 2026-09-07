/** SalesRabbit lead record + status-pin catalog. One source for OS demo and live D2D. */

export type SrStatusKey =
  | 'unworked'
  | 'no_answer'
  | 'revisit'
  | 'contacted'
  | 'interested'
  | 'not_interested'
  | 'follow_up'
  | 'estimate'
  | 'appointment_set'
  | 'sold'
  | 'customer'
  | 'do_not_knock'
  | 'cancelled'
  | 'lost';

export type OsLeadStatus =
  | 'new'
  | 'knocked'
  | 'revisit'
  | 'interested'
  | 'not_interested'
  | 'follow_up'
  | 'appointment'
  | 'sold'
  | 'dnk';

export type SrStatus = {
  key: SrStatusKey;
  os: OsLeadStatus;
  name: string;
  abbr: string;
  color: string;
  order: number;
  priority: number;
  knock: boolean;
  pipeline: boolean;
};

/** Pin statuses as SalesRabbit models them: name, abbreviation, color, order. */
export const SR_STATUSES: SrStatus[] = [
  { key: 'unworked', os: 'new', name: 'New Lead', abbr: 'NL', color: '#3498db', order: 1, priority: 30, knock: false, pipeline: true },
  { key: 'no_answer', os: 'knocked', name: 'Not Home', abbr: 'NH', color: '#f39c12', order: 2, priority: 90, knock: true, pipeline: true },
  { key: 'revisit', os: 'revisit', name: 'Go Back', abbr: 'GB', color: '#e67e22', order: 3, priority: 100, knock: true, pipeline: true },
  { key: 'contacted', os: 'knocked', name: 'Contacted', abbr: 'CON', color: '#7f8c8d', order: 4, priority: 60, knock: false, pipeline: false },
  { key: 'interested', os: 'interested', name: 'Interested', abbr: 'INT', color: '#27ae60', order: 5, priority: 120, knock: true, pipeline: true },
  { key: 'not_interested', os: 'not_interested', name: 'Not Interested', abbr: 'NI', color: '#e74c3c', order: 6, priority: 10, knock: true, pipeline: false },
  { key: 'follow_up', os: 'follow_up', name: 'Callback', abbr: 'CB', color: '#1abc9c', order: 7, priority: 140, knock: true, pipeline: true },
  { key: 'estimate', os: 'interested', name: 'Estimate', abbr: 'EST', color: '#8e44ad', order: 8, priority: 150, knock: true, pipeline: true },
  { key: 'appointment_set', os: 'appointment', name: 'Appointment Set', abbr: 'APPT', color: '#9b59b6', order: 9, priority: 160, knock: true, pipeline: true },
  { key: 'sold', os: 'sold', name: 'Sold', abbr: 'SLD', color: '#16a085', order: 10, priority: 170, knock: true, pipeline: true },
  { key: 'customer', os: 'sold', name: 'Customer', abbr: 'CST', color: '#1e8449', order: 11, priority: 175, knock: false, pipeline: false },
  { key: 'do_not_knock', os: 'dnk', name: 'Do Not Contact', abbr: 'DNC', color: '#2c3e50', order: 12, priority: 0, knock: true, pipeline: false },
  { key: 'cancelled', os: 'not_interested', name: 'Cancelled', abbr: 'CAN', color: '#c0392b', order: 13, priority: 20, knock: false, pipeline: false },
  { key: 'lost', os: 'not_interested', name: 'Lost', abbr: 'LST', color: '#922b21', order: 14, priority: 15, knock: false, pipeline: false },
];

export const SR_KNOCK_KEYS = SR_STATUSES.filter((s) => s.knock).map((s) => s.key);
export const SR_PIPELINE_KEYS = SR_STATUSES.filter((s) => s.pipeline).map((s) => s.key);
export const OS_LEAD_STAGES: OsLeadStatus[] = ['new', 'knocked', 'revisit', 'interested', 'follow_up', 'appointment', 'sold'];

export type DoorStatus = SrStatusKey;

const BY_KEY = Object.fromEntries(SR_STATUSES.map((s) => [s.key, s])) as Record<SrStatusKey, SrStatus>;
const BY_OS: Partial<Record<OsLeadStatus, SrStatus>> = {};
for (const s of SR_STATUSES) {
  if (!BY_OS[s.os]) BY_OS[s.os] = s;
}

export const LEGACY_STATUS: Record<string, SrStatusKey> = {
  new: 'unworked',
  knocked: 'no_answer',
  appointment: 'appointment_set',
  dnk: 'do_not_knock',
  not_home: 'no_answer',
  estimate_sent: 'estimate',
  existing_customer: 'customer',
  bad_address: 'lost',
};

export function doorStatusKey(value?: string | null): SrStatusKey {
  if (value && BY_KEY[value as SrStatusKey]) return value as SrStatusKey;
  if (value && LEGACY_STATUS[value]) return LEGACY_STATUS[value];
  if (value && BY_OS[value as OsLeadStatus]) return BY_OS[value as OsLeadStatus]!.key;
  return 'unworked';
}

export function srStatus(value?: string | null): SrStatus {
  return BY_KEY[doorStatusKey(value)];
}

export function srTemp(value?: string | null): 'hot' | 'warm' | 'cold' {
  const key = doorStatusKey(value);
  if (['sold', 'customer', 'appointment_set', 'interested', 'estimate'].includes(key)) return 'hot';
  if (['do_not_knock', 'not_interested', 'cancelled', 'lost', 'unworked'].includes(key)) return 'cold';
  return 'warm';
}

export function srPinHtml(status?: string | null, opts?: { selected?: boolean; route?: number; extraClass?: string }) {
  const pin = srStatus(status);
  const label = opts?.route ? String(opts.route) : pin.abbr;
  const sel = opts?.selected ? ' selected' : '';
  const extra = opts?.extraClass ? ` ${opts.extraClass}` : '';
  return `<span class="ns-sr-pin${sel}${extra}" style="--pin:${pin.color}"><b>${escapePin(label)}</b></span>`;
}

function escapePin(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function osStatusFromDoor(value?: string | null): OsLeadStatus {
  return srStatus(value).os;
}

export type SrLeadFields = {
  first_name: string;
  last_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
  vehicle: string;
  service: string;
  value: string;
  follow_up_at: string;
  appointment_at: string;
};

export const emptySrLeadFields = (): SrLeadFields => ({
  first_name: '',
  last_name: '',
  phone: '',
  alt_phone: '',
  email: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  postal_code: '',
  notes: '',
  vehicle: '',
  service: '',
  value: '',
  follow_up_at: '',
  appointment_at: '',
});

export function composePersonName(first?: string | null, last?: string | null, fallback = '') {
  return [String(first || '').trim(), String(last || '').trim()].filter(Boolean).join(' ') || fallback;
}

export function splitPersonName(name?: string | null) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function composeStreetAddress(fields: Partial<Pick<SrLeadFields, 'street1' | 'street2' | 'city' | 'state' | 'postal_code'>>, fallback = '') {
  const line1 = [fields.street1?.trim(), fields.street2?.trim()].filter(Boolean).join(', ');
  const region = [fields.city?.trim(), [fields.state?.trim(), fields.postal_code?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, region].filter(Boolean).join(', ') || fallback;
}

export function splitStreetAddress(address?: string | null) {
  const raw = String(address || '').trim();
  if (!raw) return { street1: '', street2: '', city: '', state: '', postal_code: '' };
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const street1 = parts[0] || '';
  let street2 = '';
  let city = '';
  let state = '';
  let postal_code = '';
  const rest = parts.slice(1);
  if (rest.length >= 2 && /^(apt|suite|unit|#)/i.test(rest[0])) {
    street2 = rest.shift() || '';
  }
  const region = rest.join(', ');
  const tagged = region.match(/^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (tagged) {
    city = tagged[1].trim();
    state = tagged[2].toUpperCase();
    postal_code = tagged[3];
  } else if (rest[0]) {
    city = rest[0];
    const tail = rest[1] || '';
    const stzip = tail.match(/([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (stzip) {
      state = stzip[1].toUpperCase();
      postal_code = stzip[2];
    }
  }
  return { street1, street2, city, state, postal_code };
}

export function fieldsFromLead(lead: {
  customer_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  notes?: string | null;
  vehicle?: string | null;
  vehicle_info?: string | null;
  service?: string | null;
  service_interest?: string | null;
  value?: number | string | null;
  estimated_value?: number | string | null;
  follow_up_at?: string | null;
  appointment_at?: string | null;
}) {
  const names = splitPersonName(lead.customer_name || lead.name);
  const street = splitStreetAddress(lead.address);
  const value = lead.value ?? lead.estimated_value;
  return {
    ...emptySrLeadFields(),
    first_name: lead.first_name || names.first_name,
    last_name: lead.last_name || names.last_name,
    phone: lead.phone || '',
    alt_phone: lead.alt_phone || '',
    email: lead.email || '',
    street1: lead.street1 || street.street1,
    street2: lead.street2 || street.street2,
    city: lead.city || street.city,
    state: lead.state || street.state,
    postal_code: lead.postal_code || street.postal_code,
    notes: lead.notes || '',
    vehicle: lead.vehicle || lead.vehicle_info || '',
    service: lead.service || lead.service_interest || '',
    value: value != null && value !== '' ? String(value) : '',
    follow_up_at: lead.follow_up_at ? String(lead.follow_up_at).slice(0, 16) : '',
    appointment_at: lead.appointment_at ? String(lead.appointment_at).slice(0, 16) : '',
  };
}

export function composedLeadIdentity(fields: Partial<SrLeadFields>, fallbackName = '', fallbackAddress = '') {
  const full = { ...emptySrLeadFields(), ...fields };
  return {
    name: composePersonName(full.first_name, full.last_name, fallbackName),
    address: composeStreetAddress(full, fallbackAddress),
  };
}
