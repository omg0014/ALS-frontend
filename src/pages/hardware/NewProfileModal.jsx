import { useEffect, useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { Alert, Button, Field, Modal } from '../../components/ui/index.js'

const MODULE_KINDS = {
  blue4: 'Blue 4-relay 10 A board (SRD-05VDC, JD-VCC jumper)',
  blue2: 'Blue 2-relay 7 A board (JQC-3FC, no jumper)',
  red30: 'Red 1-relay 30 A board (SLA-05VDC, H/L jumper)',
  other: 'Another relay board',
}

// Add a new ESP + relay board combination. Always saved as "not yet tested".
export function NewProfileModal({ onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    code: '',
    espModel: 'esp8266',
    espBoard: 'NodeMCU v3 (ESP-12E, CH340, 4MB)',
    relayModule: '',
    moduleKind: 'other',
    channels: 1,
    trigger: 'LOW',
    triggerNote: '',
    pins: [''],
    contactRatingA: 10,
    maxAmpsPerChannel: '',
    setupNotes: '',
  })
  const [allowed, setAllowed] = useState([])
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    api('/profiles').then((ps) => setAllowed(ps.find((p) => p.espModel === form.espModel)?.allowedPins ?? []))
  }, [form.espModel])

  const setChannels = (n) => set({ channels: n, pins: Array.from({ length: n }, (_, i) => form.pins[i] ?? '') })
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api('/profiles', { method: 'POST', body: { ...form, pins: form.pins.map((g) => ({ gpio: Number(g) })) } })
      toast.ok(`Hardware type ${form.code.toUpperCase()} added`)
      onSaved()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal title="Add a hardware type" description="A combination of ESP board and relay board that has not been used before." onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <Alert tone="warn">
          A new hardware type starts as <strong>not yet tested</strong>. It can only be used on the desk until its desk test passes and an admin marks it as tested.
        </Alert>
        <div className="form-grid">
          <Field label="Short code" hint="e.g. P6">
            <input required value={form.code} onChange={(e) => set({ code: e.target.value })} />
          </Field>
          <Field label="ESP board">
            <select
              value={form.espModel}
              onChange={(e) =>
                set({
                  espModel: e.target.value,
                  espBoard: e.target.value === 'esp32' ? 'ESP32 DevKit 30-pin (ESP32-D0WD-V3, USB-C, CH9102)' : 'NodeMCU v3 (ESP-12E, CH340, 4MB)',
                  pins: form.pins.map(() => ''),
                })
              }
            >
              <option value="esp8266">NodeMCU v3 (ESP8266)</option>
              <option value="esp32">ESP32 DevKit</option>
            </select>
          </Field>
          <Field label="ESP board description">
            <input required value={form.espBoard} onChange={(e) => set({ espBoard: e.target.value })} />
          </Field>
          <Field label="Relay board description" hint="Brand, relay part number, jumpers">
            <input required value={form.relayModule} onChange={(e) => set({ relayModule: e.target.value })} />
          </Field>
          <Field label="Kind of relay board" hint="Used to draw the wiring sheet">
            <select value={form.moduleKind} onChange={(e) => set({ moduleKind: e.target.value })}>
              {Object.entries(MODULE_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Number of relays">
            <input type="number" min="1" max="16" value={form.channels} onChange={(e) => setChannels(Math.max(1, Math.min(16, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Relay switches ON when the pin is">
            <select value={form.trigger} onChange={(e) => set({ trigger: e.target.value })}>
              <option value="LOW">LOW (active low)</option>
              <option value="HIGH">HIGH (active high)</option>
            </select>
          </Field>
          <Field label="Note about the trigger" hint="e.g. jumper on H">
            <input value={form.triggerNote} onChange={(e) => set({ triggerNote: e.target.value })} />
          </Field>
          <Field label="Relay contact rating (A)">
            <input type="number" min="0" value={form.contactRatingA} onChange={(e) => set({ contactRatingA: e.target.value })} />
          </Field>
          <Field label="Safe load per relay (A)" hint="Leave empty if not known">
            <input type="number" min="0" step="0.5" value={form.maxAmpsPerChannel} onChange={(e) => set({ maxAmpsPerChannel: e.target.value })} />
          </Field>
        </div>
        <div className="stack-sm">
          <div className="field-label">ESP pin for each relay (only safe pins can be chosen)</div>
          <div className="form-grid">
            {form.pins.map((g, i) => (
              <Field key={i} label={form.channels === 1 ? 'Relay' : `Relay ${i + 1}`}>
                <select required value={g} onChange={(e) => set({ pins: form.pins.map((x, j) => (j === i ? e.target.value : x)) })}>
                  <option value="">Choose…</option>
                  {allowed.map((p) => (
                    <option key={p.gpio} value={p.gpio} disabled={form.pins.some((x, j) => j !== i && Number(x) === p.gpio)}>
                      {p.label} (GPIO{p.gpio})
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </div>
        <Field label="Setup notes" hint="One per line, e.g. jumper settings or power advice">
          <textarea rows="4" value={form.setupNotes} onChange={(e) => set({ setupNotes: e.target.value })} />
        </Field>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Add as not yet tested
          </Button>
        </div>
      </form>
    </Modal>
  )
}
