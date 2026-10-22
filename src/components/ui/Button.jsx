import { Link } from 'react-router-dom'

const cls = (variant, size, block, icon, children, className) =>
  ['btn', variant && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', icon && !children && 'btn-icon', className].filter(Boolean).join(' ')

// <Button variant="primary" icon={Plus}>Add room</Button>. Variants: primary, on, danger, ghost (default: secondary).
export function Button({ variant, size, block, icon: Icon, children, className, type = 'button', ...rest }) {
  return (
    <button type={type} className={cls(variant, size, block, Icon, children, className)} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </button>
  )
}

// Same look as Button, but navigates.
export function LinkButton({ to, variant, size, block, icon: Icon, children, className, ...rest }) {
  return (
    <Link to={to} className={cls(variant, size, block, Icon, children, className)} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </Link>
  )
}
