import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'

export function Brand({ onClick }) {
  return (
    <Link to="/" className="brand" onClick={onClick}>
      <span className="brand-logo">
        <Lightbulb aria-hidden="true" />
      </span>
      <span>
        <span className="brand-name">ACLS</span>
        <span className="brand-sub" style={{ display: 'block' }}>
          Classroom lighting
        </span>
      </span>
    </Link>
  )
}
