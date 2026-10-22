import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

const ICONS = { info: Info, ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert }

// Message box. tone: info | ok | warn | bad
export function Alert({ tone = 'info', title, children, action }) {
  if (!children && !title) return null
  const Icon = ICONS[tone]
  return (
    <div className={`alert alert-${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon aria-hidden="true" />
      <div className="alert-body">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  )
}

// List of warnings (e.g. load above the relay rating), shown, never hidden.
export function Warnings({ list, title }) {
  if (!list?.length) return null
  return (
    <Alert tone="warn" title={title}>
      <ul className="plain-list">
        {list.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </Alert>
  )
}
