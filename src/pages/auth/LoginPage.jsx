import { useState } from 'react'
import { Building, LogIn, Power, ToggleRight } from 'lucide-react'
import { api } from '../../api/client.js'
import { Alert, Button, Field } from '../../components/ui/index.js'
import { Brand } from '../../components/layout/Brand.jsx'
import { Facade } from '../../components/Facade.jsx'

// The building on the left: some windows lit, a few turning on and off by themselves.
const LIT = new Set([2, 5, 9, 10, 14, 19, 21, 26, 28, 30])
const FLICKER = new Set([4, 12, 17, 23, 25, 31])
const WINDOWS = Array.from({ length: 32 }, (_, i) => ({ lit: LIT.has(i), flicker: FLICKER.has(i) }))

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLogin((await api('/auth/login', { method: 'POST', body: { username, password } })).user)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <aside className="login-hero">
        <Brand />
        <div>
          <h2>
            Every classroom, <em>one switch</em> away.
          </h2>
          <p>Live status and switching for every room, from any computer or phone on the school network.</p>
        </div>
        <ul className="login-features">
          <li>
            <Building aria-hidden="true" /> See every room and floor at a glance
          </li>
          <li>
            <ToggleRight aria-hidden="true" /> Switch a room, a floor or the whole school
          </li>
          <li>
            <Power aria-hidden="true" /> Wall switches keep working as usual
          </li>
        </ul>
        <Facade windows={WINDOWS} />
      </aside>

      <main className="login-main">
        <form className="card login-card" onSubmit={submit}>
          <Brand />
          <div>
            <h1>Sign in</h1>
            <p className="muted">Control the classroom lights and fans of the school.</p>
          </div>
          <Field label="Username">
            <input autoFocus autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Password">
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Alert tone="bad">{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" icon={LogIn} disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="small muted" style={{ textAlign: 'center' }}>
            Forgot your password? Ask the administrator.
          </p>
        </form>
      </main>
    </div>
  )
}
