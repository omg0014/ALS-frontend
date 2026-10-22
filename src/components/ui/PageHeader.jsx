import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

// Title + one-line explanation at the top of every page, with optional back link and actions.
export function PageHeader({ title, description, back, actions, children }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link className="page-back" to={back.to}>
            <ChevronLeft aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}
