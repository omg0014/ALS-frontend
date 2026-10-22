import { Link } from 'react-router-dom'
import { useLive } from '../../context/LiveContext.js'
import { groupStatus } from '../../lib/status.js'
import { STAGES } from '../../lib/labels.js'
import { timeAgo } from '../../lib/format.js'
import { Badge, Button, Spinner, Switch } from '../../components/ui/index.js'
import { GroupIcon } from '../../components/GroupIcon.jsx'

// One room: its lighting groups with an ON/OFF switch each, plus "all on / all off" for the room.
export function RoomCard({ room, allowed, send }) {
  const { index, cmds } = useLive()
  const groups = index.groupsByRoom.get(room._id) ?? []
  const devices = (index.devicesByRoom.get(room._id) ?? []).filter((d) => d.status === 'active')
  const online = devices.filter((d) => d.state?.online).length
  const statuses = groups.map((g) => [g, groupStatus(index, cmds, g._id)])
  const canSwitchRoom = allowed && statuses.some(([, s]) => s.anyOnline)
  const anyOn = statuses.some(([, s]) => s.anyOnline && (s.state === 'on' || s.state === 'mixed'))

  return (
    <div className={`card room-card ${anyOn ? 'has-on' : ''}`}>
      <div className="room-head">
        <div style={{ minWidth: 0 }}>
          <h3>{room.displayName}</h3>
          <div className="room-meta">
            {devices.length ? (
              <span className={`status ${online === devices.length ? 'online' : 'offline'}`}>
                <span className="status-dot" />
                {online === devices.length ? 'Connected' : online ? `${online} of ${devices.length} devices connected` : 'Device offline'}
              </span>
            ) : (
              <span>No device yet</span>
            )}
            {room.stage !== 'live' && <Badge>{STAGES[room.stage]}</Badge>}
          </div>
        </div>
        {allowed && groups.length > 0 && (
          <div className="segmented" role="group" aria-label={`${room.displayName} all lights`}>
            <Button size="sm" disabled={!canSwitchRoom} onClick={() => send({ kind: 'room', id: room._id }, 'ON')}>
              All on
            </Button>
            <Button size="sm" disabled={!canSwitchRoom} onClick={() => send({ kind: 'room', id: room._id }, 'OFF')}>
              All off
            </Button>
          </div>
        )}
      </div>

      {!groups.length && (
        <p className="small muted">
          No lights or fans added yet. <Link to="/rooms">Add them in Rooms</Link>.
        </p>
      )}
      {statuses.map(([g, s]) => (
        <GroupRow key={g._id} group={g} status={s} allowed={allowed} send={send} />
      ))}
    </div>
  )
}

function stateText(s) {
  if (!s.wired) return <span>Not connected to a device yet</span>
  if (!s.anyOnline) {
    const last = s.feeds.map((f) => f.device.state?.lastSeen).filter(Boolean).sort().at(-1)
    return <span title={`Last seen ${timeAgo(last)}`}>Device offline · was {s.state === 'on' ? 'on' : 'off'}</span>
  }
  if (s.pending)
    return (
      <>
        <Spinner label="Switching" /> Switching…
      </>
    )
  if (s.notConfirmed) return <span className="bad-text">Did not respond. Check the device.</span>
  if (s.queued) return <span>Will switch when the device is back</span>
  if (s.state === 'on') return <span className="on-text">On</span>
  if (s.state === 'mixed') return <span className="on-text">Partly on</span>
  return <span>Off</span>
}

function GroupRow({ group, status: s, allowed, send }) {
  return (
    <div className={`group-row ${!s.anyOnline ? 'is-off-line' : ''}`}>
      <GroupIcon type={group.type} on={s.state === 'on' && s.anyOnline} />
      <div className="group-text">
        <div className="group-name">{group.name}</div>
        <div className="group-state">{stateText(s)}</div>
      </div>
      <Switch
        state={s.state}
        label={group.name}
        disabled={!allowed || !s.wired || !s.anyOnline || s.pending}
        onToggle={() => send({ kind: 'group', id: group._id }, s.state === 'on' ? 'OFF' : 'ON')}
      />
    </div>
  )
}
