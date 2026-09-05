import type { Employee } from '@/lib/supabase';

export type CompensationRuleType =
  | 'hourly_bonus'
  | 'weekly_base'
  | 'revenue_percent'
  | 'gross_profit_percent'
  | 'flat_per_sale'
  | 'per_job'
  | 'membership_bonus'
  | 'monthly_bonus'
  | 'one_time_bonus'
  | 'shift_differential'
  | 'team_override_percent'
  | 'monthly_stipend'
  | 'hourly_plus_commission'
  | 'salary_plus_commission';

export type CompensationRule = {
  id: string;
  type: CompensationRuleType;
  label: string;
  amount?: number;
  rate?: number;
  enabled?: boolean;
  notes?: string;
  threshold?: number;
  effective_from?: string | null;
  effective_to?: string | null;
};

export type CompensationPlan = {
  rules?: CompensationRule[];
  effective_date?: string | null;
  guarantee_floor_weekly?: number;
  cap_weekly?: number;
};

export function compensationPlan(value: unknown): CompensationPlan {
  if (!value || typeof value !== 'object') return { rules: [] };
  const raw=value as any;
  return {
    ...raw,
    rules: Array.isArray(raw.rules) ? raw.rules.filter((r:any)=>r && typeof r==='object').map((r:any)=>({
      id:String(r.id||cryptoId()),
      type:String(r.type||'weekly_base') as CompensationRuleType,
      label:String(r.label||ruleDefaultLabel(String(r.type||'weekly_base') as CompensationRuleType)),
      amount:Number(r.amount||0),
      rate:Number(r.rate||0),
      enabled:r.enabled!==false,
      notes:r.notes?String(r.notes):'',
      threshold:Number(r.threshold||0),
      effective_from:r.effective_from?String(r.effective_from):null,
      effective_to:r.effective_to?String(r.effective_to):null,
    })) : [],
  };
}
export function cryptoId(){return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
export function ruleDefaultLabel(type:CompensationRuleType){
  const labels:Record<CompensationRuleType,string>={
    hourly_bonus:'Hourly premium',weekly_base:'Weekly base',revenue_percent:'Revenue commission',
    gross_profit_percent:'Gross-profit commission',flat_per_sale:'Flat sale bonus',per_job:'Per-job pay',
    membership_bonus:'Membership bonus',monthly_bonus:'Monthly bonus',one_time_bonus:'One-time bonus',
    shift_differential:'Shift differential',team_override_percent:'Team revenue override',
    monthly_stipend:'Monthly stipend',hourly_plus_commission:'Hourly + commission',
    salary_plus_commission:'Salary + commission'
  }; return labels[type];
}
export function describeRule(r:CompensationRule){
  const threshold=Number(r.threshold||0)>0?` after $${Number(r.threshold).toLocaleString()}`:'';
  if(['revenue_percent','gross_profit_percent','team_override_percent'].includes(r.type))return `${Number(r.rate||0)}% ${r.type==='revenue_percent'?'revenue':r.type==='gross_profit_percent'?'gross profit':'team revenue'}${threshold}`;
  if(r.type==='hourly_bonus')return `$${Number(r.amount||0).toFixed(2)}/hr premium`;
  if(r.type==='shift_differential')return `$${Number(r.amount||0).toFixed(2)}/eligible hour`;
  if(r.type==='flat_per_sale')return `$${Number(r.amount||0).toFixed(2)}/sale`;
  if(r.type==='per_job')return `$${Number(r.amount||0).toFixed(2)}/job`;
  if(r.type==='membership_bonus')return `$${Number(r.amount||0).toFixed(2)}/membership`;
  if(r.type==='monthly_bonus')return `$${Number(r.amount||0).toFixed(2)}/month`;
  if(r.type==='one_time_bonus')return `$${Number(r.amount||0).toFixed(2)} one-time`;
  if(r.type==='monthly_stipend')return `$${Number(r.amount||0).toFixed(2)}/month stipend`;
  if(r.type==='hourly_plus_commission')return `$${Number(r.amount||0).toFixed(2)}/hr + ${Number(r.rate||0)}%`;
  if(r.type==='salary_plus_commission')return `$${Number(r.amount||0).toLocaleString()}/yr + ${Number(r.rate||0)}%`;
  return `$${Number(r.amount||0).toFixed(2)}/week`;
}
function ruleActiveOn(r:CompensationRule, asOf?:string|Date){
  if(r.enabled===false)return false;
  const at=asOf?new Date(asOf).getTime():Date.now();
  if(r.effective_from&&at<new Date(r.effective_from).getTime())return false;
  if(r.effective_to&&at>new Date(r.effective_to).getTime()+86400000-1)return false;
  return true;
}
export function estimateCustomRulePay(planValue:unknown, ctx:{
  hours?:number; eligibleShiftHours?:number; salesRevenue?:number; teamRevenue?:number; grossProfit?:number; salesCount?:number; jobs?:number; memberships?:number; months?:number; weeks?:number; includeOneTime?:boolean; asOf?:string|Date;
}){
  const plan=compensationPlan(planValue); let total=0;
  for(const r of plan.rules||[]){if(!ruleActiveOn(r,ctx.asOf))continue;
    if(r.type==='hourly_bonus')total+=Number(ctx.hours||0)*Number(r.amount||0);
    if(r.type==='shift_differential')total+=Number(ctx.eligibleShiftHours??ctx.hours??0)*Number(r.amount||0);
    if(r.type==='weekly_base')total+=Number(ctx.weeks??1)*Number(r.amount||0);
    if(r.type==='revenue_percent'){const base=Math.max(0,Number(ctx.salesRevenue||0)-Number(r.threshold||0));total+=base*(Number(r.rate||0)/100)}
    if(r.type==='team_override_percent'){const base=Math.max(0,Number(ctx.teamRevenue||0)-Number(r.threshold||0));total+=base*(Number(r.rate||0)/100)}
    if(r.type==='gross_profit_percent'){const base=Math.max(0,Number(ctx.grossProfit||0)-Number(r.threshold||0));total+=base*(Number(r.rate||0)/100)}
    if(r.type==='flat_per_sale')total+=Number(ctx.salesCount||0)*Number(r.amount||0);
    if(r.type==='per_job')total+=Number(ctx.jobs||0)*Number(r.amount||0);
    if(r.type==='membership_bonus')total+=Number(ctx.memberships||0)*Number(r.amount||0);
    if(r.type==='monthly_bonus')total+=Number(ctx.months??0)*Number(r.amount||0);
    if(r.type==='one_time_bonus'&&ctx.includeOneTime)total+=Number(r.amount||0);
    if(r.type==='monthly_stipend')total+=Number(ctx.months??0)*Number(r.amount||0);
    if(r.type==='hourly_plus_commission'){
      total+=Number(ctx.hours||0)*Number(r.amount||0);
      total+=Math.max(0,Number(ctx.salesRevenue||0)-Number(r.threshold||0))*(Number(r.rate||0)/100);
    }
    if(r.type==='salary_plus_commission'){
      total+=(Number(r.amount||0)/52)*Number(ctx.weeks??1);
      total+=Math.max(0,Number(ctx.salesRevenue||0)-Number(r.threshold||0))*(Number(r.rate||0)/100);
    }
  }
  const weeks=Number(ctx.weeks??1);
  const floor=Number(plan.guarantee_floor_weekly||0)*weeks;
  const cap=Number(plan.cap_weekly||0)*weeks;
  if(floor>0) total=Math.max(total,floor);
  if(cap>0) total=Math.min(total,cap);
  return total;
}
export function compensationSummary(emp:Pick<Employee,'pay_type'|'hourly_rate'|'annual_salary'|'weekly_base'|'commission_rate'|'per_job_rate'|'custom_compensation'>){
  const parts:string[]=[]; const t=emp.pay_type||'hourly';
  if(['hourly','hourly_plus_commission','custom'].includes(t)&&Number(emp.hourly_rate||0)>0)parts.push(`$${Number(emp.hourly_rate).toFixed(2)}/hr`);
  if(['salary','salary_plus_commission','custom'].includes(t)&&Number(emp.annual_salary||0)>0)parts.push(`$${Math.round(Number(emp.annual_salary)).toLocaleString()}/yr`);
  if(['base_commission','custom'].includes(t)&&Number(emp.weekly_base||0)>0)parts.push(`$${Number(emp.weekly_base).toFixed(0)}/wk`);
  if(['base_commission','commission_only','hourly_plus_commission','salary_plus_commission','custom'].includes(t)&&Number(emp.commission_rate||0)>0)parts.push(`${Number(emp.commission_rate)}% comm.`);
  if(['per_job','custom'].includes(t)&&Number(emp.per_job_rate||0)>0)parts.push(`$${Number(emp.per_job_rate).toFixed(0)}/job`);
  const extra=(compensationPlan(emp.custom_compensation).rules||[]).filter(r=>r.enabled!==false);
  if(extra.length)parts.push(`+${extra.length} custom rule${extra.length===1?'':'s'}`);
  return parts.join(' · ')||'Custom compensation';
}
