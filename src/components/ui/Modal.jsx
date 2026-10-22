import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

// Dialog window. Closes on Escape or a click outside.
export function Modal({ title, description, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
        </div>
        {children}
      </div>
    </div>
  )
}
