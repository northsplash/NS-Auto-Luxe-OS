import type { ReactNode } from 'react';
import { BRAND_LOCKUP } from '@/lib/brand';

const HERO = 'https://images.pexels.com/photos/27968215/pexels-photo-27968215.jpeg?auto=compress&cs=tinysrgb&w=1600';

const PORTALS = [
  { label: 'Owner', hint: 'Command' },
  { label: 'D2D', hint: 'Doors' },
  { label: 'Detail', hint: 'Jobs' },
  { label: 'Manager', hint: 'Dispatch' },
  { label: 'Customer', hint: 'Book' },
] as const;

export default function AuthShell({
  children,
  skipLabel = 'Skip to sign in',
  headline = 'One workspace for Owner, D2D, Detail, Manager, and customers.',
}: {
  children: ReactNode;
  skipLabel?: string;
  headline?: string;
}) {
  return (
    <div className="auth-page nsos-cream">
      <a className="skip-to-workspace" href="#auth-form">{skipLabel}</a>
      <div className="auth-bg">
        <img src={HERO} alt="" />
        <div className="auth-bg-overlay" />
        <div className="auth-bg-copy">
          <img className="auth-hero-lockup" src={BRAND_LOCKUP} alt="NS Auto Luxe Premium Detailing" />
          <span>NORTH SPLASH AUTO LUXE</span>
          <p>{headline}</p>
          <div className="auth-portals" aria-label="Portals in this OS">
            {PORTALS.map((portal) => (
              <span key={portal.label}>
                <strong>{portal.label}</strong>
                <small>{portal.hint}</small>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-card">{children}</div>
    </div>
  );
}
