import { useState } from 'react'
import { Code, Download, FlaskConical, Usb } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { downloadBase64 } from '../../lib/download.js'
import { Alert, Button, Field, Modal } from '../ui/index.js'
import { UsbFlash } from './UsbFlash.jsx'

// Opens the three desk-test programs for a hardware type: relay test, LED chaser, WiFi test.
export function TestSketchesButton({ profile, device }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" icon={FlaskConical} onClick={() => setOpen(true)}>
        Test programs
      </Button>
      {open && <TestSketchesModal profile={profile} device={device} onClose={() => setOpen(false)} />}
    </>
  )
}

function TestSketchesModal({ profile, device, onClose }) {
  const [wifi, setWifi] = useState({ wifiSsid: '', wifiPassword: '' })
  const [result, setResult] = useState(null)
  const [showCode, setShowCode] = useState(null)
  const [usb, setUsb] = useState(null) // { kind, buildId }
  const [error, setError] = useState(null)

  const generate = async (e) => {
    e.preventDefault()
    try {
      setResult(await api(`/profiles/${profile._id}/test-sketches`, { method: 'POST', body: { ...wifi, device } }))
    } catch (err) {
      setError(errorText(err))
    }
  }
  const uploadUsb = async (kind) => {
    setError(null)
    try {
      const b = await api(`/profiles/${profile._id}/test-sketches/${kind}/build`, { method: 'POST', body: { ...wifi, device } })
      setUsb({ kind, buildId: b._id })
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal
      title={`Test programs for ${profile.code}`}
      description="Small programs to check a board on the desk before it is installed. They use only this hardware type's pins."
      onClose={onClose}
      wide
    >
      <Alert tone="info">These test programs are new for ACLS (not the ones used for the original hardware tests). Watch the board while they run.</Alert>
      {!result ? (
        <form className="form" onSubmit={generate}>
          <p className="small muted">The WiFi test joins the classroom WiFi. Enter it if you want to use that test; the other two do not need it.</p>
          <div className="form-grid">
            <Field label="WiFi name (for the WiFi test)">
              <input value={wifi.wifiSsid} onChange={(e) => setWifi({ ...wifi, wifiSsid: e.target.value })} />
            </Field>
            <Field label="WiFi password">
              <input type="password" autoComplete="off" value={wifi.wifiPassword} onChange={(e) => setWifi({ ...wifi, wifiPassword: e.target.value })} />
            </Field>
          </div>
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="form-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">
              Show the test programs
            </Button>
          </div>
        </form>
      ) : (
        <div className="stack">
          {error && <Alert tone="bad">{error}</Alert>}
          {result.sketches.map((s) => (
            <div key={s.kind} className="card card-sub stack-sm">
              <div className="row-between">
                <h3>{s.title}</h3>
                <div className="row">
                  {result.canCompile && (
                    <Button size="sm" variant="primary" icon={Usb} onClick={() => uploadUsb(s.kind)}>
                      Upload by USB
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={Code} onClick={() => setShowCode(showCode === s.kind ? null : s.kind)}>
                    {showCode === s.kind ? 'Hide code' : 'Code'}
                  </Button>
                </div>
              </div>
              <div className="small">
                <strong>What you should see</strong>
                <ul>
                  {s.whatToSee.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              {usb?.kind === s.kind && <UsbFlash key={usb.buildId} buildId={usb.buildId} espModel={profile.espModel} />}
              {showCode === s.kind && <pre>{s.content}</pre>}
            </div>
          ))}
          <div className="row-between">
            <span className="small muted">Prefer Arduino IDE? Download all three and open them there.</span>
            <Button size="sm" icon={Download} onClick={() => downloadBase64(result.zipName, result.zipBase64)}>
              Download for Arduino IDE
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
