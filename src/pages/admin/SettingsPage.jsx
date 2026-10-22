import { useEffect, useState } from 'react'
import { Save, Wifi } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { Alert, Badge, Button, Card, Field, Loading, PageHeader } from '../../components/ui/index.js'

// Only the settings a school changes are shown. Everything else stays on its default and is not shown:
// device connection (this PC's address is found automatically, port 1883, prefix acls/v1) and switching
// (restore how they were after a power cut, 250/50 ms pauses, 5 s reply wait).
const FIELDS = {
  rssiAlertDbm: { label: 'Warn when WiFi signal is below (dBm)', hint: '-75 is a good default' },
  offlineAlertMinutes: { label: 'Warn when a device is offline for (minutes)' },
  rebootAlertCount: { label: 'Warn when a device restarts this many times…' },
  rebootAlertWindowMinutes: { label: '…within (minutes)' },
}

export default function SettingsPage() {
  const toast = useToast()
  const [defs, setDefs] = useState(null)
  const [values, setValues] = useState({})
  const [saved, setSaved] = useState({})
  const [mqtt, setMqtt] = useState(null)

  useEffect(() => {
    api('/settings').then((r) => {
      setDefs(r.defs)
      setValues(r.values)
      setSaved(r.values)
      setMqtt(r.mqtt)
    })
  }, [])

  if (!defs) return <Loading />
  const dirty = Object.keys(FIELDS).filter((k) => values[k] !== saved[k])

  const submit = async (e) => {
    e.preventDefault()
    try {
      const r = await api('/settings', { method: 'PUT', body: Object.fromEntries(dirty.map((k) => [k, values[k]])) })
      setValues(r.values)
      setSaved(r.values)
      toast.ok('Settings saved')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Settings"
        description="Settings for the whole school. Every change is recorded in the activity log."
        actions={
          <Button type="submit" variant="primary" icon={Save} disabled={!dirty.length}>
            {dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
          </Button>
        }
      />
      <div className="stack">
        <Card title="Connection to the devices" icon={Wifi} description="Found automatically. Nothing to set here.">
          {mqtt?.external ? (
            <p className="small">
              Devices connect to the MQTT broker <strong className="mono">{values.brokerHost}</strong> (port {values.brokerPort}
              {mqtt.tls ? ', encrypted' : ''}). It is set on the server (MQTT_URL); changing it needs a firmware update on every device.
            </p>
          ) : values.brokerHost ? (
            <p className="small">
              Devices connect to this PC at <strong className="mono">{values.brokerHost}</strong> (port {values.brokerPort}). Give this PC a fixed address in the school
              router, so it never changes. If it does change, the devices are marked "update needed".
            </p>
          ) : (
            <Alert tone="warn" title="This PC's network address was not found">
              Connect this PC to the school network (WiFi or cable), then restart the server.
            </Alert>
          )}
        </Card>

        <Card title="Warnings on the Home page">
          <div className="form-grid">
            {Object.entries(FIELDS)
              .filter(([k]) => defs[k])
              .map(([k, f]) => (
                <Field
                  key={k}
                  label={
                    <>
                      {f.label} {values[k] !== saved[k] && <Badge tone="info">changed</Badge>}
                    </>
                  }
                  hint={f.hint}
                >
                  <input
                    type="number"
                    value={values[k] ?? ''}
                    min={defs[k].min}
                    max={defs[k].max}
                    onChange={(e) => setValues({ ...values, [k]: Number(e.target.value) })}
                  />
                </Field>
              ))}
          </div>
        </Card>
      </div>
    </form>
  )
}
