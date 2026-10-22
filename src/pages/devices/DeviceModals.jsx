import { useEffect, useState } from 'react'
import { Check as CheckIcon } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { useBuild } from '../../hooks/useBuild.js'
import { isAdmin } from '../../lib/permissions.js'
import { ESP_NAMES } from '../../lib/labels.js'
import { Alert, Button, Field, Modal, Spinner } from '../../components/ui/index.js'
import { BuildStatus } from '../../components/firmware/UsbFlash.jsx'

function RoomSelect({ value, onChange, emptyLabel }) {
  const { data, index } = useLive()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
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
  )
}

export function EditDeviceModal({ device, profiles, onClose, onSaved }) {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    name: device.name,
    room: device.room?._id ?? '',
    status: device.status,
    mac: device.mac ?? '',
    installedOn: device.installedOn ? device.installedOn.slice(0, 10) : '',
    profile: device.profile._id,
  })
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      const r = await api(`/devices/${device._id}`, { method: 'PUT', body: { ...form, room: form.room || null, installedOn: form.installedOn || null } })
      toast.ok('Device saved')
      r.notes?.forEach((n) => toast.info(n))
      onSaved()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal title="Edit or move device" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name">
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Room" hint="Moving to another room disconnects its relays from the old room's groups. No firmware update is needed.">
          <RoomSelect value={form.room} onChange={(room) => set({ room })} emptyLabel="No room (spare)" />
        </Field>
        <div className="form-grid">
          <Field label="In use">
            <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">In use</option>
              <option value="spare">Spare</option>
            </select>
          </Field>
          <Field label="Installed on">
            <input type="date" value={form.installedOn} onChange={(e) => set({ installedOn: e.target.value })} />
          </Field>
        </div>
        <Field label="MAC address (optional)">
          <input value={form.mac} onChange={(e) => set({ mac: e.target.value })} />
        </Field>
        {isAdmin(user) && (
          <Field label="Hardware type" hint="Changing it resets the relays and needs a firmware update.">
            <select value={form.profile} onChange={(e) => set({ profile: e.target.value })}>
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.code}: {ESP_NAMES[p.espModel]} + {p.relayModule.split(',')[0]}
                  {p.verified ? '' : ' (not yet tested)'}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// A failed board is swapped: the new board takes over this record's room, groups and history.
export function ReplaceBoardModal({ device, onClose, onDone }) {
  const [chipId, setChipId] = useState('')
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api(`/devices/${device._id}/replace`, { method: 'POST', body: { chipId } })
      onDone()
    } catch (err) {
      setError(errorText(err))
    }
  }
  return (
    <Modal title="Replace a broken board" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p>
          The new board takes over <strong>{device.name}</strong>: same room, same lights and fans, same history. The old board can no longer connect. Next you
          upload the firmware to the new board.
        </p>
        <Field label="Chip ID of the new board" hint="6 characters, e.g. 3fa2c1. The firmware wizard can also read it over USB.">
          <input required autoFocus placeholder="e.g. 3fa2c1" value={chipId} onChange={(e) => setChipId(e.target.value.trim())} />
        </Field>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Replace and upload firmware
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const OTA_STEPS = [
  ['waiting_build', 'Preparing the firmware on the server'],
  ['sent', 'Sent to the device'],
  ['downloading', 'Device is downloading'],
  ['started', 'Device is installing'],
  ['done', 'Device restarted with the new firmware'],
]

// Over-the-air update: the server prepares the firmware, the device downloads it over WiFi and restarts.
export function WifiUpdateModal({ device, onClose }) {
  const { index } = useLive()
  const toast = useToast()
  const [check, setCheck] = useState(null)
  const [wifiSsid, setSsid] = useState(index?.rooms.get(device.room?._id)?.wifiSsid ?? '')
  const [wifiPassword, setPw] = useState('')
  const [buildId, setBuildId] = useState(null)
  const [error, setError] = useState(null)
  const build = useBuild(buildId)

  useEffect(() => {
    api(`/devices/${device._id}/ota-check`).then(setCheck).catch((e) => setError(errorText(e)))
  }, [device._id])

  const status = build?.ota?.status
  useEffect(() => {
    if (status === 'done') toast.ok(`${device.name} is running the new firmware`)
    if (status === 'failed') toast.error(`Update of ${device.name} failed`)
  }, [status, device.name, toast])

  const start = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      setBuildId((await api(`/devices/${device._id}/ota`, { method: 'POST', body: { wifiSsid, wifiPassword } }))._id)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const reached = OTA_STEPS.findIndex(([k]) => k === status)
  return (
    <Modal title={`Update ${device.name} over WiFi`} description="No need to open the box or connect a cable." onClose={onClose}>
      {!buildId ? (
        <form className="form" onSubmit={start}>
          {check?.blocker && <Alert tone="warn">{check.blocker}</Alert>}
          <Alert tone="info">At the end the device restarts. Its lights switch off for a few seconds and then come back as they were.</Alert>
          <div className="form-grid">
            <Field label="WiFi name" hint="Written into the new firmware">
              <input required value={wifiSsid} onChange={(e) => setSsid(e.target.value)} />
            </Field>
            <Field label="WiFi password" hint="Needed: the board cannot join the WiFi without it">
              <input required type="password" autoComplete="off" value={wifiPassword} onChange={(e) => setPw(e.target.value)} />
            </Field>
          </div>
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="form-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!check || Boolean(check.blocker) || !wifiSsid || !wifiPassword}>
              Start update
            </Button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <BuildStatus build={build} />
          <ul className="plain-list">
            {OTA_STEPS.map(([k, label], i) => {
              const finished = status === 'done' || (status !== 'failed' && i < reached)
              return (
                <li key={k} className="row" style={{ color: finished ? 'var(--ok)' : i === reached ? 'var(--text)' : 'var(--muted)' }}>
                  {finished ? <CheckIcon size={16} /> : i === reached && status !== 'failed' ? <Spinner /> : <span style={{ width: 16 }} />}
                  {label}
                </li>
              )
            })}
          </ul>
          {status === 'failed' && <Alert tone="bad" title="The update did not finish">{build.ota.error}. The device keeps running its old firmware.</Alert>}
          {status === 'done' && <Alert tone="ok">Done: the device is running the new firmware.</Alert>}
          <div className="form-actions">
            <Button variant={status === 'done' ? 'primary' : undefined} onClick={onClose}>
              {status === 'done' || status === 'failed' ? 'Close' : 'Close (keeps going in the background)'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
