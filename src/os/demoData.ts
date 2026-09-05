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
};

export type OsJob = {
  id: string;
  customer: string;
  service: string;
  vehicle: string;
  address: string;
  time: string;
  status: 'scheduled' | 'confirmed' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
  detailer: string;
  price: number;
  payment: 'paid' | 'due' | 'refunded';
};

export type OsLead = {
  id: string;
  name: string;
  address: string;
  status: 'new' | 'knocked' | 'interested' | 'appointment' | 'sold' | 'dnk';
  rep: string;
  value: number;
  temp: 'hot' | 'warm' | 'cold';
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
  customer: string;
  amount: number;
  method: string;
  status: 'succeeded' | 'pending' | 'refunded' | 'failed';
  at: string;
};

export type OsCandidate = {
  id: string;
  name: string;
  role: string;
  stage: string;
  progress: number;
};

const uid = () => `id_${Math.random().toString(36).slice(2, 9)}`;

export const seedEmployees: OsEmployee[] = [
  { id: 'e1', name: 'Jordan Miles', title: 'Owner / Field Operator', role: 'owner', department: 'Ownership', status: 'active', email: 'jordan@northsplash.com', phone: '330-555-0100', initials: 'JM', hue: '#c8a96a', pay_type: 'custom', hourly_rate: 0, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'monthly', hours_week: 48, onboarding: 100, location: 'Raleigh' },
  { id: 'e2', name: 'Avery Chen', title: 'Operations Administrator', role: 'admin', department: 'Operations', status: 'active', email: 'avery@northsplash.com', phone: '330-555-0101', initials: 'AC', hue: '#7c6a4a', pay_type: 'salary', hourly_rate: 0, annual_salary: 62000, weekly_base: 0, commission_rate: 0, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 40, onboarding: 100, location: 'Raleigh' },
  { id: 'e3', name: 'Marcus Hale', title: 'Lead Mobile Detailer', role: 'detailer', department: 'Detailing', status: 'active', email: 'marcus@northsplash.com', phone: '330-555-0102', initials: 'MH', hue: '#3d5a4c', pay_type: 'hourly', hourly_rate: 22, annual_salary: 0, weekly_base: 0, commission_rate: 0, per_job_rate: 35, pay_schedule: 'weekly', hours_week: 38, onboarding: 100, location: 'Cary' },
  { id: 'e4', name: 'Sofia Reyes', title: 'D2D Closer', role: 'd2d_agent', department: 'Sales', status: 'active', email: 'sofia@northsplash.com', phone: '330-555-0103', initials: 'SR', hue: '#5c3d5a', pay_type: 'base_commission', hourly_rate: 0, annual_salary: 0, weekly_base: 350, commission_rate: 12.5, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 32, onboarding: 80, location: 'Durham' },
  { id: 'e5', name: 'Noah Patel', title: 'Crew Manager', role: 'manager', department: 'Operations', status: 'active', email: 'noah@northsplash.com', phone: '330-555-0104', initials: 'NP', hue: '#3d4a5c', pay_type: 'hourly_plus_commission', hourly_rate: 24, annual_salary: 0, weekly_base: 0, commission_rate: 3, per_job_rate: 0, pay_schedule: 'weekly', hours_week: 42, onboarding: 100, location: 'Raleigh' },
  { id: 'e6', name: 'Elena Ward', title: 'Client Experience Admin', role: 'office', department: 'Customer Care', status: 'leave', email: 'elena@northsplash.com', phone: '330-555-0105', initials: 'EW', hue: '#6a4a3d', pay_type: 'salary_plus_commission', hourly_rate: 0, annual_salary: 54000, weekly_base: 0, commission_rate: 2, per_job_rate: 0, pay_schedule: 'biweekly', hours_week: 0, onboarding: 60, location: 'Remote' },
];

export const seedJobs: OsJob[] = [
  { id: 'j1', customer: 'Matthew Renner', service: 'Luxe Signature Detail', vehicle: '2022 BMW 330i', address: '412 Oakwood Ave, Raleigh', time: 'Today · 10:30 AM', status: 'en_route', detailer: 'Marcus Hale', price: 275, payment: 'due' },
  { id: 'j2', customer: 'Priya Shah', service: 'Luxe Ceramic Coating', vehicle: '2024 Porsche Macan', address: '88 Fayetteville St, Raleigh', time: 'Today · 1:00 PM', status: 'confirmed', detailer: 'Marcus Hale', price: 650, payment: 'paid' },
  { id: 'j3', customer: 'James Cole', service: 'Luxe Exterior Detail', vehicle: '2021 Tesla Model Y', address: '19 Cameron Village', time: 'Tomorrow · 9:00 AM', status: 'scheduled', detailer: 'Noah Patel', price: 125, payment: 'due' },
  { id: 'j4', customer: 'Hannah Brooks', service: 'Paint Correction', vehicle: '2019 Mercedes C300', address: 'Cary · Preston Village', time: 'Fri · 11:00 AM', status: 'scheduled', detailer: 'Marcus Hale', price: 350, payment: 'due' },
  { id: 'j5', customer: 'Luis Ortega', service: 'Luxe Signature Detail', vehicle: '2023 Audi Q5', address: 'Durham · Trinity Park', time: 'Yesterday', status: 'completed', detailer: 'Marcus Hale', price: 275, payment: 'paid' },
];

export const seedLeads: OsLead[] = [
  { id: 'l1', name: 'Kim Alvarez', address: '210 Maple St', status: 'interested', rep: 'Sofia Reyes', value: 275, temp: 'hot' },
  { id: 'l2', name: 'Derek Holt', address: '44 Birch Lane', status: 'appointment', rep: 'Sofia Reyes', value: 450, temp: 'hot' },
  { id: 'l3', name: 'Unknown door', address: '18 Cedar Ct', status: 'knocked', rep: 'Sofia Reyes', value: 175, temp: 'warm' },
  { id: 'l4', name: 'The Carters', address: '901 Lakeview', status: 'new', rep: 'Unassigned', value: 275, temp: 'cold' },
  { id: 'l5', name: 'Mina Park', address: '3 Magnolia', status: 'sold', rep: 'Sofia Reyes', value: 650, temp: 'hot' },
  { id: 'l6', name: 'Do not knock', address: '77 Pine', status: 'dnk', rep: 'Sofia Reyes', value: 0, temp: 'cold' },
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
    id: 'c3', name: 'Detailing Crew', kind: 'space', preview: 'Noah: Need two extra ceramic kits for Saturday.', at: '8:55 AM', unread: 1, initials: 'DC', hue: '#c8a96a', topic: 'Field ops',
    messages: [
      { id: uid(), from: 'Noah Patel', body: 'Need two extra ceramic kits for Saturday.', at: '8:55 AM' },
      { id: uid(), from: 'Avery Chen', body: 'Ordered. They’ll be at the Raleigh locker by 4.', at: '8:58 AM' },
    ],
  },
  {
    id: 'c4', name: 'North Splash', kind: 'space', preview: 'Avery: Payroll cutoff is Thursday 5pm.', at: 'Yesterday', unread: 0, initials: 'NS', hue: '#111', topic: 'Company',
    messages: [
      { id: uid(), from: 'Avery Chen', body: 'Payroll cutoff is Thursday 5pm. Submit hours before then.', at: 'Yesterday' },
    ],
  },
];

export const seedPayments: OsPayment[] = [
  { id: 'p1', customer: 'Luis Ortega', amount: 275, method: 'Visa · 4242', status: 'succeeded', at: 'Yesterday · 4:12 PM' },
  { id: 'p2', customer: 'Priya Shah', amount: 650, method: 'Apple Pay', status: 'succeeded', at: 'Today · 8:04 AM' },
  { id: 'p3', customer: 'Matthew Renner', amount: 275, method: 'Invoice', status: 'pending', at: 'Today · 10:30 AM' },
  { id: 'p4', customer: 'Sam Wright', amount: 125, method: 'Visa · 1881', status: 'refunded', at: 'Mon · 2:20 PM' },
  { id: 'p5', customer: 'Kim Alvarez', amount: 99, method: 'Membership', status: 'failed', at: 'Mon · 6:01 AM' },
];

export const seedCandidates: OsCandidate[] = [
  { id: 'h1', name: 'Chris Young', role: 'Mobile Detailer', stage: 'Background check', progress: 70 },
  { id: 'h2', name: 'Maya Singh', role: 'D2D Sales', stage: 'Offer sent', progress: 85 },
  { id: 'h3', name: 'Owen Blake', role: 'Office Admin', stage: 'First interview', progress: 40 },
];

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
  return compensationSummary(e);
}

export const defaultTemplates: CommunicationTemplate[] = DEFAULT_COMM_TEMPLATES.map((t) => ({ ...t }));
