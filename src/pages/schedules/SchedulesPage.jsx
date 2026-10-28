import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Pause, Pencil, Play, Plus, Power, Trash2 } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { canControl, isEditor } from '../../lib/permissions.js'
import { groupStatus } from '../../lib/status.js'
import { useTick } from '../../hooks/useTick.js'
import { Alert, Badge, Button, Card, EmptyState, Loading, PageHeader } from '../../components/ui/index.js'
import { useSwitching } from '../control/useSwitching.jsx'
import { ScheduleForm } from './ScheduleForm.jsx'
import { daysText, slotText, whenText } from './scheduleText.js'
import '../../styles/schedules.css'

const REFRESH_MS = 20000

// The lines a schedule switches, from the live building data
function targetGroups(index, target) {
  if (target.kind === 'group') return index.groups.has(target.id) ? [target.id] : []
  if (target.kind === 'room') return (index.groupsByRoom.get(target.id) ?? []).map((g) => g._id)
  if (target.kind === 'floor') return (index.roomsByFloor.get(target.id) ?? []).flatMap((r) => (index.groupsByRoom.get(r._id) ?? []).map((g) => g._id))
  return [...index.groups.keys()]
}

export default function SchedulesPage() {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | schedule
  useTick(REFRESH_MS)

  const load = useCallback(() => {
    api('/schedules')
      .then((r) => {
        setList(r.schedules)
        setError(null)
      })
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS) // next / last times move on by themselves
    return () => clearInterval(t)
  }, [load])

  return (
    <>
      <PageHeader
        title="Schedules"
        description="Turn lights and fans ON and OFF by themselves at set times, e.g. 9:00 to 10:00, or ON at 11:00 for 30 minutes."
        actions={
          isEditor(user) && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              New schedule
            </Button>
          )
        }
      />

      <Alert tone="info">
        You can always switch by hand, here or on <strong>Lights &amp; fans</strong>. A schedule never blocks you: it only acts again at its next ON or OFF time.
      </Alert>

      <div className="stack" style={{ marginTop: 16 }}>
        {error && !list && <Alert tone="bad">Could not load: {error}</Alert>}
        {!list && !error && <Loading />}
        {list?.length === 0 && (
          <Card>
            <EmptyState
              icon={CalendarClock}
              title="No schedules yet"
              action={
                isEditor(user) && (
                  <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                    New schedule
                  </Button>
                )
              }
            >
              Add one to switch a classroom, a line, a floor or the whole school at set times.
            </EmptyState>
          </Card>
        )}
        {list?.map((s) => (
          <ScheduleCard key={s._id} schedule={s} onEdit={() => setEditing(s)} onChanged={load} />
        ))}
      </div>

      {editing && (
        <ScheduleForm
          schedule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

function ScheduleCard({ schedule: s, onEdit, onChanged }) {
  const { user } = useAuth()
  const { index, cmds } = useLive()
  const { send, sendWithConfirm } = useSwitching()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const missing = !s.targetLabel
  const canEdit = canControl(user, s.target.kind === 'group' || s.target.kind === 'room' ? 'room' : s.target.kind, s.floorId)
  const statuses = index && !missing ? targetGroups(index, s.target).map((g) => groupStatus(index, cmds, g)) : []
  const wired = statuses.filter((x) => x.wired)
  const onCount = wired.filter((x) => x.state === 'on' || x.state === 'mixed').length
  const nextOn = s.next.find((e) => e.state === 'ON')
  const turnsOff = s.slots.some((slot) => slot.kind !== 'on')

  // Manual ON/OFF for this schedule's target (floor and whole school ask first, like on Lights & fans)
  const switchNow = (state) => {
    const target = s.target.kind === 'all' ? { kind: 'all' } : s.target
    return ['floor', 'all'].includes(s.target.kind) ? sendWithConfirm(target, state) : send(target, state)
  }

  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const togglePause = () =>
    run(async () => {
      await api(`/schedules/${s._id}`, { method: 'PATCH', body: { enabled: !s.enabled } })
      toast.ok(s.enabled ? `"${s.name}" paused` : `"${s.name}" active again from its next time`)
    })

  const remove = async () => {
    const ok = await confirm({ title: `Delete "${s.name}"?`, message: <p>Its times stop. Lights stay as they are now.</p>, confirmLabel: 'Delete', tone: 'danger' })
    if (ok)
      run(async () => {
        await api(`/schedules/${s._id}`, { method: 'DELETE' })
        toast.ok(`"${s.name}" deleted`)
      })
  }

  return (
    <Card className={`schedule-card ${s.enabled ? '' : 'is-paused'}`} aria-label={`Schedule ${s.name}`}>
      <div className="schedule-head">
        <div style={{ minWidth: 0 }}>
          <h3>{s.name}</h3>
          <div className="schedule-target">{missing ? 'Its line, classroom or floor was deleted' : s.targetLabel}</div>
        </div>
        <div className="row">
          {missing ? <Badge tone="bad">Nothing to switch</Badge> : s.enabled ? <Badge tone="ok">Active</Badge> : <Badge>Paused</Badge>}
          {s.onNow && <Badge tone="on">In an ON time now</Badge>}
        </div>
      </div>

      <dl className="kv schedule-kv">
        <dt>Days</dt>
        <dd>{daysText(s.days)}</dd>
        <dt>Times</dt>
        <dd>
          <ul className="slot-list">
            {s.slots.map((slot, i) => (
              <li key={i}>{slotText(slot)}</li>
            ))}
          </ul>
        </dd>
        {s.enabled && !missing && (
          <>
            <dt>Next</dt>
            <dd>{s.next.length ? s.next.map((e) => `${e.state} ${whenText(e.at)}`).join(', then ') : '–'}</dd>
          </>
        )}
        {s.lastRun?.at && (
          <>
            <dt>Last</dt>
            <dd>
              <LastRun run={s.lastRun} />
            </dd>
          </>
        )}
        {wired.length > 0 && (
          <>
            <dt>Right now</dt>
            <dd>
              {onCount ? <span className="on-text">ON</span> : 'OFF'}
              {statuses.length > 1 && <span className="muted"> · {onCount} of {statuses.length} lines on</span>}
              {s.enabled && s.onNow && !onCount && nextOn && <span className="muted"> · switched off by hand, ON again {whenText(nextOn.at)}</span>}
              {s.enabled && !s.onNow && onCount > 0 && turnsOff && <span className="muted"> · switched on by hand, the schedule turns it OFF at its next OFF time</span>}
            </dd>
          </>
        )}
      </dl>

      <div className="schedule-actions">
        {!missing && canControl(user, s.target.kind === 'group' ? 'room' : s.target.kind, s.floorId) && (
          <div className="row">
            <Button variant="on" size="sm" icon={Power} disabled={busy || !wired.length} onClick={() => switchNow('ON')}>
              Turn on now
            </Button>
            <Button size="sm" icon={Power} disabled={busy || !wired.length} onClick={() => switchNow('OFF')}>
              Turn off now
            </Button>
          </div>
        )}
        {canEdit && (
          <div className="row">
            <Button size="sm" variant="ghost" icon={s.enabled ? Pause : Play} disabled={busy || missing} onClick={togglePause}>
              {s.enabled ? 'Pause' : 'Resume'}
            </Button>
            <Button size="sm" variant="ghost" icon={Pencil} disabled={busy || missing} onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" icon={Trash2} disabled={busy} onClick={remove}>
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function LastRun({ run }) {
  const lateMin = Math.round((new Date(run.at) - new Date(run.due)) / 60000)
  if (run.error)
    return (
      <span className="bad-text">
        {run.state} {whenText(run.due)} did not work: {run.error}
      </span>
    )
  return (
    <span>
      Turned {run.state} {whenText(run.due)}
      {lateMin >= 2 && <span className="muted"> ({lateMin} min late)</span>}
      {run.queuedOffline > 0 && <span className="muted"> · {run.queuedOffline} waiting for an offline device</span>}
      {run.skipped > 0 && <span className="muted"> · {run.skipped} kept ON by another schedule</span>}
    </span>
  )
}
