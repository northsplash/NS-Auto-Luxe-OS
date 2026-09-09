import { Link } from 'react-router-dom';
import { BRAND_LOCKUP } from '@/lib/brand';

export default function WorkspaceGate({
  title,
  body,
  busy,
  homeHref = '/login',
  homeLabel = 'Sign in',
  secondaryHref,
  secondaryLabel,
  onRetry,
  retryLabel = 'Retry',
}: {
  title: string;
  body: string;
  busy?: boolean;
  homeHref?: string;
  homeLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="workspace-gate nsos-cream">
      <span className="eyebrow">North Splash Auto Luxe</span>
      <img className="auth-brand-logo" src={BRAND_LOCKUP} alt="NS Auto Luxe Premium Detailing" />
      {busy && <div className="portal-spinner" aria-hidden />}
      <strong>{title}</strong>
      <p>{body}</p>
      {!busy && (
        <div className="workspace-gate-actions">
          {onRetry && <button type="button" className="btn-primary" onClick={onRetry}>{retryLabel}</button>}
          <Link className={onRetry ? 'btn-outline' : 'btn-primary'} to={homeHref}>{homeLabel}</Link>
          {secondaryHref && secondaryLabel && (
            <Link className="btn-outline" to={secondaryHref}>{secondaryLabel}</Link>
          )}
        </div>
      )}
    </div>
  );
}
