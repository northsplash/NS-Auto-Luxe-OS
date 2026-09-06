import { supabase } from '@/lib/supabase';
import type { PortalRole } from '@/lib/permissions';

export function portalRoleFromPosition(position?: string | null): PortalRole {
  const p = String(position || '').toLowerCase();
  if (p.includes('d2d')) return 'd2d';
  if (p.includes('manager')) return 'manager';
  return 'employee';
}

export function portalLabelForRole(role: PortalRole) {
  if (role === 'd2d') return 'D2D';
  if (role === 'manager') return 'Manager';
  if (role === 'owner') return 'Owner';
  return 'Detail';
}

export async function inviteEmployeeLogin(employeeId: string, portal_role: PortalRole) {
  return supabase.functions.invoke('invite-employee', {
    body: {
      employee_id: employeeId,
      portal_role,
      redirect_to: `${window.location.origin}/reset-password`,
    },
  });
}

export function hireInviteMessage(
  name: string,
  email: string | null | undefined,
  portal_role: PortalRole,
  data: { error?: string; action_link?: string; emailed?: boolean } | null | undefined,
  error: { message?: string } | null | undefined,
) {
  const dest = portalLabelForRole(portal_role);
  if (!email) {
    return `Hired ${name}. Add an email in People → Permissions to send the ${dest} invite.`;
  }
  const fail = error?.message || data?.error;
  if (fail) {
    return `Hired ${name}. Invite did not send: ${fail}. Send it from People → Permissions.`;
  }
  if (data?.action_link) {
    return `Hired ${name}. Email did not send — copy this setup link for ${email}:\n${data.action_link}`;
  }
  if (data?.emailed) {
    return `Hired ${name}. Invite emailed to ${email}. They set a password and land in ${dest}.`;
  }
  return `Hired ${name}. Login linked for ${dest}.`;
}
