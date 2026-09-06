import { workspaceRef } from '../lib/workspaceRefs'

export default function WorkspaceHero({
  tab,
  actions,
  metrics,
}: {
  tab: string
  actions?: React.ReactNode
  metrics?: { label: string; value: string }[]
}) {
  const ref = workspaceRef(tab)
  return (
    <header className="ws-hero">
      <div className="ws-hero-copy">
        <p className="ws-hero-kicker">{ref.kicker}</p>
        <h1 className="ws-hero-title">{ref.title}</h1>
        <p className="ws-hero-lead">{ref.lead}</p>
      </div>
      {actions ? <div className="ws-hero-actions">{actions}</div> : null}
      {metrics?.length ? (
        <dl className="ws-hero-metrics">
          {metrics.map(m => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  )
}
