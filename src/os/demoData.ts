import { DEFAULT_COMM_TEMPLATES, type CommunicationTemplate } from '@/lib/communicationCatalog';
import { compensationSummary } from '@/lib/compensation';
import { BOOKABLE_SERVICES, checklistForService, findDetailPackage } from '@/lib/detailCatalog';
import { emptyOnboarding as emptyHirePacket, type OnboardingPacket as HirePacket } from '@/lib/onboarding';
import {
  SR_PIPELINE_KEYS, composedLeadIdentity, doorStatusKey, fieldsFromLead, srTemp,
  type SrStatusKey,
} from '@/lib/salesRabbitLeads';

export type OnboardingPacket = HirePacket;
export const emptyOnboarding = emptyHirePacket;

function windowOn(daysFromToday: number, time: string) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} · ${time}`;
}

function windowOnWeekday(weekday: number, time: string) {
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7;
  return windowOn(diff, time);
}

export type OsEmployee = {
  id: string;
  name: string;
  title: string;
  role: string;
  department: string;
  status: 'active' | 'leave' | 'inactive';
  email: string;
  phone: string;
  initials: string;
  hue: string;
  photo?: string;
  pay_type: string;
  hourly_rate: number;
  annual_salary: number;
  weekly_base: number;
  commission_rate: number;
  per_job_rate: number;
  pay_schedule: string;
  hours_week: number;
  onboarding: number;
  location: string;
  documents: OsDocument[];
  availability: Record<Weekday, boolean>;
  custom_compensation?: unknown;
  onboarding_packet?: OnboardingPacket;
};

export type OsDocument = { id: string; name: string; status: 'complete' | 'missing' | 'review' };

export function onboardingPercent(packet: OnboardingPacket | undefined, documents: OsDocument[] = []) {
  const steps = ['identity', 'tax', 'pay', 'work', 'emergency'];
  const done = steps.filter((s) => packet?.steps?.[s]).length;
  const docs = documents.length ? documents.filter((d) => d.status === 'complete').length / documents.length : 1;
  return Math.round(((done / steps.length) * 0.8 + docs * 0.2) * 100);
}

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SHIFT_DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type JobStatus = 'scheduled' | 'confirmed' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
export const JOB_STEPS: JobStatus[] = ['scheduled', 'confirmed', 'en_route', 'in_progress', 'completed'];
export const JOB_STEP_LABELS = ['Appointment', 'Confirmed', 'En Route', 'In Progress', 'Complete'] as const;

export type OsNote = { id: string; at: string; author: string; body: string };
export type OsPhoto = { id: string; label: string; kind: 'before' | 'after'; src: string };
export type OsCommLog = { id: string; channel: 'email' | 'sms'; name: string; preview: string; at: string };

export type OsJobStep = { id: string; label: string; done: boolean; required?: boolean };

export type OsJob = {
  id: string;
  customer: string;
  email: string;
  phone: string;
  service: string;
  vehicle: string;
  address: string;
  time: string;
  status: JobStatus;
  detailer: string;
  price: number;
  payment: 'paid' | 'due' | 'refunded';
  eta?: string;
  internal_notes: string;
  notes: OsNote[];
  photos: OsPhoto[];
  comms: OsCommLog[];
  checklist?: OsJobStep[];
};

export type LeadStatus = SrStatusKey;
export const LEAD_STAGES: LeadStatus[] = [...SR_PIPELINE_KEYS];

export type OsLead = {
  id: string;
  name: string;
  address: string;
  status: LeadStatus;
  rep: string;
  value: number;
  temp: 'hot' | 'warm' | 'cold';
  phone: string;
  x: number;
  y: number;
  notes: string;
  activity: OsNote[];
  first_name: string;
  last_name: string;
  alt_phone: string;
  email: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postal_code: string;
  vehicle: string;
  service: string;
  follow_up_at: string;
  appointment_at: string;
  portal_user_id: string;
};

export type OsMessage = { id: string; from: string; mine?: boolean; body: string; at: string };
export type OsChat = {
  id: string;
  name: string;
  kind: 'dm' | 'space';
  channel_type?: 'company' | 'crew' | 'role' | 'custom' | 'dm';
  description?: string;
  preview: string;
  at: string;
  unread: number;
  initials: string;
  hue: string;
  topic?: string;
  members?: string[];
  messages: OsMessage[];
};

export type OsPayment = {
  id: string;
  jobId?: string;
  customer: string;
  amount: number;
  method: string;
  status: 'succeeded' | 'pending' | 'refunded' | 'failed';
  at: string;
};

export type ChecklistItem = { id: string; label: string; done: boolean };
export type OsCandidate = {
  id: string;
  name: string;
  role: string;
  stage: string;
  progress: number;
  email: string;
  phone?: string;
  city?: string;
  source?: string;
  notes?: string;
  startDate?: string;
  checklist: ChecklistItem[];
};

export type OsShift = {
  id: string;
  employeeId: string;
  day: Weekday;
  start: string;
  end: string;
};

export type OsTimeOff = {
  id: string;
  employeeId: string;
  from: string;
  to: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
};

export type OsActivity = { id: string; at: string; text: string; kind: 'ops' | 'pay' | 'hire' | 'comms' | 'sales' };

export type OsCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  address: string;
  member: boolean;
  notes: OsNote[];
  photo?: string;
};

export type OsSettings = {
  company: string;
  market: string;
  phone: string;
  timezone: string;
  depositPercent: number;
  supportEmail: string;
};

const uid = () => `id_${Math.random().toString(36).slice(2, 9)}`;
export { uid };

const fieldAvail = (): Record<Weekday, boolean> => ({
  Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false,
});
const officeAvail = (): Record<Weekday, boolean> => ({
  Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false,
});

const docs = (done: number): OsDocument[] => {
  const names = ['Offer letter', 'I-9', 'W-4', 'Handbook', 'Direct deposit'];
  return names.map((name, i) => ({
    id: `d_${name.replace(/\s/g, '').toLowerCase()}`,
    name,
    status: i < done ? 'complete' : i === done ? 'review' : 'missing',
  }));
};

const P = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&h=160&w=160`;

export const seedEmployees: OsEmployee[] = [
  { id: 'e1', name: 'Jordan Miles', title: 'Owner / Field Operator', role: 'owner', department: 'Ownership', status: 'active', email: 'jordan@northsplash.com', phone: '919-555-0100', initials: 'JM', hue: '#c8a96a', photo: P('2379005'), pay_type: 'custom', hourly_rate: 0, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'monthly', hours_week: 48, onboarding: 100, location: 'North Carolina', documents: docs(5), availability: fieldAvail() },
  { id: 'e2', name: 'Avery Chen', title: 'Operations Administrator', role: 'admin', department: 'Operations', status: 'active', email: 'avery@northsplash.com', phone: '919-555-0101', initials: 'AC', hue: '#7c6a4a', photo: P('1181686'), pay_type: 'salary', hourly_rate: 0, annual_salary: 62000, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 40, onboarding: 100, location: 'Durham', documents: docs(5), availability: officeAvail() },
  { id: 'e3', name: 'Marcus Hale', title: 'Lead Mobile Detailer', role: 'detailer', department: 'Detailing', status: 'active', email: 'marcus@northsplash.com', phone: '919-555-0102', initials: 'MH', hue: '#3d5a4c', photo: P('1681010'), pay_type: 'hourly', hourly_rate: 22, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 35, pay_schedule: 'weekly', hours_week: 38, onboarding: 100, location: 'Cary', documents: docs(5), availability: fieldAvail() },
  { id: 'e4', name: 'Sofia Reyes', title: 'D2D Closer', role: 'd2d_agent', department: 'Sales', status: 'active', email: 'sofia@northsplash.com', phone: '919-555-0103', initials: 'SR', hue: '#5c3d5a', photo: P('774909'), pay_type: 'base_commission', hourly_rate: 0, annual_salary: 0, weekly_base: 350, commission_rate: 12.5, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 32, onboarding: 80, location: 'Charlotte', documents: docs(4), availability: fieldAvail(), onboarding_packet: { ...emptyOnboarding(), legal_first: 'Sofia', legal_last: 'Reyes', preferred: 'Sofia', dob: '1998-04-12', street: '210 Ninth St', city: 'Durham', state: 'NC', zip: '27705', personal_phone: '919-555-0103', personal_email: 'sofia@northsplash.com', ssn_last4: '4412', ssn_on_file: true, filing_status: 'Single or Married filing separately', ohio_filing_status: 'Single', ohio_school_district: 'Durham County', bank_name: 'Truist', routing_last4: '0410', account_last4: '8821', account_type: 'checking', payment_method: 'direct_deposit', work_auth: 'A citizen of the United States', i9_ack: true, handbook_ack: true, steps: { identity: true, tax: true, pay: true, work: true } } },
  { id: 'e5', name: 'Noah Patel', title: 'Crew Manager', role: 'manager', department: 'Operations', status: 'active', email: 'noah@northsplash.com', phone: '919-555-0104', initials: 'NP', hue: '#3d4a5c', photo: P('1516680'), pay_type: 'hourly_plus_commission', hourly_rate: 24, annual_salary: 0, weekly_base: 0, commission_rate: 3, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 42, onboarding: 100, location: 'Wilmington', documents: docs(5), availability: fieldAvail() },
  { id: 'e6', name: 'Elena Ward', title: 'Client Experience Admin', role: 'office', department: 'Customer Care', status: 'leave', email: 'elena@northsplash.com', phone: '919-555-0105', initials: 'EW', hue: '#6a4a3d', photo: P('415829'), pay_type: 'salary_plus_commission', hourly_rate: 0, annual_salary: 54000, weekly_base: 0, commission_rate: 2, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 0, onboarding: 60, location: 'Remote', documents: docs(3), availability: officeAvail(), onboarding_packet: { ...emptyOnboarding(), legal_first: 'Elena', legal_last: 'Ward', preferred: 'Elena', dob: '1994-11-02', street: '12 Haywood St', city: 'Asheville', state: 'NC', zip: '28801', personal_phone: '919-555-0105', personal_email: 'elena@northsplash.com', ssn_last4: '2291', ssn_on_file: true, filing_status: 'Head of household', ohio_filing_status: 'Single', ohio_school_district: 'Buncombe County', bank_name: 'Truist', routing_last4: '0410', account_last4: '3304', account_type: 'checking', payment_method: 'direct_deposit', steps: { identity: true, tax: true, pay: true } } },
];

export const seedJobs: OsJob[] = [
  {
    id: 'j1', customer: 'Matthew Renner', email: 'matthew@renner.co', phone: '919-555-2210', service: 'Luxe Signature', vehicle: '2022 BMW 330i', address: '412 Forest Hills Dr, Durham NC 27707', time: windowOn(0, '10:30 AM'), status: 'en_route', detailer: 'Marcus Hale', price: 275, payment: 'due', eta: '10:42 AM',
    internal_notes: 'Gate code 4412. Customer asked for extra interior vacuum on the rear seats.',
    notes: [{ id: uid(), at: 'Yesterday', author: 'Avery Chen', body: 'Confirmed window 10:30–12:00. BMW is in the driveway.' }],
    photos: [
      { id: uid(), label: 'Driveway pin', kind: 'before', src: 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
    ],
    comms: [{ id: uid(), channel: 'sms', name: 'Detailer en route', preview: 'Marcus is on the way. ETA 10:42 AM.', at: '10:18 AM' }],
  },
  {
    id: 'j2', customer: 'Priya Shah', email: 'priya.shah@email.com', phone: '919-555-8831', service: 'Luxe Ceramic Coating', vehicle: '2024 Porsche Macan', address: '88 South Blvd, Charlotte NC 28203', time: windowOn(0, '1:00 PM'), status: 'confirmed', detailer: 'Marcus Hale', price: 650, payment: 'paid',
    internal_notes: 'Ceramic kit staged at the Charlotte locker. Keep the Macan in shade.',
    notes: [{ id: uid(), at: 'Mon', author: 'Noah Patel', body: 'Deposit collected. Full day slot.' }],
    photos: [],
    comms: [{ id: uid(), channel: 'email', name: 'Booking confirmation', preview: 'Your North Splash detail is confirmed', at: 'Mon · 4:02 PM' }],
  },
  {
    id: 'j3', customer: 'James Cole', email: 'james.cole@email.com', phone: '919-555-0199', service: 'Exterior Signature', vehicle: '2021 Tesla Model Y', address: '19 Oleander Dr, Wilmington NC 28403', time: windowOn(1, '9:00 AM'), status: 'scheduled', detailer: 'Noah Patel', price: 175, payment: 'due',
    internal_notes: '',
    notes: [],
    photos: [],
    comms: [],
  },
  {
    id: 'j4', customer: 'Hannah Brooks', email: 'hannah@brooks.family', phone: '919-555-4402', service: 'Paint Correction', vehicle: '2019 Mercedes C300', address: 'Cary · Preston Village', time: windowOnWeekday(5, '11:00 AM'), status: 'scheduled', detailer: 'Marcus Hale', price: 350, payment: 'due',
    internal_notes: 'Water-spot heavy on hood. Bring compound kit.',
    notes: [],
    photos: [],
    comms: [],
  },
  {
    id: 'j5', customer: 'Luis Ortega', email: 'luis.ortega@email.com', phone: '919-555-7720', service: 'Luxe Signature', vehicle: '2023 Audi Q5', address: 'Durham · Trinity Park', time: windowOn(-1, '3:00 PM'), status: 'completed', detailer: 'Marcus Hale', price: 275, payment: 'paid',
    internal_notes: '',
    notes: [{ id: uid(), at: 'Yesterday', author: 'Marcus Hale', body: 'Customer loved the interior. Rebook in 30 days.' }],
    photos: [
      { id: uid(), label: 'Before · hood', kind: 'before', src: 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
      { id: uid(), label: 'After · gloss', kind: 'after', src: 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
    ],
    comms: [{ id: uid(), channel: 'email', name: 'Thank-you', preview: 'Thank you for trusting North Splash', at: 'Yesterday · 4:40 PM' }],
  },
  {
    id: 'j6', customer: 'Sam Wright', email: 'sam.wright@email.com', phone: '919-555-1881', service: 'Interior Signature', vehicle: '2020 Lexus GX', address: 'Cary · MacGregor Downs', time: windowOn(0, '4:00 PM'), status: 'scheduled', detailer: '', price: 200, payment: 'due',
    internal_notes: 'Needs a tech. Customer prefers after school pickup.',
    notes: [],
    photos: [],
    comms: [],
  },
];

export const seedLeads: Array<Partial<OsLead> & { id: string; name: string; address: string }> = [
  { id: 'l1', name: 'Kim Alvarez', address: '210 Ninth St, Durham NC 27705', status: 'interested', rep: 'Sofia Reyes', value: 275, temp: 'hot', phone: '919-555-1001', email: 'kim.alvarez@email.com', vehicle: '2019 Honda Pilot', service: 'Luxe Signature', x: 22, y: 28, notes: 'Asked about Signature + membership.', activity: [{ id: uid(), at: '9:04 AM', author: 'Sofia Reyes', body: 'Warm knock. Wants a quote tonight.' }] },
  { id: 'l2', name: 'Derek Holt', address: '4412 Battleground Ave, Greensboro NC 27408', status: 'appointment_set', rep: 'Sofia Reyes', value: 450, temp: 'hot', phone: '919-555-1002', appointment_at: windowOn(4, '10:00 AM'), service: 'Luxe Ceramic Coating', x: 48, y: 36, notes: 'Friday ceramic quote.', activity: [{ id: uid(), at: '9:41 AM', author: 'Sofia Reyes', body: 'Set Friday appointment.' }] },
  { id: 'l3', name: 'Unknown door', address: '18 South Blvd, Charlotte NC 28203', status: 'no_answer', rep: 'Sofia Reyes', value: 175, temp: 'warm', phone: '', x: 64, y: 52, notes: 'No answer. Door hanger left.', activity: [{ id: uid(), at: '8:20 AM', author: 'Sofia Reyes', body: 'Knocked. No answer.' }] },
  { id: 'l4', name: 'The Carters', address: '901 Hillsborough St, Chapel Hill NC 27514', status: 'unworked', rep: 'Unassigned', value: 275, temp: 'cold', phone: '919-555-1004', x: 34, y: 64, notes: '', activity: [] },
  { id: 'l5', name: 'Mina Park', address: '3 Fayetteville St, Asheville NC 28801', status: 'sold', rep: 'Sofia Reyes', value: 650, temp: 'hot', phone: '919-555-1005', email: 'mina.park@email.com', vehicle: '2023 Tesla Model Y', service: 'Luxe Ceramic Coating', x: 72, y: 24, notes: 'Ceramic close. Booked next week.', activity: [{ id: uid(), at: 'Yesterday', author: 'Sofia Reyes', body: 'Closed ceramic. Sent to dispatch.' }] },
  { id: 'l6', name: 'Do not knock', address: '77 Forest Hills Dr, Durham NC 27707', status: 'do_not_knock', rep: 'Sofia Reyes', value: 0, temp: 'cold', phone: '', x: 18, y: 72, notes: 'Homeowner requested DNK.', activity: [{ id: uid(), at: 'Mon', author: 'Sofia Reyes', body: 'Marked do-not-knock.' }] },
  { id: 'l7', name: 'The Nguyens', address: '12 Oleander Dr, Wilmington NC 28403', status: 'revisit', rep: 'Unassigned', value: 275, temp: 'warm', phone: '919-555-1007', follow_up_at: windowOn(1, '5:30 PM'), x: 80, y: 42, notes: 'Husband was leaving. Come back after 5.', activity: [] },
  { id: 'l8', name: 'Willow house', address: '8 Market St, Wilmington NC 28401', status: 'estimate', rep: 'Sofia Reyes', value: 375, temp: 'hot', phone: '919-555-1008', email: 'willow@email.com', service: 'Interior Signature', x: 88, y: 58, notes: 'Estimate sent for Interior Signature.', activity: [] },
  { id: 'l9', name: 'Unknown door', address: '102 Tryon St, Charlotte NC 28202', status: 'follow_up', rep: 'Sofia Reyes', value: 275, temp: 'warm', phone: '919-555-1009', follow_up_at: windowOn(0, '6:00 PM'), x: 28, y: 46, notes: 'Callback tonight after dinner.', activity: [] },
  { id: 'l10', name: 'Pat Rivera', address: '44 Ninth St, Durham NC 27705', status: 'not_interested', rep: 'Sofia Reyes', value: 0, temp: 'cold', phone: '', x: 56, y: 70, notes: 'Already has a detailer.', activity: [{ id: uid(), at: 'Tue', author: 'Sofia Reyes', body: 'Not interested this season.' }] },
];

export const seedChats: OsChat[] = [
  {
    id: 'c-company', name: 'Company Updates', kind: 'space', channel_type: 'company',
    description: 'Company-wide announcements and field updates.',
    preview: 'Welcome to North Splash field comms.', at: '8:01 AM', unread: 0, initials: 'CU', hue: '#c8a96a', topic: 'Company',
    messages: [
      { id: 'm-welcome', from: 'Jordan Miles', body: 'Company channel is live. Wins, delays, and safety notes belong here — not in a group text.', at: '8:01 AM' },
      { id: 'm-welcome-2', from: 'Avery Chen', body: 'If you are new, finish your onboarding packet under People → your name → Onboarding.', at: '8:04 AM' },
    ],
  },
  {
    id: 'c-crew', name: 'Crew V1', kind: 'space', channel_type: 'crew',
    description: 'Crew channel for field operations.',
    preview: 'Need two extra ceramic kits for Saturday.', at: '8:55 AM', unread: 1, initials: 'CV', hue: '#c8a96a', topic: 'Field ops',
    messages: [
      { id: uid(), from: 'Noah Patel', body: 'Need two extra ceramic kits for Saturday.', at: '8:55 AM' },
      { id: uid(), from: 'Avery Chen', body: 'Ordered. They’ll be at the Durham locker by 4.', at: '8:58 AM' },
    ],
  },
  {
    id: 'c-d2d', name: 'D2D Sales', kind: 'space', channel_type: 'role',
    description: 'Door-to-door reps, knocks, and closes.',
    preview: '44 Birch is a Friday close.', at: '9:42 AM', unread: 0, initials: 'D2', hue: '#5c3d5a', topic: 'Canvass',
    messages: [
      { id: uid(), from: 'Sofia Reyes', body: '44 Birch is a Friday close. Sending the ceramic estimate now.', at: '9:42 AM' },
    ],
  },
  {
    id: 'c-group', name: 'Group V1', kind: 'space', channel_type: 'custom',
    description: 'Private team group.',
    preview: 'Payroll cutoff is Thursday 5pm.', at: 'Yesterday', unread: 0, initials: 'G1', hue: '#7c6a4a', topic: 'Ops',
    messages: [
      { id: uid(), from: 'Avery Chen', body: 'Payroll cutoff is Thursday 5pm. Submit hours before then.', at: 'Yesterday' },
    ],
  },
  {
    id: 'c1', name: 'Marcus Hale', kind: 'dm', channel_type: 'dm', preview: 'On the way to the BMW. ETA 10:42.', at: '10:18 AM', unread: 2, initials: 'MH', hue: '#3d5a4c',
    messages: [
      { id: uid(), from: 'Marcus Hale', body: 'Clocked in. First job is the 330i on Forest Pines.', at: '9:02 AM' },
      { id: uid(), from: 'You', mine: true, body: 'Copy. Customer was told 10:30. Text when you tap En Route.', at: '9:04 AM' },
      { id: uid(), from: 'Marcus Hale', body: 'On the way to the BMW. ETA 10:42.', at: '10:18 AM' },
    ],
  },
  {
    id: 'c2', name: 'Sofia Reyes', kind: 'dm', channel_type: 'dm', preview: 'Just set the Holt appointment for Friday.', at: '9:41 AM', unread: 0, initials: 'SR', hue: '#5c3d5a',
    messages: [
      { id: uid(), from: 'Sofia Reyes', body: 'Hot lead at 44 Birch — they want Signature + ceramic quote.', at: '9:12 AM' },
      { id: uid(), from: 'You', mine: true, body: 'Send the estimate from the lead card. I’ll assign Marcus if they book.', at: '9:20 AM' },
      { id: uid(), from: 'Sofia Reyes', body: 'Just set the Holt appointment for Friday.', at: '9:41 AM' },
    ],
  },
];

export const seedPayments: OsPayment[] = [
  { id: 'p1', jobId: 'j5', customer: 'Luis Ortega', amount: 275, method: 'Visa · 4242', status: 'succeeded', at: 'Yesterday · 4:12 PM' },
  { id: 'p2', jobId: 'j2', customer: 'Priya Shah', amount: 650, method: 'Apple Pay', status: 'succeeded', at: 'Today · 8:04 AM' },
  { id: 'p3', jobId: 'j1', customer: 'Matthew Renner', amount: 275, method: 'Invoice', status: 'pending', at: 'Today · 10:30 AM' },
  { id: 'p4', customer: 'Sam Wright', amount: 125, method: 'Visa · 1881', status: 'refunded', at: 'Mon · 2:20 PM' },
  { id: 'p5', customer: 'Kim Alvarez', amount: 99, method: 'Membership', status: 'failed', at: 'Mon · 6:01 AM' },
];

const gusto = (done: number): ChecklistItem[] => {
  const labels = ['Application', 'Phone screen', 'Interview', 'Background check', 'Offer', 'I-9 / W-4', 'First shift'];
  return labels.map((label, i) => ({ id: `ck_${i}`, label, done: i < done }));
};

export const seedCandidates: OsCandidate[] = [
  { id: 'h1', name: 'Chris Young', role: 'Mobile Detailer', stage: 'Background check', progress: 70, email: 'chris.young@email.com', phone: '704-555-2218', city: 'Charlotte', source: 'Referral', notes: 'Five years mobile detail. Valid NC license. Can start after two weeks’ notice.', checklist: gusto(4) },
  { id: 'h2', name: 'Maya Singh', role: 'D2D Sales', stage: 'Offer sent', progress: 85, email: 'maya.singh@email.com', phone: '919-555-7740', city: 'Durham', source: 'Indeed', notes: 'Closing experience at another shop. Wants 12% commission and a weekend route.', checklist: gusto(5) },
  { id: 'h3', name: 'Owen Blake', role: 'Office Admin', stage: 'First interview', progress: 40, email: 'owen.blake@email.com', phone: '910-555-4412', city: 'Wilmington', source: 'Website', notes: 'Weekend mornings only until May. Wants to start April 14.', startDate: 'Apr 14', checklist: gusto(2) },
  { id: 'h4', name: 'Tessa Cole', role: 'Manager', stage: 'Applied', progress: 15, email: 'tessa.cole@email.com', phone: '336-555-0194', city: 'Greensboro', source: 'Website', notes: 'Eight years running a 4-van shop. Valid license. Can start in two weeks.', startDate: 'in two weeks', checklist: gusto(1) },
];

export const seedShifts: OsShift[] = [
  { id: 's1', employeeId: 'e3', day: 'Mon', start: '8:30a', end: '5:00p' },
  { id: 's2', employeeId: 'e3', day: 'Tue', start: '8:30a', end: '5:00p' },
  { id: 's3', employeeId: 'e3', day: 'Wed', start: '8:30a', end: '5:00p' },
  { id: 's4', employeeId: 'e3', day: 'Thu', start: '8:30a', end: '5:00p' },
  { id: 's5', employeeId: 'e3', day: 'Fri', start: '8:30a', end: '5:00p' },
  { id: 's6', employeeId: 'e3', day: 'Sat', start: '9:00a', end: '2:00p' },
  { id: 's7', employeeId: 'e5', day: 'Mon', start: '8:00a', end: '5:00p' },
  { id: 's8', employeeId: 'e5', day: 'Tue', start: '8:00a', end: '5:00p' },
  { id: 's9', employeeId: 'e5', day: 'Wed', start: '8:00a', end: '5:00p' },
  { id: 's10', employeeId: 'e5', day: 'Thu', start: '8:00a', end: '5:00p' },
  { id: 's11', employeeId: 'e5', day: 'Fri', start: '8:00a', end: '5:00p' },
  { id: 's12', employeeId: 'e4', day: 'Tue', start: '10:00a', end: '7:00p' },
  { id: 's13', employeeId: 'e4', day: 'Wed', start: '10:00a', end: '7:00p' },
  { id: 's14', employeeId: 'e4', day: 'Thu', start: '10:00a', end: '7:00p' },
  { id: 's15', employeeId: 'e4', day: 'Sat', start: '9:00a', end: '3:00p' },
  { id: 's16', employeeId: 'e2', day: 'Mon', start: '9:00a', end: '5:00p' },
  { id: 's17', employeeId: 'e2', day: 'Tue', start: '9:00a', end: '5:00p' },
  { id: 's18', employeeId: 'e2', day: 'Wed', start: '9:00a', end: '5:00p' },
  { id: 's19', employeeId: 'e2', day: 'Thu', start: '9:00a', end: '5:00p' },
  { id: 's20', employeeId: 'e2', day: 'Fri', start: '9:00a', end: '5:00p' },
];

export const seedTimeOff: OsTimeOff[] = [
  { id: 't1', employeeId: 'e6', from: 'Mon', to: 'Fri', reason: 'Family leave', status: 'approved' },
  { id: 't2', employeeId: 'e4', from: 'Sun', to: 'Sun', reason: 'Personal', status: 'pending' },
];

export const seedActivity: OsActivity[] = [
  { id: uid(), at: '10:18 AM', text: 'Marcus tapped En Route for Matthew’s BMW. SMS sent.', kind: 'comms' },
  { id: uid(), at: '9:41 AM', text: 'Sofia set a Friday appointment at 44 Birch.', kind: 'sales' },
  { id: uid(), at: '8:04 AM', text: 'Priya Shah paid $650 ceramic by Apple Pay.', kind: 'pay' },
  { id: uid(), at: 'Yesterday', text: 'Elena’s onboarding is 60% — documents outstanding.', kind: 'hire' },
];

export const seedCustomers: OsCustomer[] = [
  { id: 'cu1', name: 'Matthew Renner', email: 'matthew@renner.co', phone: '919-555-2210', vehicle: '2022 BMW 330i', address: '412 Forest Hills Dr, Durham NC 27707', member: false, photo: P('220453'), notes: [{ id: uid(), at: 'Yesterday', author: 'Avery Chen', body: 'Prefers morning windows. Gate code 4412.' }] },
  { id: 'cu2', name: 'Priya Shah', email: 'priya.shah@email.com', phone: '919-555-8831', vehicle: '2024 Porsche Macan', address: '88 South Blvd, Charlotte NC 28203', member: true, photo: P('1239291'), notes: [] },
  { id: 'cu3', name: 'James Cole', email: 'james.cole@email.com', phone: '919-555-0199', vehicle: '2021 Tesla Model Y', address: '19 Oleander Dr, Wilmington NC 28403', member: false, photo: P('614810'), notes: [] },
  { id: 'cu4', name: 'Hannah Brooks', email: 'hannah@brooks.family', phone: '919-555-4402', vehicle: '2019 Mercedes C300', address: 'Cary · Preston Village', member: false, photo: P('733872'), notes: [] },
  { id: 'cu5', name: 'Luis Ortega', email: 'luis.ortega@email.com', phone: '919-555-7720', vehicle: '2023 Audi Q5', address: 'Durham · Trinity Park', member: true, photo: P('91227'), notes: [{ id: uid(), at: 'Yesterday', author: 'Marcus Hale', body: 'Rebook in 30 days. Loved interior.' }] },
];

export const seedSettings: OsSettings = {
  company: 'North Splash Auto Luxe',
  market: 'North Carolina',
  phone: '330-990-3956',
  timezone: 'America/New_York',
  depositPercent: 25,
  supportEmail: 'hello@northsplash.com',
};

export const revenueDays = [
  { d: 'Mon', v: 1420 },
  { d: 'Tue', v: 980 },
  { d: 'Wed', v: 2110 },
  { d: 'Thu', v: 1760 },
  { d: 'Fri', v: 2540 },
  { d: 'Sat', v: 3180 },
  { d: 'Sun', v: 640 },
];

export function payLine(e: OsEmployee) {
  return compensationSummary({
    pay_type: e.pay_type,
    hourly_rate: e.hourly_rate,
    annual_salary: e.annual_salary,
    weekly_base: e.weekly_base,
    commission_rate: e.commission_rate,
    per_job_rate: e.per_job_rate,
    custom_compensation: (e.custom_compensation ?? null) as Record<string, unknown> | null,
  });
}

export const defaultTemplates: CommunicationTemplate[] = DEFAULT_COMM_TEMPLATES.map((t) => ({ ...t }));

export function clockNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function initialsOf(name?: string | null) {
  return String(name || '').split(' ').map((p) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'NS';
}

export const OS_SERVICES = BOOKABLE_SERVICES.map((pkg) => ({ name: pkg.name, price: pkg.price }));

const FALLBACK_AVAIL: Record<Weekday, boolean> = {
  Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false,
};

export function defaultDocuments(): OsDocument[] {
  return [
    { id: 'd_offer', name: 'Offer letter', status: 'review' },
    { id: 'd_i9', name: 'I-9', status: 'missing' },
    { id: 'd_w4', name: 'W-4', status: 'missing' },
    { id: 'd_handbook', name: 'Handbook', status: 'missing' },
    { id: 'd_deposit', name: 'Direct deposit', status: 'missing' },
  ];
}

export function normalizeEmployee(e: Partial<OsEmployee> & { id?: string; name?: string }): OsEmployee {
  const merged = {
    id: e.id || uid(),
    title: 'Team member',
    role: 'employee',
    department: 'Operations',
    status: 'active' as OsEmployee['status'],
    email: '',
    phone: '',
    initials: 'NS',
    hue: '#7c6a4a',
    pay_type: 'hourly',
    hourly_rate: 0,
    annual_salary: 0,
    weekly_base: 0,
    commission_rate: 0,
    per_job_rate: 0,
    pay_schedule: 'weekly',
    hours_week: 0,
    onboarding: 0,
    location: 'North Carolina',
    ...e,
    name: e.name || 'Team member',
  };
  return {
    ...merged,
    status: (['active', 'leave', 'inactive'].includes(String(merged.status)) ? merged.status : 'active') as OsEmployee['status'],
    role: merged.role || 'employee',
    pay_type: merged.pay_type || 'hourly',
    pay_schedule: merged.pay_schedule || 'weekly',
    initials: merged.initials || initialsOf(merged.name),
    documents: Array.isArray(e.documents) && e.documents.length ? e.documents : defaultDocuments(),
    availability: { ...FALLBACK_AVAIL, ...(e.availability || {}) },
    onboarding_packet: e.onboarding_packet ? { ...emptyOnboarding(), ...e.onboarding_packet, steps: e.onboarding_packet.steps || {} } : e.onboarding_packet,
  };
}

export function normalizeCustomer(c: Partial<OsCustomer> & { id?: string }): OsCustomer {
  return {
    id: c.id || uid(),
    name: c.name || 'Customer',
    email: c.email || '',
    phone: c.phone || '',
    vehicle: c.vehicle || '',
    address: c.address || '',
    member: Boolean(c.member),
    notes: Array.isArray(c.notes) ? c.notes : [],
    photo: c.photo,
  };
}

export function normalizeCandidate(c: Partial<OsCandidate> & { id?: string }): OsCandidate {
  const checklist = Array.isArray(c.checklist) ? c.checklist : [];
  const done = checklist.filter((item) => item.done).length;
  return {
    id: c.id || uid(),
    name: c.name || 'Candidate',
    role: c.role || 'Team member',
    email: c.email || '',
    phone: c.phone || '',
    city: c.city || '',
    source: c.source || '',
    notes: c.notes || '',
    startDate: c.startDate || '',
    stage: c.stage || (checklist.find((item) => !item.done)?.label || 'Ready to start'),
    progress: Number.isFinite(c.progress)
      ? Number(c.progress)
      : (checklist.length ? Math.round((done / checklist.length) * 100) : 0),
    checklist,
  };
}

export function normalizeJob(j: Partial<OsJob> & { id?: string }): OsJob {
  const merged = {
    id: j.id || uid(),
    customer: 'Customer',
    email: '',
    phone: '',
    service: 'Luxe Signature',
    vehicle: 'Vehicle TBD',
    address: '',
    time: 'TBD',
    status: 'scheduled' as JobStatus,
    detailer: 'Unassigned',
    price: 275,
    payment: 'due',
    internal_notes: '',
    ...j,
  };
  const service = findDetailPackage(merged.service)?.name || merged.service || 'Luxe Signature';
  return {
    ...merged,
    customer: merged.customer || 'Customer',
    service,
    time: merged.time || 'TBD',
    status: merged.status || 'scheduled',
    detailer: merged.detailer || 'Unassigned',
    price: Number(merged.price || 0),
    payment: (['paid', 'due', 'refunded'].includes(String(merged.payment)) ? merged.payment : 'due') as OsJob['payment'],
    notes: Array.isArray(j.notes) ? j.notes : [],
    photos: Array.isArray(j.photos) ? j.photos : [],
    comms: Array.isArray(j.comms) ? j.comms : [],
    checklist: Array.isArray(j.checklist) && j.checklist.length
      ? j.checklist
      : checklistForService(service).map((step, index) => ({
        id: `${merged.id}_step_${index}`,
        label: step.label,
        done: false,
        required: step.required,
      })),
  };
}

export function normalizeChat(c: Partial<OsChat> & { id?: string; name?: string }): OsChat {
  const messages = Array.isArray(c.messages)
    ? c.messages.filter((m): m is OsMessage => Boolean(m && m.id && m.body != null))
    : [];
  const name = c.name || 'Channel';
  return {
    kind: 'space',
    preview: '',
    at: '',
    unread: 0,
    hue: '#c8a96a',
    ...c,
    id: c.id || uid(),
    name,
    initials: c.initials || initialsOf(name),
    messages,
  };
}

export function normalizeActivity(a: Partial<OsActivity> & { id?: string }): OsActivity {
  return {
    id: a.id || uid(),
    at: String(a.at || ''),
    text: String(a.text || ''),
    kind: a.kind === 'pay' || a.kind === 'hire' || a.kind === 'comms' || a.kind === 'sales' ? a.kind : 'ops',
  };
}

export function normalizeLead(l: Partial<OsLead> & { id?: string; name?: string }): OsLead {
  const fields = fieldsFromLead(l);
  const identity = composedLeadIdentity(fields, l.name || 'Lead', l.address || '');
  const status = doorStatusKey(l.status);
  const merged = {
    id: l.id || uid(),
    address: identity.address,
    rep: l.rep || 'Unassigned',
    value: Number(l.value ?? fields.value ?? 275) || 0,
    temp: l.temp || srTemp(status),
    phone: l.phone || fields.phone,
    x: l.x ?? 40 + Math.random() * 30,
    y: l.y ?? 30 + Math.random() * 30,
    notes: l.notes || fields.notes,
    first_name: fields.first_name,
    last_name: fields.last_name,
    alt_phone: fields.alt_phone,
    email: l.email || fields.email,
    street1: fields.street1,
    street2: fields.street2,
    city: fields.city || '',
    state: fields.state || 'NC',
    postal_code: fields.postal_code || '',
    vehicle: fields.vehicle,
    service: fields.service,
    follow_up_at: fields.follow_up_at,
    appointment_at: fields.appointment_at || String(l.appointment_at || ''),
    ...l,
    name: identity.name || l.name || 'Lead',
    status,
  };
  return {
    ...merged,
    name: merged.name || 'Lead',
    address: identity.address || merged.address || '',
    first_name: merged.first_name || fields.first_name,
    last_name: merged.last_name || fields.last_name,
    street1: merged.street1 || fields.street1,
    street2: merged.street2 || fields.street2,
    city: merged.city || fields.city,
    state: merged.state || fields.state,
    postal_code: merged.postal_code || fields.postal_code,
    phone: merged.phone || '',
    alt_phone: merged.alt_phone || '',
    email: merged.email || '',
    vehicle: merged.vehicle || '',
    service: merged.service || '',
    follow_up_at: merged.follow_up_at || '',
    appointment_at: merged.appointment_at || '',
    portal_user_id: merged.portal_user_id || '',
    temp: merged.temp || srTemp(status),
    activity: Array.isArray(l.activity) ? l.activity : [],
  };
}

export type JobDraft = {
  customer: string;
  service: string;
  vehicle: string;
  address: string;
  time: string;
  price: number;
  detailer: string;
  phone?: string;
  email?: string;
  confirm?: boolean;
};
