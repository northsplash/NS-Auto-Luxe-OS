import type { ReactNode } from 'react';

export default function PortalPageHead({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="v2-page-head">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h2>{title}</h2>
        {lead ? <p>{lead}</p> : null}
      </div>
      {children ? <div className="v2-head-actions">{children}</div> : null}
    </div>
  );
}
