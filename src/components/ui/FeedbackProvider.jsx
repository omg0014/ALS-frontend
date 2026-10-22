import { useCallback, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { ConfirmContext, ToastContext } from '../../context/feedback.js'
import { Button } from './Button.jsx'
import { Modal } from './Modal.jsx'

const TOAST_ICONS = { info: Info, ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert }

// Provides toasts (short messages bottom-right) and a confirm() dialog to the whole app.
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback(
    (tone, text, ms = 4500) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, tone, text }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss]
  )
  const toast = useMemo(
    () => ({ ok: (t) => show('ok', t), info: (t) => show('info', t), warn: (t) => show('warn', t, 7000), error: (t) => show('bad', t, 8000) }),
    [show]
  )

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), [])
  const close = (answer) => {
    dialog.resolve(answer)
    setDialog(null)
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => {
            const Icon = TOAST_ICONS[t.tone]
            return (
              <div key={t.id} className={`toast toast-${t.tone}`}>
                <Icon aria-hidden="true" />
                <div>{t.text}</div>
                <Button variant="ghost" size="sm" icon={X} aria-label="Dismiss" onClick={() => dismiss(t.id)} />
              </div>
            )
          })}
        </div>
        {dialog && (
          <Modal title={dialog.title} onClose={() => close(false)}>
            {dialog.message && <div className="stack-sm">{dialog.message}</div>}
            <div className="form-actions">
              <Button onClick={() => close(false)}>{dialog.cancelLabel ?? 'Cancel'}</Button>
              <Button variant={dialog.tone === 'danger' ? 'danger-solid' : dialog.tone === 'on' ? 'on' : 'primary'} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel ?? 'OK'}
              </Button>
            </div>
          </Modal>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
