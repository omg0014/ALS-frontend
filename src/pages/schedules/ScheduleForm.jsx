import { useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { useToast } from '../../context/feedback.js'
import { canControl } from '../../lib/permissions.js'
import { Alert, Button, Field, Modal } from '../../components/ui/index.js'
import { DAY_ORDER, DAY_PRESETS, DAY_SHORT, browserTimeZone, slotText } from './scheduleText.js'

const NEW_SLOT = {
  range: { kind: 'range', start: '09:00', end: '10:00' },
  timer: { kind: 'timer', start: '09:00', minutes: 30 },
  on: { kind: 'on', start: '08:30' },
  off: { kind: 'off', start: '18:00' },
}
const ADD_BUTTONS = [
  ['range', 'Add a time', { start: '11:00', end: '12:00' }],
  ['timer', 'Add a timer', { start: '11:00' }],
  ['on', 'Add ON only', {}],
  ['off', 'Add OFF only', {}],
]

const targetKey = (t) => (t ? `${t.kind}:${t.id ?? ''}` : '')
const parseKey = (k) => {
  const [kind, id] = k.split(':')
  return kind === 'all' ? { kind } : { kind, id }
}

// Add or change a schedule: what it switches, on which days, and its ON times.
export function ScheduleForm({ schedule, onClose, onSaved }) {
  const { user } = useAuth()
  const { data, index } = useLive()
  const toast = useToast()
  const [form, setForm] = useState(() => ({
    name: schedule?.name ?? '',
    target: targetKey(schedule?.target),
    days: schedule?.days ?? [1, 2, 3, 4, 5],
    slots: schedule?.slots?.map((s) => ({ ...s })) ?? [{ ...NEW_SLOT.range }],
  }))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setSlot = (i, patch) => set({ slots: form.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) })

  // Whole school and floors (admins), then every classroom and its lines, on the floors this user may switch
  const options = useMemo(() => {
    if (!data) return []
    const floors = data.floors.filter((f) => canControl(user, 'room', f._id))
    return floors.map((f) => ({
      floor: f,
      rooms: (index.roomsByFloor.get(f._id) ?? []).map((r) => ({ room: r, groups: index.groupsByRoom.get(r._id) ?? [] })),
    }))
  }, [data, index, user])

  const toggleDay = (d) => set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] })

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.target) return setError('Choose what this schedule switches')
    setBusy(true)
    try {
      const body = { name: form.name, target: parseKey(form.target), days: form.days, slots: form.slots, timezone: schedule?.timezone ?? browserTimeZone() }
      const saved = await api(schedule ? `/schedules/${schedule._id}` : '/schedules', { method: schedule ? 'PUT' : 'POST', body })
      toast.ok(`Schedule "${saved.name}" saved`)
      onSaved(saved)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={schedule ? 'Change schedule' : 'New schedule'}
      description="On the days you choose: ON and OFF again at its end, or just ON or just OFF at one time (e.g. everything OFF at 6 PM). Switching by hand still works at any time."
      onClose={onClose}
      wide
    >
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name" hint='e.g. "10-B school day"'>
            <input id="sch-name" required maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="What it switches">
            <select id="sch-target" required value={form.target} onChange={(e) => set({ target: e.target.value })}>
              <option value="">Choose…</option>
              {canControl(user, 'all') && (
                <optgroup label="School">
                  <option value="all:">Whole school</option>
                  {data?.floors.map((f) => (
                    <option key={f._id} value={`floor:${f._id}`}>
                      {f.name} (whole floor)
                    </option>
                  ))}
                </optgroup>
              )}
              {options.map(({ floor, rooms }) => (
                <optgroup key={floor._id} label={floor.name}>
                  {rooms.flatMap(({ room, groups }) => [
                    <option key={room._id} value={`room:${room._id}`}>
                      {room.displayName} (whole classroom)
                    </option>,
                    ...groups.map((g) => (
                      <option key={g._id} value={`group:${g._id}`}>
                        {`   ${room.displayName} · ${g.name}`}
                      </option>
                    )),
                  ])}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>

        <section className="stack-sm">
          <div className="field-label">Days</div>
          <div className="day-picker" role="group" aria-label="Days">
            {DAY_ORDER.map((d) => (
              <button key={d} type="button" className="day-chip" aria-pressed={form.days.includes(d)} onClick={() => toggleDay(d)}>
                {DAY_SHORT[d]}
              </button>
            ))}
            <span className="day-presets">
              {DAY_PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant="ghost" onClick={() => set({ days: p.days })}>
                  {p.label}
                </Button>
              ))}
            </span>
          </div>
        </section>

        <section className="stack-sm">
          <div className="field-label">Times</div>
          {form.slots.map((slot, i) => (
            <div key={i} className="slot-row">
              <Field label="Kind">
                <select aria-label={`Time ${i + 1}: kind`} value={slot.kind} onChange={(e) => setSlot(i, { ...NEW_SLOT[e.target.value], start: slot.start })}>
                  <option value="range">From … to …</option>
                  <option value="timer">Timer</option>
                  <option value="on">Only ON at</option>
                  <option value="off">Only OFF at</option>
                </select>
              </Field>
              <Field label={slot.kind === 'off' ? 'OFF at' : 'ON at'}>
                <input
                  type="time"
                  aria-label={`Time ${i + 1}: ${slot.kind === 'off' ? 'OFF' : 'ON'} at`}
                  required
                  value={slot.start}
                  onChange={(e) => setSlot(i, { start: e.target.value })}
                />
              </Field>
              {slot.kind === 'on' || slot.kind === 'off' ? (
                <div className="slot-note small muted">{slot.kind === 'on' ? 'Stays ON until switched off' : 'Turns everything it switches OFF'}</div>
              ) : slot.kind === 'range' ? (
                <Field label="OFF at">
                  <input type="time" aria-label={`Time ${i + 1}: OFF at`} required value={slot.end} onChange={(e) => setSlot(i, { end: e.target.value })} />
                </Field>
              ) : (
                <Field label="OFF after (minutes)">
                  <input
                    type="number"
                    aria-label={`Time ${i + 1}: minutes`}
                    min={1}
                    max={720}
                    required
                    value={slot.minutes}
                    onChange={(e) => setSlot(i, { minutes: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </Field>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                aria-label={`Remove time ${i + 1}`}
                disabled={form.slots.length === 1}
                onClick={() => set({ slots: form.slots.filter((_, k) => k !== i) })}
              />
              {slot.start && (slot.kind === 'timer' ? slot.minutes > 0 : slot.kind === 'range' && slot.end) && <div className="slot-summary small muted">{slotText(slot)}</div>}
            </div>
          ))}
          <div className="row">
            {ADD_BUTTONS.map(([kind, label, patch]) => (
              <Button key={kind} size="sm" icon={Plus} disabled={form.slots.length >= 12} onClick={() => set({ slots: [...form.slots, { ...NEW_SLOT[kind], ...patch }] })}>
                {label}
              </Button>
            ))}
          </div>
        </section>

        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Save} disabled={busy}>
            {busy ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
