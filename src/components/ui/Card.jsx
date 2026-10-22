// A white panel. Optional title row with description and actions on the right.
export function Card({ title, icon: Icon, description, actions, children, className = '', flush, ...rest }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-head" style={flush ? { padding: '18px 20px 0' } : undefined}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <h2>
                {Icon && <Icon size={19} aria-hidden="true" />}
                {title}
              </h2>
            )}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
