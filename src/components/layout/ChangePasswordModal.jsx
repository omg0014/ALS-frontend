import { useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { Alert, Button, Field, Modal } from '../ui/index.js'

export function ChangePasswordModal({ onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api('/auth/me/password', { method: 'PUT', body: form })
      toast.ok('Password changed')
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }
  return (
    <Modal title="Change your password" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Current password">
          <input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
