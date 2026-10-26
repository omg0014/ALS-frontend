import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlugZap, Save } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useLive } from '../../context/LiveContext.js'
import { GROUP_TYPES } from '../../lib/labels.js'
import { Alert, Button, Field } from '../../components/ui/index.js'

// Broker, topic and ON/OFF messages of a board that runs its own code, and the classroom it is in.
export function SimpleBoardForm({ initial, deviceId, onSaved, onCancel }) {
  const { data, index } = useLive()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [check, setCheck] = useState(null)
  const [error, setError] = useState(null)
  const set = (patch) => {
    setCheck(null)
    setForm((f) => ({ ...f, ...patch }))
  }
  const roomGroups = form.room ? index.groupsByRoom.get(form.room) ?? [] : []
  const isPublic = !form.username

  const body = () => ({
    name: form.name,
    room: form.room,
    line: form.lineGroup ? { group: form.lineGroup } : { type: form.lineType, name: form.lineName },
    host: form.host,
    port: Number(form.port),
    tls: form.tls,
    username: form.username,
    password: form.password,
    commandTopic: form.commandTopic,
    stateTopic: form.stateTopic,
    onPayload: form.onPayload,
    offPayload: form.offPayload,
    retain: form.retain,
    device: deviceId,
  })

  const test = async () => {
    setBusy(true)
    setError(null)
    try {
      setCheck(await api('/devices/simple/test', { method: 'POST', body: body() }))
    } catch (err) {
      setCheck({ ok: false, error: errorText(err) })
    } finally {
      setBusy(false)
    }
  }
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = deviceId
        ? await api(`/devices/${deviceId}/simple`, { method: 'PUT', body: body() })
        : await api('/devices/simple', { method: 'POST', body: body() })
      onSaved(r.device)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <section className="stack-sm">
        <h3>Where it is</h3>
        <div className="form-grid">
          <Field label="Classroom" hint="Any floor; add rooms on the Rooms page">
            <select id="sb-room" value={form.room} onChange={(e) => set({ room: e.target.value, lineGroup: '', name: form.name || `${index.rooms.get(e.target.value)?.displayName ?? ''} board` })}>
              <option value="">Choose a classroom…</option>
              {data.floors.map((f) => (
                <optgroup key={f._id} label={f.name}>
                  {(index.roomsByFloor.get(f._id) ?? []).map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Board name">
            <input id="sb-name" value={form.name} placeholder="e.g. 10-A AC" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="What it switches">
            <select id="sb-line" value={form.lineGroup || `new:${form.lineType}`} onChange={(e) => (e.target.value.startsWith('new:') ? set({ lineGroup: '', lineType: e.target.value.slice(4) }) : set({ lineGroup: e.target.value }))}>
              {roomGroups.length > 0 && (
                <optgroup label="Already in this room">
                  {roomGroups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name} ({GROUP_TYPES[g.type]})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Add new to this room">
                {Object.entries(GROUP_TYPES).map(([k, v]) => (
                  <option key={k} value={`new:${k}`}>
                    New: {v}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
          {!form.lineGroup && (
            <Field label="Its name" hint="Shown on the Lights & fans page">
              <input id="sb-linename" value={form.lineName} placeholder={GROUP_TYPES[form.lineType]} onChange={(e) => set({ lineName: e.target.value })} />
            </Field>
          )}
        </div>
        {data.rooms.length === 0 && (
          <Alert tone="warn">
            There are no rooms yet. <Link to="/rooms">Add the classroom first</Link>.
          </Alert>
        )}
      </section>

      <section className="stack-sm">
        <h3>MQTT broker</h3>
        <div className="form-grid">
          <Field label="Broker" hint="As in your board's code, e.g. broker.hivemq.com">
            <input id="sb-host" value={form.host} autoComplete="off" onChange={(e) => set({ host: e.target.value })} />
          </Field>
          <Field label="Port" hint="1883, or 8883 if encrypted. Not 8884 (that one is for web pages)">
            <input id="sb-port" type="number" value={form.port} onChange={(e) => set({ port: e.target.value, tls: e.target.value === '8883' ? true : e.target.value === '1883' ? false : form.tls })} />
          </Field>
          <Field label="Username" hint="Leave empty if the broker has no login">
            <input id="sb-user" value={form.username} autoComplete="off" onChange={(e) => set({ username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input id="sb-pass" type="password" value={form.password} autoComplete="new-password" placeholder={deviceId ? 'unchanged (leave empty)' : ''} onChange={(e) => set({ password: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input id="sb-tls" type="checkbox" checked={form.tls} onChange={(e) => set({ tls: e.target.checked })} />
          Encrypted connection (TLS)
        </label>
        {isPublic && <Alert tone="warn">A broker without a login is public: anyone who knows the topic can switch this classroom. Fine for testing; use a broker with a login for real use.</Alert>}
      </section>

      <section className="stack-sm">
        <h3>Topic and messages</h3>
        <div className="form-grid">
          <Field label="Topic" hint="Where the board listens, e.g. rawniee/test/r4">
            <input
              id="sb-topic"
              value={form.commandTopic}
              autoComplete="off"
              onChange={(e) => set({ commandTopic: e.target.value, stateTopic: form.stateTouched ? form.stateTopic : e.target.value ? `${e.target.value}/state` : '' })}
            />
          </Field>
          <Field label="State topic (optional)" hint="Where the board answers ON / OFF; empty if it doesn't">
            <input id="sb-state" value={form.stateTopic} autoComplete="off" onChange={(e) => set({ stateTopic: e.target.value, stateTouched: true })} />
          </Field>
          <Field label="Message for ON">
            <input id="sb-on" value={form.onPayload} onChange={(e) => set({ onPayload: e.target.value })} />
          </Field>
          <Field label="Message for OFF">
            <input id="sb-off" value={form.offPayload} onChange={(e) => set({ offPayload: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input id="sb-retain" type="checkbox" checked={form.retain} onChange={(e) => set({ retain: e.target.checked })} />
          Keep the last ON/OFF on the broker, so the board switches back by itself after a power cut
        </label>
      </section>

      {check &&
        (check.ok ? (
          <Alert tone="ok">
            The broker accepts the login.
            {form.stateTopic && (check.state ? ` The board says it is ${check.state}.` : ' The board has not reported its state yet (it does after the first ON/OFF).')}
          </Alert>
        ) : (
          <Alert tone="bad">{check.error}</Alert>
        ))}
      {error && <Alert tone="bad">{error}</Alert>}

      <div className="row">
        <Button type="submit" variant="primary" icon={Save} disabled={busy || !form.room || !form.commandTopic}>
          {busy ? 'Saving…' : deviceId ? 'Save changes' : 'Save board'}
        </Button>
        <Button icon={PlugZap} disabled={busy || !form.host} onClick={test}>
          Test
        </Button>
        {onCancel && (
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
