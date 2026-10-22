// Small coloured label. tone: neutral | ok | warn | bad | info | on
export function Badge({ tone = 'neutral', icon: Icon, children, title }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  )
}

// Green dot "Online" / grey dot "Offline".
export function StatusDot({ online, label = true, onlineText = 'Online', offlineText = 'Offline' }) {
  return (
    <span className={`status ${online ? 'online' : 'offline'}`}>
      <span className="status-dot" />
      {label && (online ? onlineText : offlineText)}
    </span>
  )
}
