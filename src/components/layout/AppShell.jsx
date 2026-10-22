import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { KeyRound, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { ROLE_LABELS } from '../../lib/labels.js'
import { Button } from '../ui/index.js'
import { Brand } from './Brand.jsx'
import { ChangePasswordModal } from './ChangePasswordModal.jsx'
import { NAVIGATION } from './navigation.js'
import { ThemeSwitch } from './ThemeSwitch.jsx'

// Sidebar on desktop, slide-out menu on phones; page content on the right.
export function AppShell({ children }) {
  const { user, logout } = useAuth()
  const { connected } = useLive()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const page = useRef(null)

  // New page: close the phone menu, start at the top and fade the content in (no remount, so page state is kept)
  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    page.current?.animate?.([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  }, [location.pathname])

  const linkClass = (item) => ({ isActive }) =>
    `nav-link ${isActive && !item.exclude?.some((p) => location.pathname.startsWith(p)) ? 'active' : ''}`

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <div className="topbar">
        <Button variant="ghost" icon={Menu} aria-label="Open menu" onClick={() => setMenuOpen(true)} />
        <Brand />
        <span className={`status ${connected ? 'online' : 'offline'}`} title={connected ? 'Live updates on' : 'Reconnecting…'}>
          <span className="status-dot" />
        </span>
      </div>
      <div className="backdrop" onClick={() => setMenuOpen(false)} />

      <aside className="sidebar" aria-label="Main menu">
        <Brand />
        <nav>
          {NAVIGATION.map((section) => {
            const items = section.items.filter((i) => !i.roles || i.roles.includes(user.role))
            if (!items.length) return null
            return (
              <div key={section.title} className="nav-section">
                <div className="nav-title">{section.title}</div>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass(item)}>
                    <item.icon aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-tools">
            <div className="live-status">
              <span className={`status ${connected ? 'online' : 'offline'}`}>
                <span className="status-dot" />
              </span>
              {connected ? 'Live updates on' : 'Reconnecting…'}
            </div>
            <ThemeSwitch />
          </div>
          <div className="user-card">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{ROLE_LABELS[user.role]}</div>
            </div>
            <Button variant="ghost" size="sm" icon={KeyRound} title="Change password" aria-label="Change password" onClick={() => setPasswordOpen(true)} />
            <Button variant="ghost" size="sm" icon={LogOut} title="Log out" aria-label="Log out" onClick={logout} />
          </div>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner" ref={page}>
          {children}
        </div>
      </main>
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  )
}
