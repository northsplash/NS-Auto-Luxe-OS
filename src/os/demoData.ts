import { DEFAULT_COMM_TEMPLATES, type CommunicationTemplate } from '@/lib/communicationCatalog';
import { compensationSummary } from '@/lib/compensation';

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
};

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SHIFT_DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type OsDocument = { id: string; name: string; status: 'complete' | 'missing' | 'review' };

export type JobStatus = 'scheduled' | 'confirmed' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
export const JOB_STEPS: JobStatus[] = ['scheduled', 'confirmed', 'en_route', 'in_progress', 'completed'];
export const JOB_STEP_LABELS = ['Appointment', 'Confirmed', 'En Route', 'In Progress', 'Complete'] as const;

export type OsNote = { id: string; at: string; author: string; body: string };
export type OsPhoto = { id: string; label: string; kind: 'before' | 'after'; src: string };
export type OsCommLog = { id: string; channel: 'email' | 'sms'; name: string; preview: string; at: string };

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
};

export type LeadStatus = 'new' | 'knocked' | 'interested' | 'appointment' | 'sold' | 'dnk';
export const LEAD_STAGES: LeadStatus[] = ['new', 'knocked', 'interested', 'appointment', 'sold'];

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
};

export type OsMessage = { id: string; from: string; mine?: boolean; body: string; at: string };
export type OsChat = {
  id: string;
  name: string;
  kind: 'dm' | 'space';
  preview: string;
  at: string;
  unread: number;
  initials: string;
  hue: string;
  topic?: string;
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

export const seedEmployees: OsEmployee[] = [
  { id: 'e1', name: 'Jordan Miles', title: 'Owner / Field Operator', role: 'owner', department: 'Ownership', status: 'active', email: 'jordan@northsplash.com', phone: '330-555-0100', initials: 'JM', hue: '#c8a96a', pay_type: 'custom', hourly_rate: 0, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'monthly', hours_week: 48, onboarding: 100, location: 'Raleigh', documents: docs(5), availability: fieldAvail() },
  { id: 'e2', name: 'Avery Chen', title: 'Operations Administrator', role: 'admin', department: 'Operations', status: 'active', email: 'avery@northsplash.com', phone: '330-555-0101', initials: 'AC', hue: '#7c6a4a', pay_type: 'salary', hourly_rate: 0, annual_salary: 62000, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 40, onboarding: 100, location: 'Raleigh', documents: docs(5), availability: officeAvail() },
  { id: 'e3', name: 'Marcus Hale', title: 'Lead Mobile Detailer', role: 'detailer', department: 'Detailing', status: 'active', email: 'marcus@northsplash.com', phone: '330-555-0102', initials: 'MH', hue: '#3d5a4c', pay_type: 'hourly', hourly_rate: 22, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 35, pay_schedule: 'weekly', hours_week: 38, onboarding: 100, location: 'Cary', documents: docs(5), availability: fieldAvail() },
  { id: 'e4', name: 'Sofia Reyes', title: 'D2D Closer', role: 'd2d_agent', department: 'Sales', status: 'active', email: 'sofia@northsplash.com', phone: '330-555-0103', initials: 'SR', hue: '#5c3d5a', pay_type: 'base_commission', hourly_rate: 0, annual_salary: 0, weekly_base: 350, commission_rate: 12.5, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 32, onboarding: 80, location: 'Durham', documents: docs(4), availability: fieldAvail() },
  { id: 'e5', name: 'Noah Patel', title: 'Crew Manager', role: 'manager', department: 'Operations', status: 'active', email: 'noah@northsplash.com', phone: '330-555-0104', initials: 'NP', hue: '#3d4a5c', pay_type: 'hourly_plus_commission', hourly_rate: 24, annual_salary: 0, weekly_base: 0, commission_rate: 3, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 42, onboarding: 100, location: 'Raleigh', documents: docs(5), availability: fieldAvail() },
  { id: 'e6', name: 'Elena Ward', title: 'Client Experience Admin', role: 'office', department: 'Customer Care', status: 'leave', email: 'elena@northsplash.com', phone: '330-555-0105', initials: 'EW', hue: '#6a4a3d', pay_type: 'salary_plus_commission', hourly_rate: 0, annual_salary: 54000, weekly_base: 0, commission_rate: 2, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 0, onboarding: 60, location: 'Remote', documents: docs(3), availability: officeAvail() },
];

export const seedJobs: OsJob[] = [
  {
    id: 'j1', customer: 'Matthew Renner', email: 'matthew@renner.co', phone: '919-555-2210', service: 'Luxe Signature Detail', vehicle: '2022 BMW 330i', address: '412 Oakwood Ave, Raleigh', time: 'Today · 10:30 AM', status: 'en_route', detailer: 'Marcus Hale', price: 275, payment: 'due', eta: '10:42 AM',
    internal_notes: 'Gate code 4412. Customer asked for extra interior vacuum on the rear seats.',
    notes: [{ id: uid(), at: 'Yesterday', author: 'Avery Chen', body: 'Confirmed window 10:30–12:00. BMW is in the driveway.' }],
    photos: [
      { id: uid(), label: 'Driveway pin', kind: 'before', src: 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
    ],
    comms: [{ id: uid(), channel: 'sms', name: 'Detailer en route', preview: 'Marcus is on the way. ETA 10:42 AM.', at: '10:18 AM' }],
  },
  {
    id: 'j2', customer: 'Priya Shah', email: 'priya.shah@email.com', phone: '919-555-8831', service: 'Luxe Ceramic Coating', vehicle: '2024 Porsche Macan', address: '88 Fayetteville St, Raleigh', time: 'Today · 1:00 PM', status: 'confirmed', detailer: 'Marcus Hale', price: 650, payment: 'paid',
    internal_notes: 'Ceramic kit staged at Raleigh locker. Keep the Macan in shade.',
    notes: [{ id: uid(), at: 'Mon', author: 'Noah Patel', body: 'Deposit collected. Full day slot.' }],
    photos: [],
    comms: [{ id: uid(), channel: 'email', name: 'Booking confirmation', preview: 'Your North Splash detail is confirmed', at: 'Mon · 4:02 PM' }],
  },
  {
    id: 'j3', customer: 'James Cole', email: 'james.cole@email.com', phone: '919-555-0199', service: 'Luxe Exterior Detail', vehicle: '2021 Tesla Model Y', address: '19 Cameron Village', time: 'Tomorrow · 9:00 AM', status: 'scheduled', detailer: 'Noah Patel', price: 125, payment: 'due',
    internal_notes: '',
    notes: [],
    photos: [],
    comms: [],
  },
  {
    id: 'j4', customer: 'Hannah Brooks', email: 'hannah@brooks.family', phone: '919-555-4402', service: 'Paint Correction', vehicle: '2019 Mercedes C300', address: 'Cary · Preston Village', time: 'Fri · 11:00 AM', status: 'scheduled', detailer: 'Marcus Hale', price: 350, payment: 'due',
    internal_notes: 'Water-spot heavy on hood. Bring compound kit.',
    notes: [],
    photos: [],
    comms: [],
  },
  {
    id: 'j5', customer: 'Luis Ortega', email: 'luis.ortega@email.com', phone: '919-555-7720', service: 'Luxe Signature Detail', vehicle: '2023 Audi Q5', address: 'Durham · Trinity Park', time: 'Yesterday', status: 'completed', detailer: 'Marcus Hale', price: 275, payment: 'paid',
    internal_notes: '',
    notes: [{ id: uid(), at: 'Yesterday', author: 'Marcus Hale', body: 'Customer loved the interior. Rebook in 30 days.' }],
    photos: [
      { id: uid(), label: 'Before · hood', kind: 'before', src: 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
      { id: uid(), label: 'After · gloss', kind: 'after', src: 'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&h=420&w=640' },
    ],
    comms: [{ id: uid(), channel: 'email', name: 'Thank-you', preview: 'Thank you for trusting North Splash', at: 'Yesterday · 4:40 PM' }],
  },
];

export const seedLeads: OsLead[] = [
  { id: 'l1', name: 'Kim Alvarez', address: '210 Maple St', status: 'interested', rep: 'Sofia Reyes', value: 275, temp: 'hot', phone: '919-555-1001', x: 22, y: 28, notes: 'Asked about Signature + membership.', activity: [{ id: uid(), at: '9:04 AM', author: 'Sofia Reyes', body: 'Warm knock. Wants a quote tonight.' }] },
  { id: 'l2', name: 'Derek Holt', address: '44 Birch Lane', status: 'appointment', rep: 'Sofia Reyes', value: 450, temp: 'hot', phone: '919-555-1002', x: 48, y: 36, notes: 'Friday ceramic quote.', activity: [{ id: uid(), at: '9:41 AM', author: 'Sofia Reyes', body: 'Set Friday appointment.' }] },
  { id: 'l3', name: 'Unknown door', address: '18 Cedar Ct', status: 'knocked', rep: 'Sofia Reyes', value: 175, temp: 'warm', phone: '', x: 64, y: 52, notes: 'No answer. Door hanger left.', activity: [{ id: uid(), at: '8:20 AM', author: 'Sofia Reyes', body: 'Knocked. No answer.' }] },
  { id: 'l4', name: 'The Carters', address: '901 Lakeview', status: 'new', rep: 'Unassigned', value: 275, temp: 'cold', phone: '919-555-1004', x: 34, y: 64, notes: '', activity: [] },
  { id: 'l5', name: 'Mina Park', address: '3 Magnolia', status: 'sold', rep: 'Sofia Reyes', value: 650, temp: 'hot', phone: '919-555-1005', x: 72, y: 24, notes: 'Ceramic close. Booked next week.', activity: [{ id: uid(), at: 'Yesterday', author: 'Sofia Reyes', body: 'Closed ceramic. Sent to dispatch.' }] },
  { id: 'l6', name: 'Do not knock', address: '77 Pine', status: 'dnk', rep: 'Sofia Reyes', value: 0, temp: 'cold', phone: '', x: 18, y: 72, notes: 'Homeowner requested DNK.', activity: [{ id: uid(), at: 'Mon', author: 'Sofia Reyes', body: 'Marked do-not-knock.' }] },
];

export const seedChats: OsChat[] = [
  {
    id: 'c1', name: 'Marcus Hale', kind: 'dm', preview: 'On the way to the BMW. ETA 10:42.', at: '10:18 AM', unread: 2, initials: 'MH', hue: '#3d5a4c',
    messages: [
      { id: uid(), from: 'Marcus Hale', body: 'Clocked in. First job is the 330i on Oakwood.', at: '9:02 AM' },
      { id: uid(), from: 'You', mine: true, body: 'Copy. Customer was told 10:30. Text when you tap En Route.', at: '9:04 AM' },
      { id: uid(), from: 'Marcus Hale', body: 'On the way to the BMW. ETA 10:42.', at: '10:18 AM' },
    ],
  },
  {
    id: 'c2', name: 'Sofia Reyes', kind: 'dm', preview: 'Just set the Holt appointment for Friday.', at: '9:41 AM', unread: 0, initials: 'SR', hue: '#5c3d5a',
    messages: [
      { id: uid(), from: 'Sofia Reyes', body: 'Hot lead at 44 Birch — they want Signature + ceramic quote.', at: '9:12 AM' },
      { id: uid(), from: 'You', mine: true, body: 'Send the estimate from the lead card. I’ll assign Marcus if they book.', at: '9:20 AM' },
      { id: uid(), from: 'Sofia Reyes', body: 'Just set the Holt appointment for Friday.', at: '9:41 AM' },
    ],
  },
  {
    id: 'c3', name: 'Avery Chen', kind: 'dm', preview: 'Payroll cutoff is Thursday 5pm.', at: 'Yesterday', unread: 0, initials: 'AC', hue: '#7c6a4a',
    messages: [
      { id: uid(), from: 'Avery Chen', body: 'Payroll cutoff is Thursday 5pm. Submit hours before then.', at: 'Yesterday' },
    ],
  },
  {
    id: 'c4', name: 'Detailing Crew', kind: 'space', preview: 'Noah: Need two extra ceramic kits for Saturday.', at: '8:55 AM', unread: 1, initials: 'DC', hue: '#c8a96a', topic: 'Field ops',
    messages: [
      { id: uid(), from: 'Noah Patel', body: 'Need two extra ceramic kits for Saturday.', at: '8:55 AM' },
      { id: uid(), from: 'Avery Chen', body: 'Ordered. They’ll be at the Raleigh locker by 4.', at: '8:58 AM' },
    ],
  },
  {
    id: 'c5', name: 'North Splash', kind: 'space', preview: 'Avery: Payroll cutoff is Thursday 5pm.', at: 'Yesterday', unread: 0, initials: 'NS', hue: '#111', topic: 'Company',
    messages: [
      { id: uid(), from: 'Avery Chen', body: 'Payroll cutoff is Thursday 5pm. Submit hours before then.', at: 'Yesterday' },
      { id: uid(), from: 'Jordan Miles', body: 'Also: Saturday ceramic is a two-tech job. Noah + Marcus.', at: 'Yesterday' },
    ],
  },
  {
    id: 'c6', name: 'D2D Raleigh', kind: 'space', preview: 'Sofia: 44 Birch is a Friday close.', at: '9:42 AM', unread: 0, initials: 'D2', hue: '#5c3d5a', topic: 'Canvass',
    messages: [
      { id: uid(), from: 'Sofia Reyes', body: '44 Birch is a Friday close. Sending the ceramic estimate now.', at: '9:42 AM' },
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
  { id: 'h1', name: 'Chris Young', role: 'Mobile Detailer', stage: 'Background check', progress: 70, email: 'chris.young@email.com', checklist: gusto(4) },
  { id: 'h2', name: 'Maya Singh', role: 'D2D Sales', stage: 'Offer sent', progress: 85, email: 'maya.singh@email.com', checklist: gusto(5) },
  { id: 'h3', name: 'Owen Blake', role: 'Office Admin', stage: 'First interview', progress: 40, email: 'owen.blake@email.com', checklist: gusto(2) },
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
  { id: 'cu1', name: 'Matthew Renner', email: 'matthew@renner.co', phone: '919-555-2210', vehicle: '2022 BMW 330i', address: '412 Oakwood Ave, Raleigh', member: false, notes: [{ id: uid(), at: 'Yesterday', author: 'Avery Chen', body: 'Prefers morning windows. Gate code 4412.' }] },
  { id: 'cu2', name: 'Priya Shah', email: 'priya.shah@email.com', phone: '919-555-8831', vehicle: '2024 Porsche Macan', address: '88 Fayetteville St, Raleigh', member: true, notes: [] },
  { id: 'cu3', name: 'James Cole', email: 'james.cole@email.com', phone: '919-555-0199', vehicle: '2021 Tesla Model Y', address: '19 Cameron Village', member: false, notes: [] },
  { id: 'cu4', name: 'Hannah Brooks', email: 'hannah@brooks.family', phone: '919-555-4402', vehicle: '2019 Mercedes C300', address: 'Cary · Preston Village', member: false, notes: [] },
  { id: 'cu5', name: 'Luis Ortega', email: 'luis.ortega@email.com', phone: '919-555-7720', vehicle: '2023 Audi Q5', address: 'Durham · Trinity Park', member: true, notes: [{ id: uid(), at: 'Yesterday', author: 'Marcus Hale', body: 'Rebook in 30 days. Loved interior.' }] },
];

export const seedSettings: OsSettings = {
  company: 'North Splash Auto Luxe',
  market: 'Raleigh–Durham',
  phone: '330-000-0000',
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

export function initialsOf(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'NS';
}

export const OS_SERVICES = [
  { name: 'Luxe Exterior Detail', price: 125 },
  { name: 'Luxe Interior Detail', price: 150 },
  { name: 'Luxe Signature Detail', price: 275 },
  { name: 'Paint Correction', price: 350 },
  { name: 'Luxe Ceramic Coating', price: 650 },
];

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

export function normalizeEmployee(e: Partial<OsEmployee> & Pick<OsEmployee, 'id' | 'name'>): OsEmployee {
  return {
    title: 'Team member',
    role: 'employee',
    department: 'Operations',
    status: 'active',
    email: '',
    phone: '',
    initials: initialsOf(e.name),
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
    location: 'Raleigh',
    ...e,
    documents: Array.isArray(e.documents) && e.documents.length ? e.documents : defaultDocuments(),
    availability: { ...FALLBACK_AVAIL, ...(e.availability || {}) },
  };
}

export function normalizeJob(j: Partial<OsJob> & Pick<OsJob, 'id'>): OsJob {
  return {
    customer: 'Customer',
    email: '',
    phone: '',
    service: 'Luxe Signature Detail',
    vehicle: 'Vehicle TBD',
    address: '',
    time: 'TBD',
    status: 'scheduled',
    detailer: 'Unassigned',
    price: 275,
    payment: 'due',
    internal_notes: '',
    ...j,
    notes: Array.isArray(j.notes) ? j.notes : [],
    photos: Array.isArray(j.photos) ? j.photos : [],
    comms: Array.isArray(j.comms) ? j.comms : [],
  };
}

export function normalizeLead(l: Partial<OsLead> & Pick<OsLead, 'id' | 'name'>): OsLead {
  return {
    address: '',
    status: 'new',
    rep: 'Unassigned',
    value: 275,
    temp: 'warm',
    phone: '',
    x: 40 + Math.random() * 30,
    y: 30 + Math.random() * 30,
    notes: '',
    ...l,
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
};
