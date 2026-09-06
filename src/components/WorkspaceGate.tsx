import { Link } from 'react-router-dom';
import { BRAND_LOGO } from '@/lib/brand';

export default function WorkspaceGate({
  title,
  body,
  busy,
  homeHref = '/login',
  homeLabel = 'Sign in',
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  busy?: boolean;
  homeHref?: string;
  homeLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="workspace-gate nsos-cream">
      <span className="eyebrow">North Splash Auto Luxe</span>
      <img className="auth-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
      {busy && <div className="portal-spinner" aria-hidden />}
      <strong>{title}</strong>
      <p>{body}</p>
      {!busy && (
        <div className="workspace-gate-actions">
          <Link className="btn-primary" to={homeHref}>{homeLabel}</Link>
          {secondaryHref && secondaryLabel && (
            <Link className="btn-outline" to={secondaryHref}>{secondaryLabel}</Link>
          )}
        </div>
      )}
    </div>
  );
}
