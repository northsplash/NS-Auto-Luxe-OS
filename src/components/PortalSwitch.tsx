import { Link, useLocation } from 'react-router-dom';
import { Car, ShieldCheck, Target, Users } from 'lucide-react';

export type LivePortalId = 'owner' | 'd2d' | 'employee' | 'manager';

export const LIVE_PORTALS: {
  id: LivePortalId;
  href: string;
  label: string;
  hint: string;
  Icon: typeof ShieldCheck;
}[] = [
  { id: 'owner', href: '/owner', label: 'Owner', hint: 'Command', Icon: ShieldCheck },
  { id: 'd2d', href: '/d2d', label: 'D2D', hint: 'Canvass', Icon: Target },
  { id: 'employee', href: '/employee', label: 'Detail', hint: 'Run jobs', Icon: Car },
  { id: 'manager', href: '/manager', label: 'Manager', hint: 'Dispatch', Icon: Users },
];

export function livePortalFromPath(pathname: string): LivePortalId {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path.startsWith('/d2d')) return 'd2d';
  if (path.startsWith('/employee')) return 'employee';
  if (path.startsWith('/manager')) return 'manager';
  return 'owner';
}

export function canSwitchLivePortals(role?: string | null) {
  return role === 'owner';
}

function useLivePortal() {
  const { pathname } = useLocation();
  return livePortalFromPath(pathname);
}

export function PortalSwitchGrid({ allow }: { allow: boolean }) {
  const current = useLivePortal();
  if (!allow) return null;
  return (
    <nav className="owner-field-switch-v26 portal-switch-grid" aria-label="Switch portal">
      <span>Portals</span>
      <div>
        {LIVE_PORTALS.map(({ id, href, label, hint, Icon }) => (
          <Link
            key={id}
            to={href}
            className={`owner-field-mode-btn${current === id ? ' active' : ''}`}
            aria-current={current === id ? 'page' : undefined}
          >
            <Icon size={16} />
            <strong>{label}</strong>
            <small>{hint}</small>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PortalSwitchRail({ allow }: { allow: boolean }) {
  const current = useLivePortal();
  if (!allow) return null;
  return (
    <nav className="portal-switch-rail" aria-label="Switch portal">
      {LIVE_PORTALS.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          to={href}
          className={current === id ? 'active' : ''}
          aria-current={current === id ? 'page' : undefined}
        >
          <Icon size={14} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

const FIELD_LABEL: Record<Exclude<LivePortalId, 'owner'>, string> = {
  d2d: 'D2D field',
  employee: 'Detailer',
  manager: 'Manager',
};

export function BackToOwnerBanner({ allow, ownerHref = '/owner' }: { allow: boolean; ownerHref?: string }) {
  const current = useLivePortal();
  if (!allow || current === 'owner') return null;
  return (
    <div className="os-mode-banner portal-switch-banner">
      <div>
        <strong>{FIELD_LABEL[current]} portal</strong>
        <span>Return to Owner or switch portals without signing out.</span>
      </div>
      <Link className="portal-switch-back" to={ownerHref}>Back to Owner</Link>
    </div>
  );
}

export function TopbarOwnerLink({ allow, ownerHref = '/owner' }: { allow: boolean; ownerHref?: string }) {
  const current = useLivePortal();
  if (!allow || current === 'owner') return null;
  return (
    <Link className="portal-switch-topbar" to={ownerHref} aria-label="Back to Owner portal">
      <ShieldCheck size={16} />
      <span>Owner</span>
    </Link>
  );
}
