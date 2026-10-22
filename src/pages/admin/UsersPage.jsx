import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { ROLE_HELP, ROLE_LABELS } from '../../lib/labels.js'
import { timeAgo } from '../../lib/format.js'
import { Alert, Badge, Button, Check, EmptyState, Field, Modal, PageHeader } from '../../components/ui/index.js'

export default function UsersPage() {
  const { data } = useLive()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [edit, setEdit] = useState(null)
  const load = () => api('/users').then(setUsers).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const floorName = (id) => data?.floors.find((f) => f._id === id)?.name ?? '?'

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in, and what they may do."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEdit({})}>
            Add user
          </Button>
        }
      />
      <div className="grid-cards" style={{ marginBottom: 20 }}>
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <div key={k} className="card card-sub">
            <strong>{v}</strong>
            <p className="small muted" style={{ marginTop: 4 }}>
              {ROLE_HELP[k]}
            </p>
          </div>
        ))}
      </div>
      {!users.length ? (
        <EmptyState icon={Users} title="No users" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Floors</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="clickable" onClick={() => setEdit(u)}>
                  <td>
                    <div className="strong">
                      {u.name} {!u.active && <Badge tone="bad">cannot sign in</Badge>}
                    </div>
                    <div className="sub mono">{u.username}</div>
                  </td>
                  <td>
                    <Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge>
                  </td>
                  <td className="small">{u.allowedFloors.length ? u.allowedFloors.map(floorName).join(', ') : <span className="muted">all floors</span>}</td>
                  <td className="small">{timeAgo(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <UserModal
          user={edit}
          floors={data?.floors ?? []}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null)
            load()
          }}
        />
      )}
    </>
  )
}

function UserModal({ user, floors, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !user._id
  const [form, setForm] = useState({
    name: user.name ?? '',
    username: user.username ?? '',
    password: '',
    role: user.role ?? 'staff',
    allowedFloors: user.allowedFloors ?? [],
    active: user.active ?? true,
  })
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggleFloor = (id) => set({ allowedFloors: form.allowedFloors.includes(id) ? form.allowedFloors.filter((f) => f !== id) : [...form.allowedFloors, id] })

  const submit = async (e) => {
    e.preventDefault()
    try {
      const body = { ...form }
      if (!isNew) delete body.username
      if (!body.password) delete body.password
      await api(isNew ? '/users' : `/users/${user._id}`, { method: isNew ? 'POST' : 'PUT', body })
      toast.ok(isNew ? `${form.name} can now sign in` : 'User saved')
      onSaved()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal title={isNew ? 'Add a user' : `Edit ${user.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name">
            <input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Username" hint={isNew ? 'Used to sign in' : 'Cannot be changed'}>
            <input required disabled={!isNew} autoCapitalize="none" value={form.username} onChange={(e) => set({ username: e.target.value })} />
          </Field>
        </div>
        <Field label={isNew ? 'Password' : 'New password'} hint={isNew ? 'At least 8 characters' : 'Leave empty to keep the current password'}>
          <input type="password" autoComplete="new-password" required={isNew} value={form.password} onChange={(e) => set({ password: e.target.value })} />
        </Field>
        <Field label="Role" hint={ROLE_HELP[form.role]}>
          <select value={form.role} onChange={(e) => set({ role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {form.role === 'staff' && floors.length > 0 && (
          <Field label="May switch lights on" hint="Tick none to allow all floors">
            <div className="row" style={{ gap: 14 }}>
              {floors.map((f) => (
                <Check key={f._id} checked={form.allowedFloors.includes(f._id)} onChange={() => toggleFloor(f._id)}>
                  {f.name}
                </Check>
              ))}
            </div>
          </Field>
        )}
        {!isNew && (
          <Check checked={form.active} onChange={(v) => set({ active: v })}>
            Can sign in
          </Check>
        )}
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {isNew ? 'Add user' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
