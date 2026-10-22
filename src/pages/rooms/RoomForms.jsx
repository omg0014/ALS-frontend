import { useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { GROUP_TYPES, ROOM_TYPES, STAGES } from '../../lib/labels.js'
import { Alert, Button, Field, Modal, Warnings } from '../../components/ui/index.js'

// Create or edit; closes on success, shows server warnings (e.g. load too high) before closing.
function useSave(path, item, onClose, what) {
  const toast = useToast()
  const { refresh } = useLive()
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])
  const save = async (body) => {
    setError(null)
    try {
      const r = await api(item ? `${path}/${item._id}` : path, { method: item ? 'PUT' : 'POST', body })
      await refresh()
      toast.ok(`${what} ${item ? 'saved' : 'added'}`)
      if (r?.warnings?.length) setWarnings(r.warnings)
      else onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }
  return { save, error, warnings }
}

function Actions({ onClose, label = 'Save' }) {
  return (
    <div className="form-actions">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary">
        {label}
      </Button>
    </div>
  )
}

export function FloorModal({ item, onClose }) {
  const [form, setForm] = useState({ name: item?.name ?? '', order: item?.order ?? 0 })
  const { save, error } = useSave('/floors', item, onClose, 'Floor')
  return (
    <Modal title={item ? 'Edit floor' : 'Add a floor'} onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), save({ ...form, order: Number(form.order) }))}>
        <Field label="Floor name">
          <input required autoFocus placeholder="e.g. Ground floor" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Position in the list" hint="Floors are shown from the lowest number up (0 = first).">
          <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
        </Field>
        {error && <Alert tone="bad">{error}</Alert>}
        <Actions onClose={onClose} label={item ? 'Save' : 'Add floor'} />
      </form>
    </Modal>
  )
}

export function RoomModal({ item, floor, onClose }) {
  const { data } = useLive()
  const [form, setForm] = useState({
    floor: item?.floor ?? floor,
    type: item?.type ?? 'classroom',
    standard: item?.standard ?? '',
    section: item?.section ?? '',
    roomNumber: item?.roomNumber ?? '',
    displayName: item?.displayName ?? '',
    stage: item?.stage ?? 'draft',
  })
  const { save, error } = useSave('/rooms', item, onClose, 'Room')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const suggested = [[form.standard, form.section].filter(Boolean).join('-'), form.roomNumber && `Room ${form.roomNumber}`].filter(Boolean).join(' · ')

  return (
    <Modal title={item ? 'Edit room' : 'Add a room'} onClose={onClose}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), save(form))}>
        <div className="form-grid">
          <Field label="Floor">
            <select value={form.floor} onChange={(e) => set({ floor: e.target.value })}>
              {data.floors.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type of room">
            <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(ROOM_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          {form.type === 'classroom' && (
            <>
              <Field label="Class (standard)">
                <input placeholder="e.g. 10" value={form.standard} onChange={(e) => set({ standard: e.target.value })} />
              </Field>
              <Field label="Section">
                <input placeholder="e.g. A" value={form.section} onChange={(e) => set({ section: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Room number">
            <input placeholder="e.g. 101" value={form.roomNumber} onChange={(e) => set({ roomNumber: e.target.value })} />
          </Field>
          {item && (
            <Field label="Status">
              <select value={form.stage} onChange={(e) => set({ stage: e.target.value })}>
                {Object.entries(STAGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Name shown on the website" hint={suggested ? `Leave empty to use "${suggested}"` : 'e.g. Reception, Staff room'}>
          <input value={form.displayName} required={!suggested} placeholder={suggested} onChange={(e) => set({ displayName: e.target.value })} />
        </Field>
        {error && <Alert tone="bad">{error}</Alert>}
        <Actions onClose={onClose} label={item ? 'Save' : 'Add room'} />
      </form>
    </Modal>
  )
}

export function GroupModal({ item, room, onClose }) {
  const [form, setForm] = useState({
    room: item?.room ?? room,
    name: item?.name ?? '',
    type: item?.type ?? 'lights',
    switches: item?.switches ?? '',
    estimatedAmps: item?.estimatedAmps ?? 0,
  })
  const { save, error, warnings } = useSave('/groups', item, onClose, 'Group')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  return (
    <Modal
      title={item ? 'Edit lights / fans group' : 'Add lights or fans'}
      description="A group is a set of wall switches controlled together by one relay of the device."
      onClose={onClose}
    >
      <form className="form" onSubmit={(e) => (e.preventDefault(), save({ ...form, estimatedAmps: Number(form.estimatedAmps) }))}>
        <div className="form-grid">
          <Field label="Name">
            <input required autoFocus placeholder="e.g. Front lights" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="What it controls">
            <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {Object.entries(GROUP_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Which wall switches" hint="So the electrician knows what is connected, e.g. Fan 1-3">
          <input value={form.switches} onChange={(e) => set({ switches: e.target.value })} />
        </Field>
        <Field
          label="Estimated load (amps)"
          hint="Keep well under the relay rating: about 4-5 A for the blue 10 A modules, about 4 A for the 7 A module. A whole MCB circuit must not go through one relay."
        >
          <input type="number" min="0" step="0.1" value={form.estimatedAmps} onChange={(e) => set({ estimatedAmps: e.target.value })} />
        </Field>
        <Warnings title="Saved, but please check" list={warnings} />
        {error && <Alert tone="bad">{error}</Alert>}
        {warnings.length ? (
          <div className="form-actions">
            <Button variant="primary" onClick={onClose}>
              OK
            </Button>
          </div>
        ) : (
          <Actions onClose={onClose} label={item ? 'Save' : 'Add group'} />
        )}
      </form>
    </Modal>
  )
}
