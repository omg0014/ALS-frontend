import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { Badge, Button, Card, Field, Loading, PageHeader } from '../../components/ui/index.js'
import { MqttBrokerCard } from './MqttBrokerCard.jsx'

// Only the settings a school changes are shown: the MQTT broker (cloud hosting only; on the school PC it
// is built in and found automatically) and the Home-page warnings. Switching stays on its defaults
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
        <MqttBrokerCard
          mqtt={mqtt}
          values={values}
          onChange={async (m) => {
            setMqtt(m)
            const r = await api('/settings')
            setValues((v) => ({ ...v, brokerHost: r.values.brokerHost, brokerPort: r.values.brokerPort }))
          }}
        />

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
