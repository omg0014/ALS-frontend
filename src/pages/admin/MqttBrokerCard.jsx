import { useState } from 'react'
import { PlugZap, Wifi } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { Alert, Badge, Button, Card, Field } from '../../components/ui/index.js'

const EMPTY = { host: '', port: 8883, tls: true, username: '', password: '', deviceUsername: '', devicePassword: '', deviceCa: '' }

// Where the boards connect. On the school PC: the broker built into this server (nothing to set).
// In the cloud (Render): an MQTT broker the school signs up for, entered here by an admin.
export function MqttBrokerCard({ mqtt, values, onChange }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState(null) // null = not editing
  const [busy, setBusy] = useState(false)
  const [check, setCheck] = useState(null) // { ok, error }

  const edit = () => {
    setCheck(null)
    setForm(
      mqtt?.external
        ? { ...EMPTY, host: mqtt.host, port: mqtt.port, tls: mqtt.tls, username: mqtt.username, deviceUsername: mqtt.deviceUsername, deviceCa: mqtt.deviceCa ?? '' }
        : { ...EMPTY }
    )
  }
  const set = (patch) => {
    setCheck(null)
    setForm((f) => ({ ...f, ...patch }))
  }
  const body = () => ({ ...form, port: Number(form.port) })

  const test = async () => {
    setBusy(true)
    try {
      setCheck(await api('/settings/mqtt/test', { method: 'POST', body: body() }))
    } catch (err) {
      setCheck({ ok: false, error: errorText(err) })
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    setBusy(true)
    try {
      const r = await api('/settings/mqtt', { method: 'PUT', body: body() })
      onChange(r.mqtt)
      setForm(null)
      toast.ok('MQTT broker saved and connected')
    } catch (err) {
      setCheck({ ok: false, error: errorText(err) })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    const ok = await confirm({
      title: 'Remove the MQTT broker?',
      message: 'Boards using it lose their connection to this website until they get new firmware.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    try {
      const r = await api('/settings/mqtt', { method: 'DELETE' })
      onChange(r.mqtt)
      toast.ok('MQTT broker removed')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const keep = (has) => (has ? 'unchanged (leave empty)' : '')

  return (
    <Card title="MQTT broker" icon={Wifi} description="Where the classroom boards connect.">
      <div className="stack-sm">
        {mqtt?.external && !form && (
          <>
            <p className="small" style={{ margin: 0 }}>
              Boards connect to <strong className="mono">{mqtt.host}</strong> (port {mqtt.port}
              {mqtt.tls ? ', encrypted' : ''}) with the board login <strong className="mono">{mqtt.deviceUsername}</strong>.{' '}
              {mqtt.connected ? <Badge tone="ok">connected</Badge> : <Badge tone="bad">not connected</Badge>}
            </p>
            {mqtt.fromEnv ? (
              <p className="small muted" style={{ margin: 0 }}>
                Set on the server (MQTT_URL in Render). Change it there.
              </p>
            ) : (
              <div className="row">
                <Button size="sm" onClick={edit}>
                  Change
                </Button>
                <Button size="sm" variant="ghost" onClick={remove}>
                  Remove
                </Button>
              </div>
            )}
          </>
        )}

        {!mqtt?.external && !form && (
          <>
            {mqtt?.cloud ? (
              <Alert tone="warn" title="No MQTT broker yet">
                This website runs in the cloud, so the boards need an MQTT broker to connect to. Sign up for one (e.g. HiveMQ Cloud or EMQX Cloud) and enter its details
                here.
              </Alert>
            ) : values.brokerHost ? (
              <p className="small" style={{ margin: 0 }}>
                Boards connect to the broker built into this server, at <strong className="mono">{values.brokerHost}</strong> (port {values.brokerPort}). Give this PC a
                fixed address in the school router.
              </p>
            ) : (
              <Alert tone="warn" title="This PC's network address was not found">
                Connect this PC to the school network (WiFi or cable), then restart the server.
              </Alert>
            )}
            <div>
              <Button size="sm" variant={mqtt?.cloud ? 'primary' : 'ghost'} onClick={edit}>
                {mqtt?.cloud ? 'Enter the MQTT broker' : 'Use an external broker instead'}
              </Button>
            </div>
          </>
        )}

        {form && (
          <div className="stack-sm">
            <div className="form-grid">
              <Field label="Broker address" hint="From the broker's overview page, e.g. abc123.s1.eu.hivemq.cloud">
                <input id="mqtt-host" value={form.host} autoComplete="off" placeholder="abc123.s1.eu.hivemq.cloud" onChange={(e) => set({ host: e.target.value })} />
              </Field>
              <Field label="Port" hint="8883 = encrypted (recommended), 1883 = plain">
                <input id="mqtt-port" type="number" value={form.port} onChange={(e) => set({ port: e.target.value, tls: e.target.value === '8883' ? true : form.tls })} />
              </Field>
              <Field label="Server login: username" hint="Used by this website">
                <input id="mqtt-user" value={form.username} autoComplete="off" onChange={(e) => set({ username: e.target.value })} />
              </Field>
              <Field label="Server login: password">
                <input id="mqtt-pass" type="password" value={form.password} autoComplete="new-password" placeholder={keep(mqtt?.hasPassword)} onChange={(e) => set({ password: e.target.value })} />
              </Field>
              <Field label="Board login: username" hint="Built into every board's code">
                <input id="mqtt-duser" value={form.deviceUsername} autoComplete="off" onChange={(e) => set({ deviceUsername: e.target.value })} />
              </Field>
              <Field label="Board login: password">
                <input
                  id="mqtt-dpass"
                  type="password"
                  value={form.devicePassword}
                  autoComplete="new-password"
                  placeholder={keep(mqtt?.hasDevicePassword)}
                  onChange={(e) => set({ devicePassword: e.target.value })}
                />
              </Field>
            </div>
            <label className="check">
              <input id="mqtt-tls" type="checkbox" checked={form.tls} onChange={(e) => set({ tls: e.target.checked })} />
              Encrypted connection (TLS)
            </label>
            <details>
              <summary className="small">Root certificate (optional, makes boards check it is the real broker)</summary>
              <Field label="Certificate" hint="Paste everything from -----BEGIN CERTIFICATE----- to -----END CERTIFICATE-----">
                <textarea id="mqtt-ca" rows={6} className="mono" value={form.deviceCa} onChange={(e) => set({ deviceCa: e.target.value })} />
              </Field>
            </details>

            {check && (check.ok ? <Alert tone="ok">Both logins work.</Alert> : <Alert tone="bad">{check.error}</Alert>)}
            {mqtt?.external && <p className="small muted" style={{ margin: 0 }}>Changing the broker means every board needs new code; they are marked "update needed".</p>}
            <div className="row">
              <Button size="sm" icon={PlugZap} disabled={busy || !form.host} onClick={test}>
                {busy ? 'Checking…' : 'Test connection'}
              </Button>
              <Button size="sm" variant="primary" disabled={busy || !form.host} onClick={save}>
                Save and connect
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
