
import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness, CalendarDays, Clock3, DollarSign, PackageSearch,
  Plus, Save, Trash2, TrendingUp, UserPlus, Users, WalletCards
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  CompanySetting, Employee, EmployeeShift, Expense, InventoryItem,
  PaySetting, RecruitingCandidate, SalesRecord, TimeEntry
} from '@/lib/supabase';
import { money, RECRUITING_STAGES } from '@/lib/data';

export type BusinessSection =
  | 'recruiting'
  | 'staff_schedule'
  | 'timeclock'
  | 'finance'
  | 'sales'
  | 'inventory'
  | 'pay_settings';

type Props = {
  section: BusinessSection;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  completedRevenue: number;
};

const roleLabel = (role: string) => {
  if (role === 'd2d_agent') return 'D2D Sales';
  if (role === 'manager') return 'Manager';
  if (role === 'detailer') return 'Detailer';
  return role.replaceAll('_', ' ');
};

const formatTime = (time?: string | null) => {
  if (!time) return '—';
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const dateInput = (d = new Date()) => d.toISOString().slice(0, 10);

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="tab-header">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      {action}
    </div>
  );
}

export default function BusinessSuite({ section, employees, setEmployees, completedRevenue }: Props) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<RecruitingCandidate[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [paySettings, setPaySettings] = useState<PaySetting[]>([]);
  const [company, setCompany] = useState<CompanySetting>({ id: 'main', company_value: 0, valuation_note: '', updated_at: new Date().toISOString() });

  const [candidateForm, setCandidateForm] = useState({
    full_name: '', email: '', phone: '', position: 'detailer', stage: 'applied', source: '',
    expected_pay: '', interview_date: '', start_date: '', background_status: 'not_started', notes: '',
  });
  const [shiftForm, setShiftForm] = useState({ employee_id: '', shift_date: dateInput(), start_time: '09:00', end_time: '17:00', status: 'scheduled', notes: '' });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [timeForm, setTimeForm] = useState({ employee_id: '', clock_in: '', clock_out: '', break_minutes: 0, status: 'approved', notes: '' });
  const [saleForm, setSaleForm] = useState({ employee_id: '', customer_name: '', service_name: '', sale_amount: '', status: 'completed', sold_at: new Date().toISOString().slice(0, 16), notes: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Supplies', description: '', amount: '', expense_date: dateInput(), recurring: false, notes: '' });
  const [inventoryForm, setInventoryForm] = useState({ name: '', category: 'Supplies', quantity: 0, reorder_level: 0, unit_cost: 0, supplier: '', notes: '' });

  const loadBusinessData = async () => {
    setLoading(true);
    const [cand, sh, times, sr, ex, inv, pay, co] = await Promise.all([
      supabase.from('recruiting_candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_shifts').select('*').order('shift_date', { ascending: true }),
      supabase.from('time_entries').select('*').order('clock_in', { ascending: false }),
      supabase.from('sales_records').select('*').order('sold_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('inventory_items').select('*').order('name', { ascending: true }),
      supabase.from('pay_settings').select('*').order('role_key').order('employment_level'),
      supabase.from('company_settings').select('*').eq('id', 'main').maybeSingle(),
    ]);
    setCandidates(cand.data ?? []);
    setShifts(sh.data ?? []);
    setTimeEntries(times.data ?? []);
    setSales(sr.data ?? []);
    setExpenses(ex.data ?? []);
    setInventory(inv.data ?? []);
    setPaySettings(pay.data ?? []);
    if (co.data) setCompany(co.data);
    setLoading(false);
  };

  useEffect(() => { loadBusinessData(); }, []);

  useEffect(() => {
    if (!shiftForm.employee_id && employees[0]) setShiftForm(p => ({ ...p, employee_id: employees[0].id }));
    if (!timeForm.employee_id && employees[0]) setTimeForm(p => ({ ...p, employee_id: employees[0].id }));
    const firstSales = employees.find(e => e.role === 'd2d_agent') ?? employees[0];
    if (!saleForm.employee_id && firstSales) setSaleForm(p => ({ ...p, employee_id: firstSales.id }));
  }, [employees]);

  const employeeName = (id?: string | null) => employees.find(e => e.id === id)?.name ?? 'Unassigned';

  const hoursForEntry = (entry: TimeEntry) => {
    if (!entry.clock_out) return 0;
    const gross = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
    return Math.max(0, gross - (entry.break_minutes || 0) / 60);
  };

  const startOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const startOfMonth = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);

  const employeeIncome = (emp: Employee, since?: Date) => {
    const entries = timeEntries.filter(t => t.employee_id === emp.id && (!since || new Date(t.clock_in) >= since));
    const hours = entries.reduce((sum, t) => sum + hoursForEntry(t), 0);
    const salesTotal = sales
      .filter(s => s.employee_id === emp.id && s.status === 'completed' && (!since || new Date(s.sold_at) >= since))
      .reduce((sum, s) => sum + Number(s.sale_amount), 0);
    const commission = salesTotal * (Number(emp.commission_rate || 0) / 100);
    if (emp.role === 'd2d_agent') {
      let base = Number(emp.weekly_base || 0);
      if (!since) {
        const hire = emp.hire_date ? new Date(`${emp.hire_date}T00:00:00`) : new Date(emp.created_at);
        const weeks = Math.max(1, Math.ceil((Date.now() - hire.getTime()) / (7 * 86400000)));
        base *= weeks;
      } else if (since.getTime() === startOfMonth.getTime()) {
        base *= 4.33;
      }
      return { total: base + commission, hours, salesTotal, commission, base };
    }
    const wage = hours * Number(emp.hourly_rate || 0);
    return { total: wage, hours, salesTotal, commission: 0, base: 0 };
  };

  const payrollWeek = employees.reduce((s, e) => s + employeeIncome(e, startOfWeek).total, 0);
  const payrollMonth = employees.reduce((s, e) => s + employeeIncome(e, startOfMonth).total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = expenses.filter(e => new Date(`${e.expense_date}T00:00:00`) >= startOfMonth).reduce((s, e) => s + Number(e.amount), 0);
  const estimatedMonthProfit = completedRevenue - monthExpenses - payrollMonth;

  const addCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...candidateForm,
      expected_pay: candidateForm.expected_pay ? Number(candidateForm.expected_pay) : null,
      interview_date: candidateForm.interview_date ? new Date(candidateForm.interview_date).toISOString() : null,
      start_date: candidateForm.start_date || null,
    };
    const { data, error } = await supabase.from('recruiting_candidates').insert(payload).select().single();
    if (error) return alert(error.message);
    if (data) setCandidates(p => [data, ...p]);
    setCandidateForm({ full_name: '', email: '', phone: '', position: 'detailer', stage: 'applied', source: '', expected_pay: '', interview_date: '', start_date: '', background_status: 'not_started', notes: '' });
  };

  const updateCandidateStage = async (id: string, stage: string) => {
    const { error } = await supabase.from('recruiting_candidates').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return alert(error.message);
    setCandidates(p => p.map(c => c.id === id ? { ...c, stage } : c));
  };

  const hireCandidate = async (candidate: RecruitingCandidate) => {
    const pay = paySettings.find(p => p.role_key === candidate.position && p.employment_level === 1);
    const { data, error } = await supabase.from('employees').insert({
      name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      role: candidate.position,
      status: 'active',
      employment_level: 1,
      pay_type: pay?.pay_type ?? (candidate.position === 'd2d_agent' ? 'base_commission' : 'hourly'),
      hourly_rate: pay?.hourly_rate ?? (candidate.position === 'manager' ? 22 : candidate.position === 'detailer' ? 17 : 0),
      weekly_base: pay?.weekly_base ?? (candidate.position === 'd2d_agent' ? 300 : 0),
      commission_rate: pay?.commission_rate ?? (candidate.position === 'd2d_agent' ? 10 : 0),
      hire_date: dateInput(),
      start_date: candidate.start_date || null,
      notes: `Hired from recruiting pipeline${candidate.notes ? ` — ${candidate.notes}` : ''}`,
    }).select().single();
    if (error) return alert(error.message);
    if (data) setEmployees(p => [data, ...p]);
    await updateCandidateStage(candidate.id, 'employed');
  };

  const addShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = editingShiftId
      ? supabase.from('employee_shifts').update({ ...shiftForm, updated_at: new Date().toISOString() }).eq('id', editingShiftId)
      : supabase.from('employee_shifts').insert(shiftForm);
    const { data, error } = await query.select().single();
    if (error) return alert(error.message);
    if (data) {
      setShifts(p => {
        const next = editingShiftId ? p.map(x => x.id === data.id ? data : x) : [...p, data];
        return next.sort((a, b) => a.shift_date.localeCompare(b.shift_date));
      });
    }
    setEditingShiftId(null);
  };

  const addTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeForm.clock_in) return alert('Clock in is required.');
    const payload = {
      ...timeForm,
      clock_in: new Date(timeForm.clock_in).toISOString(),
      clock_out: timeForm.clock_out ? new Date(timeForm.clock_out).toISOString() : null,
    };
    const { data, error } = await supabase.from('time_entries').insert(payload).select().single();
    if (error) return alert(error.message);
    if (data) setTimeEntries(p => [data, ...p]);
    setTimeForm(p => ({ ...p, clock_in: '', clock_out: '', break_minutes: 0, notes: '' }));
  };

  const addSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('sales_records').insert({
      ...saleForm,
      sale_amount: Number(saleForm.sale_amount),
      sold_at: new Date(saleForm.sold_at).toISOString(),
    }).select().single();
    if (error) return alert(error.message);
    if (data) setSales(p => [data, ...p]);
    setSaleForm(p => ({ ...p, customer_name: '', service_name: '', sale_amount: '', notes: '' }));
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('expenses').insert({ ...expenseForm, amount: Number(expenseForm.amount) }).select().single();
    if (error) return alert(error.message);
    if (data) setExpenses(p => [data, ...p]);
    setExpenseForm({ category: 'Supplies', description: '', amount: '', expense_date: dateInput(), recurring: false, notes: '' });
  };

  const addInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('inventory_items').insert(inventoryForm).select().single();
    if (error) return alert(error.message);
    if (data) setInventory(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setInventoryForm({ name: '', category: 'Supplies', quantity: 0, reorder_level: 0, unit_cost: 0, supplier: '', notes: '' });
  };

  const savePay = async (setting: PaySetting) => {
    const { data, error } = await supabase.from('pay_settings').update({
      pay_type: setting.pay_type,
      hourly_rate: setting.hourly_rate,
      weekly_base: setting.weekly_base,
      commission_rate: setting.commission_rate,
      updated_at: new Date().toISOString(),
    }).eq('id', setting.id).select().single();
    if (error) return alert(error.message);
    if (data) setPaySettings(p => p.map(x => x.id === data.id ? data : x));
    alert('Pay structure saved.');
  };

  const applyPayToEmployee = async (emp: Employee, role: string, level: number) => {
    const setting = paySettings.find(p => p.role_key === role && p.employment_level === level);
    if (!setting) return alert('No pay setting found for this role/level.');
    const { data, error } = await supabase.from('employees').update({
      role,
      employment_level: level,
      pay_type: setting.pay_type,
      hourly_rate: setting.hourly_rate,
      weekly_base: setting.weekly_base,
      commission_rate: setting.commission_rate,
    }).eq('id', emp.id).select().single();
    if (error) return alert(error.message);
    if (data) setEmployees(p => p.map(e => e.id === data.id ? data : e));
  };

  const saveCompanyValue = async () => {
    const { data, error } = await supabase.from('company_settings').upsert({
      id: 'main',
      company_value: Number(company.company_value || 0),
      valuation_note: company.valuation_note || null,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) return alert(error.message);
    if (data) setCompany(data);
    alert('Company value saved.');
  };

  if (loading) return <div className="admin-card"><p className="empty-text">Loading business tools...</p></div>;

  if (section === 'recruiting') {
    const stages = RECRUITING_STAGES.filter(([id]) => !['archived', 'rejected', 'withdrawn', 'no_show'].includes(id));
    return (
      <div className="tab-content business-suite">
        <SectionHeader title="Recruiting" subtitle="Manage candidates from first application through their first day." />
        <div className="ops-kpi-row">
          <div><strong>{candidates.filter(c => !['rejected','withdrawn','archived'].includes(c.stage)).length}</strong><span>Active Candidates</span></div>
          <div><strong>{candidates.filter(c => c.stage === 'background_check').length}</strong><span>Background Checks</span></div>
          <div><strong>{candidates.filter(c => c.stage === 'scheduled_to_start').length}</strong><span>Starting Soon</span></div>
          <div><strong>{candidates.filter(c => c.stage === 'employed').length}</strong><span>Hired</span></div>
        </div>
        <div className="admin-two-col ops-align-start">
          <form className="admin-card ops-form" onSubmit={addCandidate}>
            <div className="admin-card-header"><h3><UserPlus size={18}/> Add Candidate</h3></div>
            <div className="form-group"><label>Full Name</label><input required value={candidateForm.full_name} onChange={e=>setCandidateForm(p=>({...p,full_name:e.target.value}))}/></div>
            <div className="form-row"><div className="form-group"><label>Email</label><input type="email" value={candidateForm.email} onChange={e=>setCandidateForm(p=>({...p,email:e.target.value}))}/></div><div className="form-group"><label>Phone</label><input value={candidateForm.phone} onChange={e=>setCandidateForm(p=>({...p,phone:e.target.value}))}/></div></div>
            <div className="form-row"><div className="form-group"><label>Position</label><select value={candidateForm.position} onChange={e=>setCandidateForm(p=>({...p,position:e.target.value}))}><option value="detailer">Detailer</option><option value="d2d_agent">D2D Sales</option><option value="manager">Manager</option></select></div><div className="form-group"><label>Stage</label><select value={candidateForm.stage} onChange={e=>setCandidateForm(p=>({...p,stage:e.target.value}))}>{RECRUITING_STAGES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div></div>
            <div className="form-row"><div className="form-group"><label>Source</label><input placeholder="Indeed, referral, walk-in..." value={candidateForm.source} onChange={e=>setCandidateForm(p=>({...p,source:e.target.value}))}/></div><div className="form-group"><label>Expected Pay</label><input type="number" step="0.01" value={candidateForm.expected_pay} onChange={e=>setCandidateForm(p=>({...p,expected_pay:e.target.value}))}/></div></div>
            <div className="form-row"><div className="form-group"><label>Interview Date</label><input type="datetime-local" value={candidateForm.interview_date} onChange={e=>setCandidateForm(p=>({...p,interview_date:e.target.value}))}/></div><div className="form-group"><label>Planned Start</label><input type="date" value={candidateForm.start_date} onChange={e=>setCandidateForm(p=>({...p,start_date:e.target.value}))}/></div></div>
            <div className="form-group"><label>Background Check</label><select value={candidateForm.background_status} onChange={e=>setCandidateForm(p=>({...p,background_status:e.target.value}))}><option value="not_started">Not Started</option><option value="pending">Pending</option><option value="clear">Clear</option><option value="review">Needs Review</option></select></div>
            <div className="form-group"><label>Notes</label><textarea rows={3} value={candidateForm.notes} onChange={e=>setCandidateForm(p=>({...p,notes:e.target.value}))}/></div>
            <button className="btn-primary btn-full" type="submit"><Plus size={15}/> Add Candidate</button>
          </form>
          <div className="admin-card">
            <div className="admin-card-header"><h3><BriefcaseBusiness size={18}/> Pipeline</h3></div>
            <div className="recruit-pipeline">
              {stages.map(([id,label]) => <div key={id}><strong>{candidates.filter(c=>c.stage===id).length}</strong><span>{label}</span></div>)}
            </div>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header"><h3>Candidate List</h3></div>
          <div className="ops-list">
            {candidates.map(c => (
              <div className="ops-list-row" key={c.id}>
                <div className="ops-primary"><strong>{c.full_name}</strong><span>{roleLabel(c.position)} · {c.email || c.phone || 'No contact'}</span></div>
                <div><span className="ops-label">Background</span><strong>{c.background_status.replaceAll('_',' ')}</strong></div>
                <div><span className="ops-label">Stage</span><select value={c.stage} onChange={e=>updateCandidateStage(c.id,e.target.value)}>{RECRUITING_STAGES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
                <div className="ops-actions">{c.stage !== 'employed' && <button className="btn-sm btn-primary" onClick={()=>hireCandidate(c)}>Hire</button>}<button className="btn-sm btn-outline" onClick={()=>updateCandidateStage(c.id,'archived')}>Archive</button></div>
              </div>
            ))}
            {candidates.length===0 && <p className="empty-text">No recruiting candidates yet.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'staff_schedule') {
    const upcoming = shifts.filter(s => s.shift_date >= dateInput()).slice(0, 80);
    return (
      <div className="tab-content business-suite">
        <SectionHeader title="Employee Scheduling" subtitle="Create and change employee hours without a separate scheduling app." />
        <div className="admin-two-col ops-align-start">
          <form className="admin-card ops-form" onSubmit={addShift}>
            <div className="admin-card-header"><h3><CalendarDays size={18}/> {editingShiftId ? 'Edit Shift' : 'Add Shift'}</h3></div>
            <div className="form-group"><label>Employee</label><select required value={shiftForm.employee_id} onChange={e=>setShiftForm(p=>({...p,employee_id:e.target.value}))}>{employees.map(e=><option key={e.id} value={e.id}>{e.name} — {roleLabel(e.role)} L{e.employment_level||1}</option>)}</select></div>
            <div className="form-group"><label>Date</label><input type="date" required value={shiftForm.shift_date} onChange={e=>setShiftForm(p=>({...p,shift_date:e.target.value}))}/></div>
            <div className="form-row"><div className="form-group"><label>Start</label><input type="time" value={shiftForm.start_time} onChange={e=>setShiftForm(p=>({...p,start_time:e.target.value}))}/></div><div className="form-group"><label>End</label><input type="time" value={shiftForm.end_time} onChange={e=>setShiftForm(p=>({...p,end_time:e.target.value}))}/></div></div>
            <div className="form-group"><label>Status</label><select value={shiftForm.status} onChange={e=>setShiftForm(p=>({...p,status:e.target.value}))}><option value="scheduled">Scheduled</option><option value="off">Off</option><option value="pto">PTO</option><option value="sick">Sick</option></select></div>
            <div className="form-group"><label>Notes</label><textarea rows={2} value={shiftForm.notes} onChange={e=>setShiftForm(p=>({...p,notes:e.target.value}))}/></div>
            <button className="btn-primary btn-full" type="submit">{editingShiftId ? 'Update Shift' : 'Save Shift'}</button>{editingShiftId && <button type="button" className="btn-outline btn-full" onClick={()=>setEditingShiftId(null)}>Cancel Edit</button>}
          </form>
          <div className="admin-card"><div className="admin-card-header"><h3>Team Snapshot</h3></div><div className="recruit-pipeline"><div><strong>{employees.filter(e=>e.status==='active').length}</strong><span>Active Staff</span></div><div><strong>{upcoming.length}</strong><span>Upcoming Shifts</span></div><div><strong>{upcoming.filter(s=>s.shift_date===dateInput()).length}</strong><span>Today</span></div></div></div>
        </div>
        <div className="admin-card"><div className="admin-card-header"><h3>Upcoming Schedule</h3></div><div className="ops-list">{upcoming.map(s=><div className="ops-list-row" key={s.id}><div className="ops-primary"><strong>{employeeName(s.employee_id)}</strong><span>{new Date(`${s.shift_date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span></div><div><span className="ops-label">Hours</span><strong>{s.status==='scheduled'?`${formatTime(s.start_time)} – ${formatTime(s.end_time)}`:s.status.toUpperCase()}</strong></div><div><span className="ops-label">Notes</span><span>{s.notes||'—'}</span></div><div className="ops-actions"><button className="btn-sm btn-outline" onClick={()=>{setEditingShiftId(s.id);setShiftForm({employee_id:s.employee_id,shift_date:s.shift_date,start_time:(s.start_time||'09:00').slice(0,5),end_time:(s.end_time||'17:00').slice(0,5),status:s.status,notes:s.notes||''});window.scrollTo({top:0,behavior:'smooth'});}}>Edit Hours</button><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('employee_shifts').delete().eq('id',s.id);setShifts(p=>p.filter(x=>x.id!==s.id));}}><Trash2 size={13}/> Remove</button></div></div>)}{upcoming.length===0&&<p className="empty-text">No shifts scheduled.</p>}</div></div>
      </div>
    );
  }

  if (section === 'timeclock') {
    return (
      <div className="tab-content business-suite">
        <SectionHeader title="Time Clock & Timesheets" subtitle="Track hours worked and use them in payroll estimates." />
        <div className="admin-two-col ops-align-start">
          <form className="admin-card ops-form" onSubmit={addTimeEntry}><div className="admin-card-header"><h3><Clock3 size={18}/> Add Time Entry</h3></div><div className="form-group"><label>Employee</label><select value={timeForm.employee_id} onChange={e=>setTimeForm(p=>({...p,employee_id:e.target.value}))}>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div><div className="form-row"><div className="form-group"><label>Clock In</label><input type="datetime-local" required value={timeForm.clock_in} onChange={e=>setTimeForm(p=>({...p,clock_in:e.target.value}))}/></div><div className="form-group"><label>Clock Out</label><input type="datetime-local" value={timeForm.clock_out} onChange={e=>setTimeForm(p=>({...p,clock_out:e.target.value}))}/></div></div><div className="form-group"><label>Unpaid Break (minutes)</label><input type="number" min="0" value={timeForm.break_minutes} onChange={e=>setTimeForm(p=>({...p,break_minutes:Number(e.target.value)}))}/></div><div className="form-group"><label>Notes</label><textarea rows={2} value={timeForm.notes} onChange={e=>setTimeForm(p=>({...p,notes:e.target.value}))}/></div><button className="btn-primary btn-full">Save Time Entry</button></form>
          <div className="admin-card"><div className="admin-card-header"><h3>Current Week</h3></div><div className="payroll-mini-grid">{employees.slice(0,8).map(e=>{const x=employeeIncome(e,startOfWeek);return <div key={e.id}><strong>{e.name}</strong><span>{x.hours.toFixed(1)} hrs</span><b>{money(Math.round(x.total))}</b></div>})}</div></div>
        </div>
        <div className="admin-card"><div className="admin-card-header"><h3>Recent Time Entries</h3></div><div className="ops-list">{timeEntries.slice(0,100).map(t=><div className="ops-list-row" key={t.id}><div className="ops-primary"><strong>{employeeName(t.employee_id)}</strong><span>{new Date(t.clock_in).toLocaleString()}</span></div><div><span className="ops-label">Clock Out</span><strong>{t.clock_out?new Date(t.clock_out).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'Open'}</strong></div><div><span className="ops-label">Hours</span><strong>{hoursForEntry(t).toFixed(2)}</strong></div><div className="ops-actions"><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('time_entries').delete().eq('id',t.id);setTimeEntries(p=>p.filter(x=>x.id!==t.id));}}><Trash2 size={13}/></button></div></div>)}</div></div>
      </div>
    );
  }

  if (section === 'sales') {
    const completed = sales.filter(s=>s.status==='completed');
    const salesTotal = completed.reduce((s,x)=>s+Number(x.sale_amount),0);
    return (
      <div className="tab-content business-suite"><SectionHeader title="D2D Sales" subtitle="Track revenue, conversion performance, and commissionable completed sales." />
        <div className="ops-kpi-row"><div><strong>{money(salesTotal)}</strong><span>Completed Sales</span></div><div><strong>{completed.length}</strong><span>Completed Deals</span></div><div><strong>{completed.length?money(Math.round(salesTotal/completed.length)):'$0'}</strong><span>Average Ticket</span></div><div><strong>{employees.filter(e=>e.role==='d2d_agent').length}</strong><span>D2D Team</span></div></div>
        <div className="admin-two-col ops-align-start"><form className="admin-card ops-form" onSubmit={addSale}><div className="admin-card-header"><h3><TrendingUp size={18}/> Add Sale</h3></div><div className="form-group"><label>Sales Employee</label><select value={saleForm.employee_id} onChange={e=>setSaleForm(p=>({...p,employee_id:e.target.value}))}>{employees.filter(e=>e.role==='d2d_agent').map(e=><option key={e.id} value={e.id}>{e.name} — Level {e.employment_level||1}</option>)}</select></div><div className="form-row"><div className="form-group"><label>Customer</label><input value={saleForm.customer_name} onChange={e=>setSaleForm(p=>({...p,customer_name:e.target.value}))}/></div><div className="form-group"><label>Amount</label><input type="number" step="0.01" required value={saleForm.sale_amount} onChange={e=>setSaleForm(p=>({...p,sale_amount:e.target.value}))}/></div></div><div className="form-group"><label>Service</label><input required value={saleForm.service_name} onChange={e=>setSaleForm(p=>({...p,service_name:e.target.value}))}/></div><div className="form-row"><div className="form-group"><label>Status</label><select value={saleForm.status} onChange={e=>setSaleForm(p=>({...p,status:e.target.value}))}><option value="pending">Pending</option><option value="completed">Completed & Paid</option><option value="cancelled">Cancelled</option></select></div><div className="form-group"><label>Sold At</label><input type="datetime-local" value={saleForm.sold_at} onChange={e=>setSaleForm(p=>({...p,sold_at:e.target.value}))}/></div></div><button className="btn-primary btn-full">Add Sale</button></form>
          <div className="admin-card"><div className="admin-card-header"><h3>Sales Leaderboard</h3></div><div className="payroll-mini-grid">{employees.filter(e=>e.role==='d2d_agent').map(e=>{const x=employeeIncome(e,startOfMonth);return <div key={e.id}><strong>{e.name} · L{e.employment_level||1}</strong><span>{money(x.salesTotal)} sold</span><b>{money(Math.round(x.commission))} comm.</b></div>})}</div></div></div>
        <div className="admin-card"><div className="admin-card-header"><h3>Sales Records</h3></div><div className="ops-list">{sales.map(s=><div className="ops-list-row" key={s.id}><div className="ops-primary"><strong>{s.service_name}</strong><span>{s.customer_name||'Customer'} · {employeeName(s.employee_id)}</span></div><div><span className="ops-label">Sale</span><strong>{money(Number(s.sale_amount))}</strong></div><div><span className="ops-label">Status</span><strong>{s.status}</strong></div><div><span className="ops-label">Date</span><span>{new Date(s.sold_at).toLocaleDateString()}</span></div></div>)}</div></div>
      </div>
    );
  }

  if (section === 'inventory') {
    const low = inventory.filter(i=>Number(i.quantity)<=Number(i.reorder_level));
    const value = inventory.reduce((s,i)=>s+Number(i.quantity)*Number(i.unit_cost),0);
    return <div className="tab-content business-suite"><SectionHeader title="Inventory" subtitle="Track chemicals, towels, coating, tools, and reorder levels."/><div className="ops-kpi-row"><div><strong>{inventory.length}</strong><span>Items</span></div><div><strong>{low.length}</strong><span>Low Stock</span></div><div><strong>{money(Math.round(value))}</strong><span>Inventory Value</span></div></div><div className="admin-two-col ops-align-start"><form className="admin-card ops-form" onSubmit={addInventory}><div className="admin-card-header"><h3><PackageSearch size={18}/> Add Inventory</h3></div><div className="form-group"><label>Item</label><input required value={inventoryForm.name} onChange={e=>setInventoryForm(p=>({...p,name:e.target.value}))}/></div><div className="form-row"><div className="form-group"><label>Category</label><input value={inventoryForm.category} onChange={e=>setInventoryForm(p=>({...p,category:e.target.value}))}/></div><div className="form-group"><label>Supplier</label><input value={inventoryForm.supplier} onChange={e=>setInventoryForm(p=>({...p,supplier:e.target.value}))}/></div></div><div className="form-row"><div className="form-group"><label>Quantity</label><input type="number" step="0.1" value={inventoryForm.quantity} onChange={e=>setInventoryForm(p=>({...p,quantity:Number(e.target.value)}))}/></div><div className="form-group"><label>Reorder At</label><input type="number" step="0.1" value={inventoryForm.reorder_level} onChange={e=>setInventoryForm(p=>({...p,reorder_level:Number(e.target.value)}))}/></div></div><div className="form-group"><label>Unit Cost</label><input type="number" step="0.01" value={inventoryForm.unit_cost} onChange={e=>setInventoryForm(p=>({...p,unit_cost:Number(e.target.value)}))}/></div><button className="btn-primary btn-full">Add Item</button></form><div className="admin-card"><div className="admin-card-header"><h3>Low Stock Alerts</h3></div>{low.map(i=><div className="admin-row" key={i.id}><div className="admin-row-main"><strong>{i.name}</strong><span>Reorder at {i.reorder_level}</span></div><div className="admin-row-right"><strong>{i.quantity}</strong></div></div>)}{!low.length&&<p className="empty-text">No low-stock items.</p>}</div></div><div className="admin-card"><div className="ops-list">{inventory.map(i=><div className="ops-list-row" key={i.id}><div className="ops-primary"><strong>{i.name}</strong><span>{i.category} · {i.supplier||'No supplier'}</span></div><div><span className="ops-label">Qty</span><input className="ops-inline-input" type="number" step="0.1" value={i.quantity} onChange={e=>setInventory(p=>p.map(x=>x.id===i.id?{...x,quantity:Number(e.target.value)}:x))} onBlur={async e=>{await supabase.from('inventory_items').update({quantity:Number(e.target.value),updated_at:new Date().toISOString()}).eq('id',i.id)}}/></div><div><span className="ops-label">Unit Cost</span><strong>{money(Number(i.unit_cost))}</strong></div><div className="ops-actions"><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('inventory_items').delete().eq('id',i.id);setInventory(p=>p.filter(x=>x.id!==i.id));}}><Trash2 size={13}/></button></div></div>)}</div></div></div>;
  }

  if (section === 'pay_settings') {
    return <div className="tab-content business-suite"><SectionHeader title="Pay Structure" subtitle="Change levels and rates here instead of editing code. Employee cards show their current role and level."/><div className="admin-card"><div className="admin-card-header"><h3><WalletCards size={18}/> Default Pay Levels</h3></div><div className="pay-setting-grid">{paySettings.map(p=><div className="pay-setting-card" key={p.id}><div><strong>{p.label}</strong><span>{p.pay_type==='hourly'?'Hourly':'Base + Commission'}</span></div>{p.pay_type==='hourly'?<div className="form-group"><label>Hourly Rate</label><input type="number" step="0.25" value={p.hourly_rate} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,hourly_rate:Number(e.target.value)}:s))}/></div>:<><div className="form-group"><label>Weekly Base</label><input type="number" step="25" value={p.weekly_base} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,weekly_base:Number(e.target.value)}:s))}/></div><div className="form-group"><label>Commission %</label><input type="number" step="0.5" value={p.commission_rate} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,commission_rate:Number(e.target.value)}:s))}/></div></>}<button className="btn-sm btn-primary" onClick={()=>savePay(p)}><Save size={13}/> Save</button></div>)}</div><p className="ops-note">Recommended structure currently loaded: Detailers $17/$18/$19 hourly; Manager Level 1 $22/hr (Levels 2–3 default $24/$26); D2D $300 + 10%, $350 + 12.5%, $400 + 15%. Pay commission on completed/collected sales.</p></div><div className="admin-card"><div className="admin-card-header"><h3>Employee Levels</h3></div><div className="ops-list">{employees.map(e=><div className="ops-list-row" key={e.id}><div className="ops-primary"><strong>{e.name}</strong><span>{roleLabel(e.role)} · Level {e.employment_level||1}</span></div><div><span className="ops-label">Current Pay</span><strong>{e.role==='d2d_agent'?`${money(Number(e.weekly_base||0))}/wk + ${e.commission_rate}%`:`${money(Number(e.hourly_rate||0))}/hr`}</strong></div><div><span className="ops-label">Change Level</span><select value={`${e.role}:${e.employment_level||1}`} onChange={ev=>{const [role,lvl]=ev.target.value.split(':');applyPayToEmployee(e,role,Number(lvl));}}>{paySettings.map(p=><option key={p.id} value={`${p.role_key}:${p.employment_level}`}>{p.label}</option>)}</select></div></div>)}</div></div></div>;
  }

  // FINANCE / PAYROLL
  return (
    <div className="tab-content business-suite">
      <SectionHeader title="Finance & Payroll" subtitle="Estimated employee income, company value, labor cost, expenses, and operating profit." />
      <div className="ops-kpi-row"><div><strong>{money(Math.round(payrollWeek))}</strong><span>Est. Payroll This Week</span></div><div><strong>{money(Math.round(payrollMonth))}</strong><span>Est. Payroll This Month</span></div><div><strong>{money(Math.round(monthExpenses))}</strong><span>Expenses This Month</span></div><div className={estimatedMonthProfit>=0?'ops-positive':'ops-negative'}><strong>{money(Math.round(estimatedMonthProfit))}</strong><span>Est. Operating Profit</span></div></div>
      <div className="admin-two-col ops-align-start">
        <div className="admin-card"><div className="admin-card-header"><h3><DollarSign size={18}/> Company Value</h3></div><div className="form-group"><label>Current Company Value</label><input type="number" step="100" value={company.company_value} onChange={e=>setCompany(p=>({...p,company_value:Number(e.target.value)}))}/></div><div className="form-group"><label>Valuation Notes</label><textarea rows={3} value={company.valuation_note||''} onChange={e=>setCompany(p=>({...p,valuation_note:e.target.value}))}/></div><button className="btn-primary" onClick={saveCompanyValue}>Save Company Value</button></div>
        <form className="admin-card ops-form" onSubmit={addExpense}><div className="admin-card-header"><h3><WalletCards size={18}/> Add Expense</h3></div><div className="form-row"><div className="form-group"><label>Category</label><select value={expenseForm.category} onChange={e=>setExpenseForm(p=>({...p,category:e.target.value}))}><option>Supplies</option><option>Fuel</option><option>Advertising</option><option>Equipment</option><option>Insurance</option><option>Rent</option><option>Software</option><option>Payroll</option><option>Other</option></select></div><div className="form-group"><label>Amount</label><input required type="number" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm(p=>({...p,amount:e.target.value}))}/></div></div><div className="form-group"><label>Description</label><input required value={expenseForm.description} onChange={e=>setExpenseForm(p=>({...p,description:e.target.value}))}/></div><div className="form-group"><label>Date</label><input type="date" value={expenseForm.expense_date} onChange={e=>setExpenseForm(p=>({...p,expense_date:e.target.value}))}/></div><label className="ops-checkbox"><input type="checkbox" checked={expenseForm.recurring} onChange={e=>setExpenseForm(p=>({...p,recurring:e.target.checked}))}/> Recurring expense</label><button className="btn-primary btn-full">Add Expense</button></form>
      </div>
      <div className="admin-card"><div className="admin-card-header"><h3><Users size={18}/> Employee Income</h3><span className="ops-muted">Estimates — not tax withholding or payroll filing</span></div><div className="data-table"><div className="data-table-head ops-five"><span>Employee</span><span>Weekly</span><span>Monthly</span><span>Lifetime</span><span>Pay Structure</span></div>{employees.map(e=>{const w=employeeIncome(e,startOfWeek);const m=employeeIncome(e,startOfMonth);const l=employeeIncome(e);return <div className="data-table-row ops-five" key={e.id}><div className="dt-cell"><strong>{e.name}</strong><span>{roleLabel(e.role)} · Level {e.employment_level||1}</span></div><strong className="dt-cell">{money(Math.round(w.total))}</strong><strong className="dt-cell">{money(Math.round(m.total))}</strong><strong className="dt-cell">{money(Math.round(l.total))}</strong><span className="dt-cell">{e.role==='d2d_agent'?`${money(Number(e.weekly_base||0))}/wk + ${e.commission_rate}%`:`${money(Number(e.hourly_rate||0))}/hr`}</span></div>})}</div></div>
      <div className="admin-card"><div className="admin-card-header"><h3>Expense History</h3><strong>{money(Math.round(totalExpenses))} tracked</strong></div><div className="ops-list">{expenses.slice(0,100).map(e=><div className="ops-list-row" key={e.id}><div className="ops-primary"><strong>{e.description}</strong><span>{e.category}{e.recurring?' · recurring':''}</span></div><strong>{money(Number(e.amount))}</strong><span>{new Date(`${e.expense_date}T12:00:00`).toLocaleDateString()}</span><div className="ops-actions"><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('expenses').delete().eq('id',e.id);setExpenses(p=>p.filter(x=>x.id!==e.id));}}><Trash2 size={13}/></button></div></div>)}</div></div>
    </div>
  );
}
