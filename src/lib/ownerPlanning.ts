export type OwnerPlanningAssumptions = {
  avgTicket: number;
  jobsPerOwnerWeek: number;
  leadGrowthPct: number;
  ownerOperatedWeeks: number;
  startingDetailers: number;
  startingD2D: number;
  startingManagers: number;
  detailerWage: number;
  detailerHoursPerWeek: number;
  detailerCapacityJobs: number;
  d2dBase: number;
  d2dCommissionPct: number;
  d2dCapacityJobs: number;
  managerWage: number;
  managerHoursPerWeek: number;
  variableCostPct: number;
  fixedWeekly: number;
  taxReservePct: number;
  ownerMinPay: number;
  ownerMaxPay: number;
  startingCash: number;
  hireDetailerAtJobs: number;
  hireD2DAtJobs: number;
  managerAtEmployees: number;
  vehicleCost: number;
  vehicleReserveEveryWeeks: number;
  doorsPerJob: number;
  autoHiringEnabled: number;
};

export type OwnerWeekOverride = {
  jobs?: number;
  avgTicket?: number;
  detailers?: number;
  d2d?: number;
  managers?: number;
  detailerWage?: number;
  d2dBase?: number;
  d2dCommissionPct?: number;
  managerWage?: number;
  variableCostPct?: number;
  fixedWeekly?: number;
  extraCosts?: number;
  taxReservePct?: number;
  owner1Pay?: number;
  owner2Pay?: number;
  doors?: number;
  note?: string;
};

export type OwnerPlanningConfig = OwnerPlanningAssumptions & {
  weeklyOverrides: Record<string, OwnerWeekOverride>;
};

export type OwnerPlanWeek = {
  n: number;
  start: Date;
  end: Date;
  days: number;
  jobs: number;
  avgTicket: number;
  revenue: number;
  doors: number;
  detailers: number;
  d2d: number;
  managers: number;
  employeeCount: number;
  capacity: number;
  payroll: number;
  operating: number;
  extraCosts: number;
  profitBeforeOwners: number;
  owner1: number;
  owner2: number;
  taxReserve: number;
  netProfit: number;
  cash: number;
  event?: string;
  note?: string;
  overridden: boolean;
};

export const OWNER_PLAN_DEFAULTS: OwnerPlanningConfig = {
  avgTicket: 220,
  jobsPerOwnerWeek: 12,
  leadGrowthPct: 1.25,
  ownerOperatedWeeks: 10,
  startingDetailers: 0,
  startingD2D: 0,
  startingManagers: 0,
  detailerWage: 18,
  detailerHoursPerWeek: 32,
  detailerCapacityJobs: 14,
  d2dBase: 300,
  d2dCommissionPct: 10,
  d2dCapacityJobs: 28,
  managerWage: 22,
  managerHoursPerWeek: 40,
  variableCostPct: 12,
  fixedWeekly: 185,
  taxReservePct: 18,
  ownerMinPay: 800,
  ownerMaxPay: 1200,
  startingCash: 10000,
  hireDetailerAtJobs: 18,
  hireD2DAtJobs: 22,
  managerAtEmployees: 6,
  vehicleCost: 3500,
  vehicleReserveEveryWeeks: 26,
  doorsPerJob: 10,
  autoHiringEnabled: 1,
  weeklyOverrides: {},
};

const finite = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const nonNegative = (value: unknown, fallback: number) => Math.max(0, finite(value, fallback));
const integer = (value: unknown, fallback: number) => Math.max(0, Math.round(finite(value, fallback)));

export function normalizeOwnerPlanningConfig(raw: any): OwnerPlanningConfig {
  const merged = { ...OWNER_PLAN_DEFAULTS, ...(raw || {}) } as OwnerPlanningConfig;
  merged.avgTicket = nonNegative(merged.avgTicket, OWNER_PLAN_DEFAULTS.avgTicket);
  merged.jobsPerOwnerWeek = nonNegative(merged.jobsPerOwnerWeek, OWNER_PLAN_DEFAULTS.jobsPerOwnerWeek);
  merged.leadGrowthPct = Math.max(-25, Math.min(100, finite(merged.leadGrowthPct, OWNER_PLAN_DEFAULTS.leadGrowthPct)));
  merged.ownerOperatedWeeks = integer(merged.ownerOperatedWeeks, OWNER_PLAN_DEFAULTS.ownerOperatedWeeks);
  merged.startingDetailers = integer(merged.startingDetailers, 0);
  merged.startingD2D = integer(merged.startingD2D, 0);
  merged.startingManagers = integer(merged.startingManagers, 0);
  merged.detailerWage = nonNegative(merged.detailerWage, OWNER_PLAN_DEFAULTS.detailerWage);
  merged.detailerHoursPerWeek = nonNegative(merged.detailerHoursPerWeek, OWNER_PLAN_DEFAULTS.detailerHoursPerWeek);
  merged.detailerCapacityJobs = Math.max(1, nonNegative(merged.detailerCapacityJobs, OWNER_PLAN_DEFAULTS.detailerCapacityJobs));
  merged.d2dBase = nonNegative(merged.d2dBase, OWNER_PLAN_DEFAULTS.d2dBase);
  merged.d2dCommissionPct = Math.max(0, Math.min(100, finite(merged.d2dCommissionPct, OWNER_PLAN_DEFAULTS.d2dCommissionPct)));
  merged.d2dCapacityJobs = Math.max(1, nonNegative(merged.d2dCapacityJobs, OWNER_PLAN_DEFAULTS.d2dCapacityJobs));
  merged.managerWage = nonNegative(merged.managerWage, OWNER_PLAN_DEFAULTS.managerWage);
  merged.managerHoursPerWeek = nonNegative(merged.managerHoursPerWeek, OWNER_PLAN_DEFAULTS.managerHoursPerWeek);
  merged.variableCostPct = Math.max(0, Math.min(100, finite(merged.variableCostPct, OWNER_PLAN_DEFAULTS.variableCostPct)));
  merged.fixedWeekly = nonNegative(merged.fixedWeekly, OWNER_PLAN_DEFAULTS.fixedWeekly);
  merged.taxReservePct = Math.max(0, Math.min(100, finite(merged.taxReservePct, OWNER_PLAN_DEFAULTS.taxReservePct)));
  merged.ownerMinPay = nonNegative(merged.ownerMinPay, OWNER_PLAN_DEFAULTS.ownerMinPay);
  merged.ownerMaxPay = Math.max(merged.ownerMinPay, nonNegative(merged.ownerMaxPay, OWNER_PLAN_DEFAULTS.ownerMaxPay));
  merged.startingCash = finite(merged.startingCash, OWNER_PLAN_DEFAULTS.startingCash);
  merged.hireDetailerAtJobs = nonNegative(merged.hireDetailerAtJobs, OWNER_PLAN_DEFAULTS.hireDetailerAtJobs);
  merged.hireD2DAtJobs = nonNegative(merged.hireD2DAtJobs, OWNER_PLAN_DEFAULTS.hireD2DAtJobs);
  merged.managerAtEmployees = Math.max(1, integer(merged.managerAtEmployees, OWNER_PLAN_DEFAULTS.managerAtEmployees));
  merged.vehicleCost = nonNegative(merged.vehicleCost, OWNER_PLAN_DEFAULTS.vehicleCost);
  merged.vehicleReserveEveryWeeks = Math.max(0, integer(merged.vehicleReserveEveryWeeks, OWNER_PLAN_DEFAULTS.vehicleReserveEveryWeeks));
  merged.doorsPerJob = Math.max(1, nonNegative(merged.doorsPerJob, OWNER_PLAN_DEFAULTS.doorsPerJob));
  merged.autoHiringEnabled = merged.autoHiringEnabled ? 1 : 0;
  merged.weeklyOverrides = typeof raw?.weeklyOverrides === 'object' && raw?.weeklyOverrides ? raw.weeklyOverrides : {};
  return merged;
}

const clampOverrideNumber = (value: number | undefined, fallback: number, floor = 0) =>
  value === undefined || value === null || !Number.isFinite(Number(value)) ? fallback : Math.max(floor, Number(value));

export function buildOwnerPlan(input: OwnerPlanningConfig): OwnerPlanWeek[] {
  const a = normalizeOwnerPlanningConfig(input);
  const start = new Date(2026, 8, 30, 12);
  const finish = new Date(2028, 8, 30, 12);
  const out: OwnerPlanWeek[] = [];
  let cash = a.startingCash;
  let detailers = a.startingDetailers;
  let d2d = a.startingD2D;
  let managers = a.startingManagers;

  for (let n = 1, cursor = new Date(start); cursor <= finish; n += 1) {
    const end = new Date(Math.min(cursor.getTime() + 6 * 86400000, finish.getTime()));
    const days = Math.max(1, Math.round((end.getTime() - cursor.getTime()) / 86400000) + 1);
    const factor = days / 7;
    const override = a.weeklyOverrides[String(n)] || {};
    const ownerOnly = n <= a.ownerOperatedWeeks;
    const demand = Math.max(0, a.jobsPerOwnerWeek * Math.pow(1 + a.leadGrowthPct / 100, n - 1)) * factor;
    let event = '';

    if (override.detailers !== undefined) detailers = integer(override.detailers, detailers);
    if (override.d2d !== undefined) d2d = integer(override.d2d, d2d);
    if (override.managers !== undefined) managers = integer(override.managers, managers);

    if (!ownerOnly && a.autoHiringEnabled) {
      if (override.detailers === undefined) {
        if (detailers === 0 && demand >= a.hireDetailerAtJobs) { detailers = 1; event = 'First detailer added'; }
        const neededDetailers = Math.max(detailers, Math.ceil(Math.max(0, demand - a.jobsPerOwnerWeek) / a.detailerCapacityJobs));
        if (neededDetailers > detailers) { detailers = neededDetailers; event = event || `Detailing team grows to ${detailers}`; }
      }
      if (override.d2d === undefined) {
        if (d2d === 0 && demand >= a.hireD2DAtJobs) { d2d = 1; event = event ? `${event} · First D2D rep added` : 'First D2D rep added'; }
        const neededD2D = Math.max(d2d, Math.ceil(Math.max(0, demand - a.hireD2DAtJobs) / a.d2dCapacityJobs));
        if (neededD2D > d2d) { d2d = neededD2D; event = event || `D2D team grows to ${d2d}`; }
      }
      if (override.managers === undefined) {
        if (managers === 0 && detailers + d2d >= a.managerAtEmployees) { managers = 1; event = event ? `${event} · First manager added` : 'First manager added'; }
        const neededManagers = Math.floor((detailers + d2d) / a.managerAtEmployees);
        if (neededManagers > managers) { managers = neededManagers; event = event || `Management grows to ${managers}`; }
      }
    }

    const capacity = Math.max(0, (a.jobsPerOwnerWeek + detailers * a.detailerCapacityJobs) * factor);
    const jobs = Math.max(0, Math.round(override.jobs ?? Math.min(demand, capacity)));
    const avgTicket = clampOverrideNumber(override.avgTicket, a.avgTicket);
    const revenue = jobs * avgTicket;
    const detailerWage = clampOverrideNumber(override.detailerWage, a.detailerWage);
    const d2dBase = clampOverrideNumber(override.d2dBase, a.d2dBase);
    const d2dCommissionPct = clampOverrideNumber(override.d2dCommissionPct, a.d2dCommissionPct);
    const managerWage = clampOverrideNumber(override.managerWage, a.managerWage);
    const variableCostPct = clampOverrideNumber(override.variableCostPct, a.variableCostPct);
    const fixedWeekly = clampOverrideNumber(override.fixedWeekly, a.fixedWeekly);
    const taxReservePct = clampOverrideNumber(override.taxReservePct, a.taxReservePct);
    const extraCosts = clampOverrideNumber(override.extraCosts, 0);

    const detailerPayroll = detailers * detailerWage * a.detailerHoursPerWeek * factor;
    const d2dPayroll = d2d * d2dBase * factor + (d2d > 0 ? revenue * (d2dCommissionPct / 100) : 0);
    const managerPayroll = managers * managerWage * a.managerHoursPerWeek * factor;
    const payroll = detailerPayroll + d2dPayroll + managerPayroll;
    let operating = revenue * (variableCostPct / 100) + fixedWeekly * factor + extraCosts;
    if (!ownerOnly && a.vehicleReserveEveryWeeks > 0 && n > a.ownerOperatedWeeks && n % a.vehicleReserveEveryWeeks === 0 && override.extraCosts === undefined) {
      operating += a.vehicleCost;
      event = event ? `${event} · Vehicle/equipment reserve` : 'Vehicle/equipment reserve';
    }

    const profitBeforeOwners = revenue - operating - payroll;
    const taxReserve = Math.max(0, profitBeforeOwners) * (taxReservePct / 100);
    const distributable = Math.max(0, profitBeforeOwners - taxReserve);
    let autoEach = 0;
    if (distributable >= a.ownerMinPay * 2) autoEach = Math.min(a.ownerMaxPay, Math.floor((distributable / 2) / 50) * 50);
    else if (distributable >= 800) autoEach = Math.floor((distributable / 2) / 50) * 50;
    const owner1 = clampOverrideNumber(override.owner1Pay, autoEach);
    const owner2 = clampOverrideNumber(override.owner2Pay, autoEach);
    const netProfit = profitBeforeOwners - taxReserve - owner1 - owner2;
    cash += netProfit;
    const doors = Math.max(0, Math.round(override.doors ?? jobs * a.doorsPerJob));

    out.push({
      n, start: new Date(cursor), end, days, jobs, avgTicket, revenue, doors,
      detailers, d2d, managers, employeeCount: detailers + d2d + managers,
      capacity, payroll, operating, extraCosts, profitBeforeOwners,
      owner1, owner2, taxReserve, netProfit, cash,
      event: event || undefined, note: override.note?.trim() || undefined,
      overridden: Object.keys(override).length > 0,
    });
    cursor = new Date(end.getTime() + 86400000);
  }
  return out;
}

export const ownerMoney = (n: number, cents = false) => n.toLocaleString('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: cents ? 2 : 0,
});
export const ownerDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
