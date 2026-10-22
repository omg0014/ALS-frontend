// Small building blocks: spinner, loading line, empty state, tabs, stat card.

export function Spinner({ label = 'Working' }) {
  return <span className="spinner" role="status" aria-label={label} />
}

// Shown while a page fetches its data.
export function Loading({ children = 'Loading…' }) {
  return (
    <p className="loading">
      <Spinner label="Loading" />
      {children}
    </p>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon aria-hidden="true" />
        </div>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

// tabs: [{ id, label, icon }]
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} className={`tab ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
          {Icon && <Icon aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  )
}

// tone: default | on | ok | bad
export function StatCard({ icon: Icon, label, value, total, sub, tone = '' }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <div className="stat-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value}
          {total != null && <small> / {total}</small>}
        </div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}
