import type { Employee } from '@/lib/supabase';

export type WorkMode = 'd2d' | 'detailer' | 'manager' | 'admin' | 'owner';

function normalizedModes(employee?: Partial<Employee> | null): string[] {
  const raw = (employee as any)?.work_modes;
  return Array.isArray(raw) ? raw.map(String) : [];
}

function roleOf(employee?: Partial<Employee> | null) {
  return String(employee?.role || '').toLowerCase();
}

export function employeeIsOwnerSeat(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const role = roleOf(employee);
  const modes = normalizedModes(employee);
  return role === 'owner' || role === 'admin' || modes.includes('owner') || employee.department === 'Ownership';
}

export function employeeCanD2D(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  const role = roleOf(employee);
  return role === 'd2d_agent' || role === 'owner' || modes.includes('d2d') || modes.includes('owner') || employee.department === 'Ownership';
}

export function employeeCanDetail(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  const role = roleOf(employee);
  return role === 'detailer' || role === 'owner' || modes.includes('detailer') || employee.department === 'Ownership';
}

export function employeeCanManage(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  const role = roleOf(employee);
  return role === 'manager' || role === 'admin' || role === 'owner' || modes.includes('manager') || modes.includes('admin') || modes.includes('owner') || employee.department === 'Ownership';
}

export function employeeCanTakeLeads(employee?: Partial<Employee> | null) {
  if (!employee || employee.status === 'inactive') return false;
  return employeeCanD2D(employee) || roleOf(employee) === 'manager' || employeeIsOwnerSeat(employee);
}

export function leadRepLabel(employee?: Partial<Employee> | null) {
  const name = employee?.name || 'Unnamed';
  if (employeeIsOwnerSeat(employee)) return `${name} · Owner`;
  if (roleOf(employee) === 'manager') return `${name} · Manager`;
  return name;
}

export function leadAssignableEmployees(employees: Employee[]) {
  return employees.filter((employee) => employee.status === 'active' && employeeCanTakeLeads(employee));
}

export function selfEmployeeForUser(employees: Employee[], userId?: string | null, email?: string | null) {
  const active = employees.filter((employee) => employee.status === 'active');
  if (userId) {
    const linked = active.find((employee) => employee.user_id === userId);
    if (linked) return linked;
  }
  const needle = String(email || '').trim().toLowerCase();
  if (needle) {
    const byEmail = active.find((employee) => String(employee.email || '').trim().toLowerCase() === needle);
    if (byEmail) return byEmail;
  }
  return undefined;
}

export function workModeLabel(employee?: Partial<Employee> | null) {
  const parts: string[] = [];
  if (employeeCanD2D(employee)) parts.push('D2D');
  if (employeeCanDetail(employee)) parts.push('Detailing');
  if (employeeCanManage(employee)) parts.push('Management');
  return parts.join(' + ') || 'General';
}
