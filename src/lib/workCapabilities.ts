import type { Employee } from '@/lib/supabase';

export type WorkMode = 'd2d' | 'detailer' | 'manager' | 'admin' | 'owner';

function normalizedModes(employee?: Partial<Employee> | null): string[] {
  const raw = (employee as any)?.work_modes;
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function employeeCanD2D(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  return employee.role === 'd2d_agent' || modes.includes('d2d') || employee.department === 'Ownership';
}

export function employeeCanDetail(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  return employee.role === 'detailer' || modes.includes('detailer') || employee.department === 'Ownership';
}

export function employeeCanManage(employee?: Partial<Employee> | null) {
  if (!employee) return false;
  const modes = normalizedModes(employee);
  return employee.role === 'manager' || employee.role === 'admin' || modes.includes('manager') || modes.includes('admin') || employee.department === 'Ownership';
}

export function workModeLabel(employee?: Partial<Employee> | null) {
  const parts: string[] = [];
  if (employeeCanD2D(employee)) parts.push('D2D');
  if (employeeCanDetail(employee)) parts.push('Detailing');
  if (employeeCanManage(employee)) parts.push('Management');
  return parts.join(' + ') || 'General';
}
