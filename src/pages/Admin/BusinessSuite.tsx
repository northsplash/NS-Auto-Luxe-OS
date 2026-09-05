
import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness, CalendarDays, Clock3, DollarSign, PackageSearch,
  Plus, Save, Trash2, TrendingUp, UserPlus, Users, WalletCards, Trophy, Target, BarChart3, CircleDollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  CompanySetting, Employee, EmployeeShift, Expense, InventoryItem,
  PaySetting, RecruitingCandidate, SalesRecord, TimeEntry
} from '@/lib/supabase';
import { money, RECRUITING_STAGES } from '@/lib/data';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import CompensationRuleBuilder from '@/components/CompensationRuleBuilder';
import { compensationSummary, estimateCustomRulePay } from '@/lib/compensation';
import { employeeCanD2D } from '@/lib/workCapabilities';

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


function InitialAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'NS';
  return <span className="v19-avatar" style={{ width: size, height: size }}>{initials}</span>;
}

function SalesLineChart({ values }: { values: { label: string; value: number }[] }) {
  const max = Math.max(1, ...values.map(v => v.value));
  const width = 520, height = 178, pad = 18;
  const pts = values.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1);
    const y = height - pad - (v.value / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map(([x,y],i)=>`${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fill = `${path} L ${pts.at(-1)?.[0] ?? pad} ${height-pad} L ${pts[0]?.[0] ?? pad} ${height-pad} Z`;
  return <div className="v19-chart-wrap"><svg className="v19-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales revenue trend">
    {[0.25,0.5,0.75].map(n=><line key={n} x1={pad} x2={width-pad} y1={height-pad-(height-pad*2)*n} y2={height-pad-(height-pad*2)*n} className="v19-chart-grid"/>)}
    <path d={fill} className="v19-chart-area"/><path d={path} className="v19-chart-line"/>
    {pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.3" className="v19-chart-dot"><title>{values[i].label}: {money(values[i].value)}</title></circle>)}
  </svg><div className="v19-chart-labels">{values.map(v=><span key={v.label}>{v.label}</span>)}</div></div>;
}

export default function BusinessSuite({ section, employees, setEmployees, completedRevenue }: Props) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<RecruitingCandidate[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [leadSnapshot, setLeadSnapshot] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [paySettings, setPaySettings] = useState<PaySetting[]>([]);
  const [company, setCompany] = useState<CompanySetting>({ id: 'main', company_value: 0, valuation_note: '', updated_at: new Date().toISOString() });
  const [compEmployeeId,setCompEmployeeId]=useState('');
  const [compDraft,setCompDraft]=useState<Partial<Employee>>({});

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
    const [cand, sh, times, sr, ex, inv, pay, co, leadRows] = await Promise.all([
      supabase.from('recruiting_candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_shifts').select('*').order('shift_date', { ascending: true }),
      supabase.from('time_entries').select('*').order('clock_in', { ascending: false }),
      supabase.from('sales_records').select('*').order('sold_at', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('inventory_items').select('*').order('name', { ascending: true }),
      supabase.from('pay_settings').select('*').order('role_key').order('employment_level'),
      supabase.from('company_settings').select('*').eq('id', 'main').maybeSingle(),
      supabase.from('leads').select('id,status,estimated_value,created_at').order('created_at', { ascending: false }).limit(1000),
    ]);
    setCandidates(cand.data ?? []);
    setShifts(sh.data ?? []);
    setTimeEntries(times.data ?? []);
    setSales(sr.data ?? []);
    setExpenses(ex.data ?? []);
    setInventory(inv.data ?? []);
    setPaySettings(pay.data ?? []);
    if (co.data) setCompany(co.data);
    setLeadSnapshot(leadRows.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadBusinessData(); }, []);

  useEffect(() => {
    if (!shiftForm.employee_id && employees[0]) setShiftForm(p => ({ ...p, employee_id: employees[0].id }));
    if (!timeForm.employee_id && employees[0]) setTimeForm(p => ({ ...p, employee_id: employees[0].id }));
    const firstSales = employees.find(employeeCanD2D) ?? employees[0];
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
    const entries=timeEntries.filter(t=>t.employee_id===emp.id&&(!since||new Date(t.clock_in)>=since));
    const hours=entries.reduce((sum,t)=>sum+hoursForEntry(t),0);
    const completedSales=sales.filter(x=>x.employee_id===emp.id&&x.status==='completed'&&(!since||new Date(x.sold_at)>=since));
    const salesTotal=completedSales.reduce((sum,x)=>sum+Number(x.sale_amount||0),0),jobs=completedSales.length;
    const payType=emp.pay_type||(emp.role==='d2d_agent'?'base_commission':'hourly');
    let base=0;
    if(payType==='salary'){const annual=Number(emp.annual_salary||0);base=!since?annual:since.getTime()===startOfMonth.getTime()?annual/12:annual/52}
    if(['base_commission','custom'].includes(payType)){base=Number(emp.weekly_base||0);if(!since){const hire=emp.hire_date?new Date(`${emp.hire_date}T00:00:00`):new Date(emp.created_at);base*=Math.max(1,Math.ceil((Date.now()-hire.getTime())/(7*86400000)))}else if(since.getTime()===startOfMonth.getTime())base*=4.33}
    const wage=['hourly','custom'].includes(payType)?hours*Number(emp.hourly_rate||0):0;
    const commission=['base_commission','commission_only','custom'].includes(payType)?salesTotal*(Number(emp.commission_rate||0)/100)+jobs*Number(emp.flat_commission||0):0;
    const jobPay=['per_job','custom'].includes(payType)?jobs*Number(emp.per_job_rate||0):0;
    const weeks=!since?Math.max(1,Math.ceil((Date.now()-(emp.hire_date?new Date(`${emp.hire_date}T00:00:00`).getTime():new Date(emp.created_at).getTime()))/(7*86400000))):since.getTime()===startOfMonth.getTime()?4.33:1;
    const customRules=estimateCustomRulePay(emp.custom_compensation,{hours,salesRevenue:salesTotal,salesCount:jobs,jobs,weeks,months:since&&since.getTime()===startOfMonth.getTime()?1:0});
    return{total:base+wage+commission+jobPay+customRules,hours,salesTotal,commission,base,wage,jobPay,jobs,customRules};
  };
  const compensationLabel=(emp:Employee)=>compensationSummary(emp);
  const openCompensation=(emp:Employee)=>{setCompEmployeeId(emp.id);setCompDraft({...emp})};
  const saveEmployeeCompensation=async()=>{if(!compEmployeeId)return;const payload={title:compDraft.title||null,department:compDraft.department||null,pay_type:compDraft.pay_type||'hourly',hourly_rate:Number(compDraft.hourly_rate||0),weekly_base:Number(compDraft.weekly_base||0),commission_rate:Number(compDraft.commission_rate||0),annual_salary:Number(compDraft.annual_salary||0),per_job_rate:Number(compDraft.per_job_rate||0),flat_commission:Number(compDraft.flat_commission||0),commission_basis:compDraft.commission_basis||'revenue',pay_schedule:compDraft.pay_schedule||'weekly',overtime_eligible:compDraft.overtime_eligible!==false,compensation_notes:compDraft.compensation_notes||null,custom_compensation:compDraft.custom_compensation||{rules:[]}};const{data,error}=await supabase.from('employees').update(payload).eq('id',compEmployeeId).select().single();if(error)return alert(error.message);if(data)setEmployees(prev=>prev.map(e=>e.id===data.id?data:e));setCompEmployeeId('');setCompDraft({})};


  const payrollWeek = employees.reduce((s, e) => s + employeeIncome(e, startOfWeek).total, 0);
  const payrollMonth = employees.reduce((s, e) => s + employeeIncome(e, startOfMonth).total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = expenses.filter(e => new Date(`${e.expense_date}T00:00:00`) >= startOfMonth).reduce((s, e) => s + Number(e.amount), 0);
  const estimatedMonthProfit = completedRevenue - monthExpenses - payrollMonth;
  const expenseByCategory = (Object.entries(expenses.filter(e=>new Date(`${e.expense_date}T00:00:00`)>=startOfMonth).reduce((acc:Record<string,number>,e)=>{acc[e.category]=(acc[e.category]||0)+Number(e.amount||0);return acc},{})) as [string,number][]).sort((a,b)=>b[1]-a[1]);
  const maxExpenseCategory = Math.max(1,...expenseByCategory.map(([,value])=>value));

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
    const salesTotal = completed.reduce((sum,x)=>sum+Number(x.sale_amount),0);
    const avgTicket = completed.length ? Math.round(salesTotal/completed.length) : 0;
    const agents = employees.filter(e=>employeeCanD2D(e)&&e.status==='active');
    const recentDays = Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return d});
    const trend = recentDays.map(d=>({label:d.toLocaleDateString('en-US',{weekday:'short'}),value:completed.filter(x=>new Date(x.sold_at).toDateString()===d.toDateString()).reduce((a,x)=>a+Number(x.sale_amount),0)}));
    const leaderboard = agents.map(e=>({employee:e,...employeeIncome(e,startOfMonth)})).sort((a,b)=>b.salesTotal-a.salesTotal);
    const statusCounts = ['new', 'contacted', 'interested', 'follow_up', 'estimate_sent', 'sold'].map(status => ({
      status,
      count: leadSnapshot.filter((l: any) =>
        l.status === status ||
        (status === 'contacted' && ['not_home', 'no_answer'].includes(l.status)) ||
        (status === 'follow_up' && l.status === 'follow_up') ||
        (status === 'estimate_sent' && l.status === 'estimate')
      ).length,
    }));
    const totalStatus = Math.max(1,statusCounts.reduce((a,x)=>a+x.count,0));
    const pipelineValue = leadSnapshot.filter((l:any)=>!['sold','lost','not_interested','do_not_knock'].includes(l.status)).reduce((sum:number,l:any)=>sum+Number(l.estimated_value||0),0);
    const newLeads = leadSnapshot.filter((l:any)=>new Date(l.created_at).toDateString()===new Date().toDateString()).length;
    const donutStops = statusCounts.reduce((acc:any[],x,i)=>{const prior=acc.length?acc[acc.length-1].end:0;const end=prior+(x.count/totalStatus)*100;acc.push({...x,start:prior,end});return acc},[]);

    return (
      <div className="tab-content business-suite v19-sales-workspace">
        <SectionHeader title="D2D Sales" subtitle="Track door-to-door performance, log appointments, and close more deals." />
        <div className="v19-kpi-grid v20-five-kpis">
          <div className="v19-kpi"><span className="v19-kpi-icon"><DollarSign size={20}/></span><div><strong>{money(salesTotal)}</strong><span>Completed Sales</span><small>Collected completed sales</small></div></div>
          <div className="v19-kpi"><span className="v19-kpi-icon"><Target size={20}/></span><div><strong>{completed.length}</strong><span>Deals Closed</span><small>{sales.length} total records</small></div></div>
          <div className="v19-kpi"><span className="v19-kpi-icon"><CircleDollarSign size={20}/></span><div><strong>{money(avgTicket)}</strong><span>Average Ticket</span><small>Completed sales average</small></div></div>
          <div className="v19-kpi"><span className="v19-kpi-icon"><Users size={20}/></span><div><strong>{agents.length}</strong><span>Active D2D Team</span><small>Sales representatives</small></div></div>
          <div className="v19-kpi"><span className="v19-kpi-icon"><Target size={20}/></span><div><strong>{newLeads}</strong><span>New Leads Today</span><small>{leadSnapshot.length} total tracked leads</small></div></div>
        </div>
        <div className="v19-sales-grid">
          <form className="admin-card ops-form v19-sale-form" onSubmit={addSale}>
            <div className="admin-card-header"><h3><TrendingUp size={18}/> Add New Sale</h3><span className="v19-card-kicker">SALES ENTRY</span></div>
            <div className="form-group"><label>Sales Employee</label><select value={saleForm.employee_id} onChange={e=>setSaleForm(p=>({...p,employee_id:e.target.value}))}>{agents.map(e=><option key={e.id} value={e.id}>{e.name} — Level {e.employment_level||1}</option>)}</select></div>
            <div className="form-row"><div className="form-group"><label>Customer</label><input placeholder="Search or enter customer" value={saleForm.customer_name} onChange={e=>setSaleForm(p=>({...p,customer_name:e.target.value}))}/></div><div className="form-group"><label>Amount</label><input type="number" step="0.01" required placeholder="$0.00" value={saleForm.sale_amount} onChange={e=>setSaleForm(p=>({...p,sale_amount:e.target.value}))}/></div></div>
            <div className="form-group"><label>Service / Package</label><input placeholder="Signature Detail, Ceramic Coating..." required value={saleForm.service_name} onChange={e=>setSaleForm(p=>({...p,service_name:e.target.value}))}/></div>
            <div className="form-row"><div className="form-group"><label>Status</label><select value={saleForm.status} onChange={e=>setSaleForm(p=>({...p,status:e.target.value}))}><option value="pending">Pending</option><option value="completed">Completed & Paid</option><option value="cancelled">Cancelled</option></select></div><div className="form-group"><label>Sold At</label><input type="datetime-local" value={saleForm.sold_at} onChange={e=>setSaleForm(p=>({...p,sold_at:e.target.value}))}/></div></div>
            <div className="v19-form-actions"><button className="btn-primary" type="submit">Save Sale</button><button className="btn-outline" type="button" onClick={()=>setSaleForm({ employee_id: agents[0]?.id||'', customer_name:'', service_name:'', sale_amount:'', status:'completed', sold_at:new Date().toISOString().slice(0,16), notes:'' })}>Clear Form</button></div>
          </form>
          <div className="v19-sales-insights">
            <section className="admin-card v19-chart-card"><div className="admin-card-header"><h3><BarChart3 size={18}/> Sales Performance</h3><span className="v19-card-kicker">LAST 7 DAYS</span></div><SalesLineChart values={trend}/></section>
            <section className="admin-card v20-lead-status-card"><div className="admin-card-header"><h3>Leads by Status</h3><span className="v19-card-kicker">LIVE CRM</span></div><div className="v20-donut-layout"><div className="v20-donut" style={{background:`conic-gradient(${donutStops.map((x:any,i:number)=>`${['#4f9ddd','#e5b84c','#ef9c4d','#bd66c9','#7562d8','#4fc170'][i]} ${x.start}% ${x.end}%`).join(',') || '#252525 0 100%'})`}}><div><strong>{leadSnapshot.length}</strong><small>Total Leads</small></div></div><div className="v20-donut-legend">{statusCounts.map((x,i)=><div key={x.status}><i style={{background:['#4f9ddd','#e5b84c','#ef9c4d','#bd66c9','#7562d8','#4fc170'][i]}}/><span>{x.status.replaceAll('_',' ')}</span><strong>{x.count}</strong></div>)}</div></div></section>
          </div>
          <section className="admin-card v19-leaderboard"><div className="admin-card-header"><h3><Trophy size={18}/> Top Performing Reps</h3><span className="v19-card-kicker">THIS MONTH</span></div><div className="v19-leader-list">{leaderboard.length?leaderboard.map((x,i)=><div key={x.employee.id} className="v19-leader-row"><span className="v19-rank">{i+1}</span><EmployeeAvatar employee={x.employee} size="sm" className="v23-leader-avatar"/><div><strong>{x.employee.name}</strong><small>Level {x.employee.employment_level||1}</small></div><div className="v19-leader-money"><strong>{money(Math.round(x.salesTotal))}</strong><small>{money(Math.round(x.commission))} commission</small></div></div>):<div className="v19-empty">No D2D reps yet.</div>}</div></section><section className="admin-card v20-pipeline-card"><div className="admin-card-header"><h3><CircleDollarSign size={18}/> Sales Pipeline Value</h3><span className="v19-card-kicker">OPEN OPPORTUNITIES</span></div><strong className="v20-pipeline-total">{money(pipelineValue)}</strong><div className="v20-pipeline-bars">{statusCounts.slice(0,5).map((x,i)=>{const v=leadSnapshot.filter((l:any)=>l.status===x.status || (x.status==='contacted'&&['not_home','no_answer'].includes(l.status))).reduce((a:number,l:any)=>a+Number(l.estimated_value||0),0);return <div key={x.status}><i style={{height:`${Math.max(8,pipelineValue?v/pipelineValue*100:8)}%`}}/><span>{x.status.replaceAll('_',' ')}</span><small>{money(v)}</small></div>})}</div></section>
        </div>
        <section className="admin-card v19-sales-records"><div className="admin-card-header"><h3>Recent Sales</h3><strong>{sales.length} records</strong></div><div className="v19-sales-table"><div className="v19-sales-head"><span>Date</span><span>Customer</span><span>Service</span><span>Amount</span><span>Status</span><span>Rep</span></div>{sales.slice(0,60).map(s=><div className="v19-sales-row" key={s.id}><span>{new Date(s.sold_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><strong>{s.customer_name||'Customer'}</strong><span>{s.service_name}</span><strong>{money(Number(s.sale_amount))}</strong><span><em className={`v19-status v19-${s.status}`}>{s.status}</em></span><span>{employeeName(s.employee_id)}</span></div>)}{!sales.length&&<div className="v19-empty">No sales recorded yet. Add the first sale above.</div>}</div></section>
      </div>
    );
  }

  if (section === 'inventory') {
    const low = inventory.filter(i=>Number(i.quantity)<=Number(i.reorder_level));
    const value = inventory.reduce((s,i)=>s+Number(i.quantity)*Number(i.unit_cost),0);
    return <div className="tab-content business-suite"><SectionHeader title="Inventory" subtitle="Track chemicals, towels, coating, tools, and reorder levels."/><div className="ops-kpi-row"><div><strong>{inventory.length}</strong><span>Items</span></div><div><strong>{low.length}</strong><span>Low Stock</span></div><div><strong>{money(Math.round(value))}</strong><span>Inventory Value</span></div></div><div className="admin-two-col ops-align-start"><form className="admin-card ops-form" onSubmit={addInventory}><div className="admin-card-header"><h3><PackageSearch size={18}/> Add Inventory</h3></div><div className="form-group"><label>Item</label><input required value={inventoryForm.name} onChange={e=>setInventoryForm(p=>({...p,name:e.target.value}))}/></div><div className="form-row"><div className="form-group"><label>Category</label><input value={inventoryForm.category} onChange={e=>setInventoryForm(p=>({...p,category:e.target.value}))}/></div><div className="form-group"><label>Supplier</label><input value={inventoryForm.supplier} onChange={e=>setInventoryForm(p=>({...p,supplier:e.target.value}))}/></div></div><div className="form-row"><div className="form-group"><label>Quantity</label><input type="number" step="0.1" value={inventoryForm.quantity} onChange={e=>setInventoryForm(p=>({...p,quantity:Number(e.target.value)}))}/></div><div className="form-group"><label>Reorder At</label><input type="number" step="0.1" value={inventoryForm.reorder_level} onChange={e=>setInventoryForm(p=>({...p,reorder_level:Number(e.target.value)}))}/></div></div><div className="form-group"><label>Unit Cost</label><input type="number" step="0.01" value={inventoryForm.unit_cost} onChange={e=>setInventoryForm(p=>({...p,unit_cost:Number(e.target.value)}))}/></div><button className="btn-primary btn-full">Add Item</button></form><div className="admin-card"><div className="admin-card-header"><h3>Low Stock Alerts</h3></div>{low.map(i=><div className="admin-row" key={i.id}><div className="admin-row-main"><strong>{i.name}</strong><span>Reorder at {i.reorder_level}</span></div><div className="admin-row-right"><strong>{i.quantity}</strong></div></div>)}{!low.length&&<p className="empty-text">No low-stock items.</p>}</div></div><div className="admin-card"><div className="ops-list">{inventory.map(i=><div className="ops-list-row" key={i.id}><div className="ops-primary"><strong>{i.name}</strong><span>{i.category} · {i.supplier||'No supplier'}</span></div><div><span className="ops-label">Qty</span><input className="ops-inline-input" type="number" step="0.1" value={i.quantity} onChange={e=>setInventory(p=>p.map(x=>x.id===i.id?{...x,quantity:Number(e.target.value)}:x))} onBlur={async e=>{await supabase.from('inventory_items').update({quantity:Number(e.target.value),updated_at:new Date().toISOString()}).eq('id',i.id)}}/></div><div><span className="ops-label">Unit Cost</span><strong>{money(Number(i.unit_cost))}</strong></div><div className="ops-actions"><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('inventory_items').delete().eq('id',i.id);setInventory(p=>p.filter(x=>x.id!==i.id));}}><Trash2 size={13}/></button></div></div>)}</div></div></div>;
  }

  if (section === 'pay_settings') {
    const selectedEmp=employees.find(e=>e.id===compEmployeeId);
    return <div className="tab-content business-suite pay-command-v25">
      <SectionHeader title="Compensation Studio" subtitle="Custom job titles and flexible pay for every role — hourly, salary, commission, per-job or mixed."/>
      <div className="pay-command-kpis"><div><span>Team Members</span><strong>{employees.length}</strong><small>Total records</small></div><div><span>Hourly</span><strong>{employees.filter(e=>(e.pay_type||'hourly')==='hourly').length}</strong><small>Time based</small></div><div><span>Commission</span><strong>{employees.filter(e=>['base_commission','commission_only'].includes(e.pay_type||'')).length}</strong><small>Sales based</small></div><div><span>Custom</span><strong>{employees.filter(e=>(e.pay_type||'')==='custom').length}</strong><small>Mixed structures</small></div></div>
      <div className="pay-command-layout"><section className="admin-card pay-directory-v25"><div className="admin-card-header"><div><span className="eyebrow">EMPLOYEE PAY</span><h3>Individual Compensation</h3></div><span>{employees.length} people</span></div><div className="pay-employee-list-v25">{employees.map(e=><button key={e.id} className={compEmployeeId===e.id?'active':''} onClick={()=>openCompensation(e)}><EmployeeAvatar employee={e} size="sm"/><span><strong>{e.name}</strong><small>{e.title||roleLabel(e.role)} · {e.department||'North Splash'}</small></span><em>{compensationLabel(e)}</em></button>)}</div></section>
      <section className="admin-card pay-editor-v25">{selectedEmp?<><div className="admin-card-header"><div><span className="eyebrow">COMPENSATION PROFILE</span><h3>{selectedEmp.name}</h3></div><EmployeeAvatar employee={selectedEmp} size="md"/></div><div className="form-row"><div className="form-group"><label>Custom Job Title</label><input value={String(compDraft.title||'')} onChange={e=>setCompDraft(p=>({...p,title:e.target.value}))}/></div><div className="form-group"><label>Department</label><input value={String(compDraft.department||'')} onChange={e=>setCompDraft(p=>({...p,department:e.target.value}))}/></div></div><div className="form-row"><div className="form-group"><label>Pay Structure</label><select value={String(compDraft.pay_type||'hourly')} onChange={e=>setCompDraft(p=>({...p,pay_type:e.target.value}))}><option value="hourly">Hourly</option><option value="salary">Salary</option><option value="base_commission">Base + Commission</option><option value="commission_only">Commission Only</option><option value="per_job">Per Job</option><option value="custom">Custom / Mixed</option></select></div><div className="form-group"><label>Pay Schedule</label><select value={String(compDraft.pay_schedule||'weekly')} onChange={e=>setCompDraft(p=>({...p,pay_schedule:e.target.value}))}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="semimonthly">Twice Monthly</option><option value="monthly">Monthly</option></select></div></div>
      {['hourly','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-row"><div className="form-group"><label>Hourly Rate</label><input type="number" min="0" step=".25" value={Number(compDraft.hourly_rate||0)} onChange={e=>setCompDraft(p=>({...p,hourly_rate:Number(e.target.value)}))}/></div><label className="pay-check-v25"><input type="checkbox" checked={compDraft.overtime_eligible!==false} onChange={e=>setCompDraft(p=>({...p,overtime_eligible:e.target.checked}))}/>Overtime eligible</label></div>}
      {['salary','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-group"><label>Annual Salary</label><input type="number" min="0" step="500" value={Number(compDraft.annual_salary||0)} onChange={e=>setCompDraft(p=>({...p,annual_salary:Number(e.target.value)}))}/></div>}
      {['base_commission','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-row"><div className="form-group"><label>Weekly Base</label><input type="number" min="0" step="25" value={Number(compDraft.weekly_base||0)} onChange={e=>setCompDraft(p=>({...p,weekly_base:Number(e.target.value)}))}/></div><div className="form-group"><label>Commission %</label><input type="number" min="0" max="100" step=".25" value={Number(compDraft.commission_rate||0)} onChange={e=>setCompDraft(p=>({...p,commission_rate:Number(e.target.value)}))}/></div></div>}
      {['commission_only','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-row"><div className="form-group"><label>Commission %</label><input type="number" min="0" max="100" step=".25" value={Number(compDraft.commission_rate||0)} onChange={e=>setCompDraft(p=>({...p,commission_rate:Number(e.target.value)}))}/></div><div className="form-group"><label>Flat Commission / Sale</label><input type="number" min="0" step="5" value={Number(compDraft.flat_commission||0)} onChange={e=>setCompDraft(p=>({...p,flat_commission:Number(e.target.value)}))}/></div></div>}
      {['per_job','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-group"><label>Per-Job Rate</label><input type="number" min="0" step="5" value={Number(compDraft.per_job_rate||0)} onChange={e=>setCompDraft(p=>({...p,per_job_rate:Number(e.target.value)}))}/></div>}
      {['base_commission','commission_only','custom'].includes(String(compDraft.pay_type||''))&&<div className="form-group"><label>Commission Basis</label><select value={String(compDraft.commission_basis||'revenue')} onChange={e=>setCompDraft(p=>({...p,commission_basis:e.target.value}))}><option value="revenue">Collected Revenue</option><option value="gross_profit">Gross Profit</option><option value="job">Completed Jobs</option><option value="membership">Membership Sales</option></select></div>}
      <CompensationRuleBuilder value={compDraft.custom_compensation} onChange={custom_compensation=>setCompDraft(p=>({...p,custom_compensation}))} compact/>
      <div className="form-group"><label>Compensation Notes</label><textarea rows={4} value={String(compDraft.compensation_notes||'')} onChange={e=>setCompDraft(p=>({...p,compensation_notes:e.target.value}))} placeholder="Bonuses, draws, guarantees, custom tiers..."/></div><div className="pay-editor-actions-v25"><button className="btn-primary" onClick={saveEmployeeCompensation}><Save size={14}/>Save Compensation</button><button className="btn-outline" onClick={()=>{setCompEmployeeId('');setCompDraft({})}}>Close</button></div></>:<div className="v20-dark-empty pay-empty-v25"><WalletCards size={30}/><strong>Select an employee</strong><span>Build their pay structure without changing permissions.</span></div>}</section></div>
      <section className="admin-card"><div className="admin-card-header"><h3><WalletCards size={18}/> Optional Role Presets</h3><span>Use presets as starting points only.</span></div><div className="pay-setting-grid">{paySettings.map(p=><div className="pay-setting-card" key={p.id}><div><strong>{p.label}</strong><span>{p.pay_type==='hourly'?'Hourly':'Base + Commission'}</span></div>{p.pay_type==='hourly'?<div className="form-group"><label>Hourly Rate</label><input type="number" step="0.25" value={p.hourly_rate} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,hourly_rate:Number(e.target.value)}:s))}/></div>:<><div className="form-group"><label>Weekly Base</label><input type="number" step="25" value={p.weekly_base} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,weekly_base:Number(e.target.value)}:s))}/></div><div className="form-group"><label>Commission %</label><input type="number" step="0.5" value={p.commission_rate} onChange={e=>setPaySettings(x=>x.map(s=>s.id===p.id?{...s,commission_rate:Number(e.target.value)}:s))}/></div></>}<button className="btn-sm btn-primary" onClick={()=>savePay(p)}><Save size={13}/>Save</button></div>)}</div></section>
    </div>;
  }

  // FINANCE / PAYROLL
  return (
    <div className="tab-content business-suite">
      <SectionHeader title="Finance & Payroll" subtitle="Estimated employee income, company value, labor cost, expenses, and operating profit." />
      <div className="ops-kpi-row"><div><strong>{money(Math.round(payrollWeek))}</strong><span>Est. Payroll This Week</span></div><div><strong>{money(Math.round(payrollMonth))}</strong><span>Est. Payroll This Month</span></div><div><strong>{money(Math.round(monthExpenses))}</strong><span>Expenses This Month</span></div><div className={estimatedMonthProfit>=0?'ops-positive':'ops-negative'}><strong>{money(Math.round(estimatedMonthProfit))}</strong><span>Est. Operating Profit</span></div></div>
      <div className="v20-finance-analytics"><section className="admin-card"><div className="admin-card-header"><h3><BarChart3 size={18}/> Monthly Cost Mix</h3><span className="v19-card-kicker">LIVE EXPENSES</span></div><div className="v20-expense-bars">{expenseByCategory.length?expenseByCategory.slice(0,7).map(([label,value])=><div key={label}><span>{label}</span><i><b style={{width:`${Math.max(4,value/maxExpenseCategory*100)}%`}}/></i><strong>{money(value)}</strong></div>):<div className="v20-dark-empty">No expenses recorded this month.</div>}</div></section><section className="admin-card v20-finance-health"><div className="admin-card-header"><h3><CircleDollarSign size={18}/> Operating Snapshot</h3><span className="v19-card-kicker">THIS MONTH</span></div><div className="v20-finance-ring" style={{'--progress':`${completedRevenue?Math.max(0,Math.min(100,(estimatedMonthProfit/completedRevenue)*100)):0}%`} as React.CSSProperties}><div><strong>{completedRevenue?`${Math.round((estimatedMonthProfit/completedRevenue)*100)}%`:'0%'}</strong><small>margin*</small></div></div><div className="v20-finance-legend"><div><span>Collected revenue</span><strong>{money(completedRevenue)}</strong></div><div><span>Payroll estimate</span><strong>{money(payrollMonth)}</strong></div><div><span>Other expenses</span><strong>{money(monthExpenses)}</strong></div></div><small>*Operational estimate before taxes/filing adjustments.</small></section></div>
      <div className="admin-two-col ops-align-start">
        <div className="admin-card"><div className="admin-card-header"><h3><DollarSign size={18}/> Company Value</h3></div><div className="form-group"><label>Current Company Value</label><input type="number" step="100" value={company.company_value} onChange={e=>setCompany(p=>({...p,company_value:Number(e.target.value)}))}/></div><div className="form-group"><label>Valuation Notes</label><textarea rows={3} value={company.valuation_note||''} onChange={e=>setCompany(p=>({...p,valuation_note:e.target.value}))}/></div><button className="btn-primary" onClick={saveCompanyValue}>Save Company Value</button></div>
        <form className="admin-card ops-form" onSubmit={addExpense}><div className="admin-card-header"><h3><WalletCards size={18}/> Add Expense</h3></div><div className="form-row"><div className="form-group"><label>Category</label><select value={expenseForm.category} onChange={e=>setExpenseForm(p=>({...p,category:e.target.value}))}><option>Supplies</option><option>Fuel</option><option>Advertising</option><option>Equipment</option><option>Insurance</option><option>Rent</option><option>Software</option><option>Payroll</option><option>Other</option></select></div><div className="form-group"><label>Amount</label><input required type="number" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm(p=>({...p,amount:e.target.value}))}/></div></div><div className="form-group"><label>Description</label><input required value={expenseForm.description} onChange={e=>setExpenseForm(p=>({...p,description:e.target.value}))}/></div><div className="form-group"><label>Date</label><input type="date" value={expenseForm.expense_date} onChange={e=>setExpenseForm(p=>({...p,expense_date:e.target.value}))}/></div><label className="ops-checkbox"><input type="checkbox" checked={expenseForm.recurring} onChange={e=>setExpenseForm(p=>({...p,recurring:e.target.checked}))}/> Recurring expense</label><button className="btn-primary btn-full">Add Expense</button></form>
      </div>
      <div className="admin-card"><div className="admin-card-header"><h3><Users size={18}/> Employee Income</h3><span className="ops-muted">Estimates — not tax withholding or payroll filing</span></div><div className="data-table"><div className="data-table-head ops-five"><span>Employee</span><span>Weekly</span><span>Monthly</span><span>Lifetime</span><span>Pay Structure</span></div>{employees.map(e=>{const w=employeeIncome(e,startOfWeek);const m=employeeIncome(e,startOfMonth);const l=employeeIncome(e);return <div className="data-table-row ops-five" key={e.id}><div className="dt-cell"><strong>{e.name}</strong><span>{roleLabel(e.role)} · Level {e.employment_level||1}</span></div><strong className="dt-cell">{money(Math.round(w.total))}</strong><strong className="dt-cell">{money(Math.round(m.total))}</strong><strong className="dt-cell">{money(Math.round(l.total))}</strong><span className="dt-cell">{compensationSummary(e)}</span></div>})}</div></div>
      <div className="admin-card"><div className="admin-card-header"><h3>Expense History</h3><strong>{money(Math.round(totalExpenses))} tracked</strong></div><div className="ops-list">{expenses.slice(0,100).map(e=><div className="ops-list-row" key={e.id}><div className="ops-primary"><strong>{e.description}</strong><span>{e.category}{e.recurring?' · recurring':''}</span></div><strong>{money(Number(e.amount))}</strong><span>{new Date(`${e.expense_date}T12:00:00`).toLocaleDateString()}</span><div className="ops-actions"><button className="btn-sm btn-outline" onClick={async()=>{await supabase.from('expenses').delete().eq('id',e.id);setExpenses(p=>p.filter(x=>x.id!==e.id));}}><Trash2 size={13}/></button></div></div>)}</div></div>
    </div>
  );
}
