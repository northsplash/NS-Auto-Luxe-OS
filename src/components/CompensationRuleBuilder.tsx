import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { compensationPlan, cryptoId, ruleDefaultLabel, type CompensationPlan, type CompensationRule, type CompensationRuleType } from '@/lib/compensation';

const TYPES:{value:CompensationRuleType;label:string;unit:'amount'|'rate';threshold?:boolean}[]=[
  {value:'weekly_base',label:'Weekly base / draw',unit:'amount'},
  {value:'hourly_bonus',label:'Hourly premium',unit:'amount'},
  {value:'shift_differential',label:'Shift / weekend differential',unit:'amount'},
  {value:'revenue_percent',label:'Revenue commission %',unit:'rate',threshold:true},
  {value:'gross_profit_percent',label:'Gross-profit commission %',unit:'rate',threshold:true},
  {value:'team_override_percent',label:'Team revenue override %',unit:'rate',threshold:true},
  {value:'flat_per_sale',label:'Flat amount per sale',unit:'amount'},
  {value:'per_job',label:'Flat amount per completed job',unit:'amount'},
  {value:'membership_bonus',label:'Membership sale bonus',unit:'amount'},
  {value:'monthly_bonus',label:'Monthly recurring bonus',unit:'amount'},
  {value:'one_time_bonus',label:'One-time bonus',unit:'amount'},
  {value:'monthly_stipend',label:'Monthly stipend',unit:'amount'},
  {value:'hourly_plus_commission',label:'Hourly + commission mix',unit:'rate',threshold:true},
  {value:'salary_plus_commission',label:'Salary + commission mix',unit:'rate',threshold:true},
];

export default function CompensationRuleBuilder({value,onChange,compact=false}:{value:unknown;onChange:(next:CompensationPlan)=>void;compact?:boolean}){
  const plan=compensationPlan(value); const rules=plan.rules||[];
  const patch=(id:string,next:Partial<CompensationRule>)=>onChange({...plan,rules:rules.map(r=>r.id===id?{...r,...next}:r)});
  const add=()=>{const type:CompensationRuleType='weekly_base';onChange({...plan,rules:[...rules,{id:cryptoId(),type,label:ruleDefaultLabel(type),amount:0,rate:0,enabled:true,threshold:0}]})};
  return <div className={`comp-rule-builder-v26 comp-rule-builder-v27 ${compact?'compact':''}`}>
    <div className="comp-rule-head"><div><SlidersHorizontal size={16}/><span><strong>Custom compensation rules</strong><small>Stack bonuses, commissions, draws, overrides and specialty pay in any combination.</small></span></div><button type="button" className="btn-outline btn-sm" onClick={add}><Plus size={14}/>Add Rule</button></div>
    {rules.map((r,i)=>{const meta=TYPES.find(t=>t.value===r.type)||TYPES[0];return <div className="comp-rule-row comp-rule-row-v27" key={r.id}>
      <label className="comp-rule-toggle"><input type="checkbox" checked={r.enabled!==false} onChange={e=>patch(r.id,{enabled:e.target.checked})}/><span/></label>
      <div className="comp-rule-fields">
        <select value={r.type} onChange={e=>{const type=e.target.value as CompensationRuleType;patch(r.id,{type,label:ruleDefaultLabel(type)})}}>{TYPES.map(t=><option value={t.value} key={t.value}>{t.label}</option>)}</select>
        <input value={r.label} onChange={e=>patch(r.id,{label:e.target.value})} placeholder="Rule label"/>
        {meta.unit==='rate'?<div className="comp-rule-value"><input type="number" min="0" max="100" step=".25" value={Number(r.rate||0)} onChange={e=>patch(r.id,{rate:Number(e.target.value)})}/><span>%</span></div>:<div className="comp-rule-value"><span>$</span><input type="number" min="0" step=".25" value={Number(r.amount||0)} onChange={e=>patch(r.id,{amount:Number(e.target.value)})}/></div>}
        {meta.threshold&&<label className="comp-inline-field-v27"><span>Starts after</span><div className="comp-rule-value"><span>$</span><input type="number" min="0" step="100" value={Number(r.threshold||0)} onChange={e=>patch(r.id,{threshold:Number(e.target.value)})}/></div></label>}
        <label className="comp-inline-field-v27"><span>From</span><input type="date" value={r.effective_from||''} onChange={e=>patch(r.id,{effective_from:e.target.value||null})}/></label>
        <label className="comp-inline-field-v27"><span>Through</span><input type="date" value={r.effective_to||''} onChange={e=>patch(r.id,{effective_to:e.target.value||null})}/></label>
        <input className="comp-rule-note-v27" value={r.notes||''} onChange={e=>patch(r.id,{notes:e.target.value})} placeholder="Optional rule notes / eligibility"/>
      </div>
      <button type="button" className="comp-rule-delete" aria-label={`Delete rule ${i+1}`} onClick={()=>onChange({...plan,rules:rules.filter(x=>x.id!==r.id)})}><Trash2 size={15}/></button>
    </div>})}
    {!rules.length&&<div className="comp-rule-empty">No extra rules. Add one for bonuses, custom commissions, draws, team overrides or specialty pay.</div>}
    <div className="comp-plan-meta-v27"><label>Plan effective date<input type="date" value={plan.effective_date||''} onChange={e=>onChange({...plan,effective_date:e.target.value||null})}/></label></div>
    <div className="comp-rule-limits">
      <label>Weekly guarantee floor<div><span>$</span><input type="number" min="0" step="25" value={Number(plan.guarantee_floor_weekly||0)} onChange={e=>onChange({...plan,guarantee_floor_weekly:Number(e.target.value)})}/></div></label>
      <label>Weekly cap (0 = none)<div><span>$</span><input type="number" min="0" step="25" value={Number(plan.cap_weekly||0)} onChange={e=>onChange({...plan,cap_weekly:Number(e.target.value)})}/></div></label>
    </div>
  </div>;
}
