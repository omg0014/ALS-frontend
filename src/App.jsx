import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { api } from './api/client.js'
import { AuthContext } from './context/AuthContext.js'
import { LiveProvider } from './context/LiveProvider.jsx'
import { FeedbackProvider, Loading } from './components/ui/index.js'
import { AppShell } from './components/layout/AppShell.jsx'
import { isAdmin } from './lib/permissions.js'
import LoginPage from './pages/auth/LoginPage.jsx'
import DashboardPage from './pages/dashboard/DashboardPage.jsx'
import ControlPage from './pages/control/ControlPage.jsx'
import RoomsPage from './pages/rooms/RoomsPage.jsx'
import DevicesPage from './pages/devices/DevicesPage.jsx'
import DeviceDetailPage from './pages/devices/DeviceDetailPage.jsx'

// Setup and admin pages load only when opened, so the everyday pages stay fast.
const RoomInstallPage = lazy(() => import('./pages/rooms/RoomInstallPage.jsx'))
const WiringSheetPage = lazy(() => import('./pages/rooms/WiringSheetPage.jsx'))
const FirmwareWizardPage = lazy(() => import('./pages/firmware/FirmwareWizardPage.jsx'))
const HardwarePage = lazy(() => import('./pages/hardware/HardwarePage.jsx'))
const HelpPage = lazy(() => import('./pages/help/HelpPage.jsx'))
const ActivityPage = lazy(() => import('./pages/admin/ActivityPage.jsx'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'))
const CodeEditorPage = lazy(() => import('./pages/code/CodeEditorPage.jsx'))

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking the session

  useEffect(() => {
    api('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
    const onLogout = () => setUser(null)
    window.addEventListener('acls:logout', onLogout)
    return () => window.removeEventListener('acls:logout', onLogout)
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  if (user === undefined)
    return (
      <div className="splash" aria-busy="true">
        <span className="brand-logo">
          <Lightbulb aria-hidden="true" />
        </span>
      </div>
    )

  return (
    <FeedbackProvider>
      {!user ? (
        <LoginPage onLogin={setUser} />
      ) : (
        <AuthContext.Provider value={{ user, logout }}>
          <LiveProvider>
            <AppShell>
              <Suspense fallback={<Loading />}>
                <AppRoutes user={user} />
              </Suspense>
            </AppShell>
          </LiveProvider>
        </AuthContext.Provider>
      )}
    </FeedbackProvider>
  )
}

function AppRoutes({ user }) {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="/rooms" element={<RoomsPage />} />
      <Route path="/rooms/:id/install" element={<RoomInstallPage />} />
      <Route path="/rooms/:id/wiring-sheet" element={<WiringSheetPage />} />
      <Route path="/devices" element={<DevicesPage />} />
      <Route path="/devices/new" element={<FirmwareWizardPage key="new" />} />
      <Route path="/devices/:deviceId/firmware" element={<FirmwareWizardPage />} />
      <Route path="/devices/:id" element={<DeviceDetailPage />} />
      <Route path="/hardware" element={<HardwarePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/help/:slug" element={<HelpPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      {isAdmin(user) && <Route path="/users" element={<UsersPage />} />}
      {isAdmin(user) && <Route path="/settings" element={<SettingsPage />} />}
      {isAdmin(user) && <Route path="/code" element={<CodeEditorPage />} />}

      {/* Older addresses, so saved bookmarks keep working */}
      <Route path="/building" element={<Navigate to="/rooms" replace />} />
      <Route path="/firmware/new" element={<Navigate to="/devices/new" replace />} />
      <Route path="/profiles" element={<Navigate to="/hardware" replace />} />
      <Route path="/guides/*" element={<Navigate to="/help" replace />} />
      <Route path="/audit" element={<Navigate to="/activity" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
