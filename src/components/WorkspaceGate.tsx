import { Link } from 'react-router-dom';
import { BRAND_LOGO } from '@/lib/brand';

export default function WorkspaceGate({
  title,
  body,
  busy,
  homeHref = '/login',
  homeLabel = 'Sign in',
}: {
  title: string;
  body: string;
  busy?: boolean;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="workspace-gate nsos-cream">
      <span className="eyebrow">North Splash Auto Luxe</span>
      <img className="auth-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
      {busy && <div className="portal-spinner" aria-hidden />}
      <strong>{title}</strong>
      <p>{body}</p>
      {!busy && <Link className="btn-outline" to={homeHref}>{homeLabel}</Link>}
    </div>
  );
}
