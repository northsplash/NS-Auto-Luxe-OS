export type PortalRole = 'owner' | 'manager' | 'employee' | 'd2d' | 'recruiter' | 'finance' | 'customer';

export const PERMISSION_GROUPS = [
  {
    label: 'Customers & Appointments',
    permissions: [
      ['crm.view', 'View customer CRM'],
      ['appointments.view', 'View all appointments'],
      ['appointments.manage', 'Confirm, decline, assign and edit appointments'],
    ],
  },
  {
    label: 'Team & Scheduling',
    permissions: [
      ['employees.view', 'View employees'],
      ['employees.manage', 'Add/edit employees and levels'],
      ['schedule.view', 'View team schedule'],
      ['schedule.manage', 'Change shifts and approve time off'],
      ['timecards.view', 'View team timecards'],
      ['timecards.manage', 'Edit and approve timecards'],
      ['payroll.approve', 'Close/approve payroll periods'],
    ],
  },
  {
    label: 'Recruiting & Documents',
    permissions: [
      ['recruiting.manage', 'Manage applicants and interviews'],
      ['documents.manage', 'Manage employee/recruiting documents'],
    ],
  },
  {
    label: 'D2D / Leads',
    permissions: [
      ['sales.view', 'View sales performance'],
      ['sales.manage', 'Create/edit sales records'],
      ['leads.view_all', 'View all field leads and rep locations'],
      ['leads.manage', 'Create/reassign/edit all leads'],
      ['territories.manage', 'Create and assign territories'],
    ],
  },
  {
    label: 'Operations',
    permissions: [
      ['inventory.view', 'View inventory'],
      ['inventory.manage', 'Adjust inventory'],
      ['equipment.view', 'View equipment/assets'],
      ['equipment.manage', 'Manage equipment/assets'],
      ['tasks.view_all', 'View all team tasks'],
      ['tasks.manage', 'Create/reassign team tasks'],
      ['notifications.manage', 'Send/manage notifications'],
    ],
  },
  {
    label: 'Finance & Owner Controls',
    permissions: [
      ['finance.view', 'View revenue, expenses and finance reports'],
      ['finance.manage', 'Add/edit expenses and finance data'],
      ['pay.view', 'View pay structure'],
      ['pay.manage', 'Change pay structure'],
      ['company_value.manage', 'View/change company value'],
      ['permissions.manage', 'Assign portals and permissions'],
      ['audit.view', 'View audit log'],
    ],
  },
] as const;

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(group => group.permissions.map(([key]) => key));

const keys = (...items: string[]) => Object.fromEntries(items.map(key => [key, true]));

export const DEFAULT_ROLE_PERMISSIONS: Record<PortalRole, Record<string, boolean>> = {
  owner: Object.fromEntries(ALL_PERMISSION_KEYS.map(key => [key, true])),
  manager: keys(
    'crm.view', 'appointments.view', 'appointments.manage',
    'employees.view', 'schedule.view', 'schedule.manage',
    'timecards.view', 'timecards.manage', 'recruiting.manage',
    'sales.view', 'leads.view_all', 'leads.manage', 'territories.manage',
    'inventory.view', 'inventory.manage', 'equipment.view', 'equipment.manage',
    'tasks.view_all', 'tasks.manage', 'notifications.manage'
  ),
  employee: keys('schedule.view', 'inventory.view', 'equipment.view'),
  d2d: keys('schedule.view', 'sales.view', 'sales.manage'),
  recruiter: keys('recruiting.manage', 'employees.view', 'documents.manage'),
  finance: keys('finance.view', 'finance.manage', 'pay.view', 'timecards.view'),
  customer: {},
};

export const PORTAL_PATHS: Record<PortalRole, string> = {
  owner: '/admin',
  manager: '/manager',
  employee: '/employee',
  d2d: '/d2d',
  recruiter: '/manager',
  finance: '/manager',
  customer: '/portal',
};

export function portalPath(role?: string | null) {
  return PORTAL_PATHS[(role as PortalRole) || 'customer'] ?? '/portal';
}

export function can(profile: { role?: string | null; portal_role?: string | null; permissions?: Record<string, boolean> | null } | null | undefined, key: string) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.portal_role === 'owner') return true;
  return Boolean(profile.permissions?.[key]);
}
