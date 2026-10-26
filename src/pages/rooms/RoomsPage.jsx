import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, DoorOpen, Layers, Pencil, Plus, Trash, TriangleAlert } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { isAdmin, isEditor } from '../../lib/permissions.js'
import { GROUP_TYPES, ROOM_TYPES, STAGES } from '../../lib/labels.js'
import { Badge, Button, Card, EmptyState, LinkButton, Loading, PageHeader } from '../../components/ui/index.js'
import { GroupIcon } from '../../components/GroupIcon.jsx'
import { FloorModal, GroupModal, RoomModal } from './RoomForms.jsx'

// Same rules as the server (Electrical wiring model): shown, never hidden.
function loadWarning(profile, group) {
  if (!profile) return null
  const a = Number(group.estimatedAmps) || 0
  if (profile.contactRatingA && a > profile.contactRatingA) return `${a} A is more than the relay can switch (${profile.contactRatingA} A)`
  if (profile.maxAmpsPerChannel && a > profile.maxAmpsPerChannel) return `${a} A is above the safe ${profile.maxAmpsPerChannel} A for this relay: split it or use a contactor`
  if (group.type === 'ac' && (profile.contactRatingA ?? 0) < 30) return 'An AC needs the 30 A relay'
  if (group.type === 'all' && (profile.contactRatingA ?? 0) < 30) return 'A whole classroom (lights + fans + TV) on one relay needs the 30 A relay'
  if (profile.contactRatingA >= 30 && !['ac', 'load', 'all'].includes(group.type)) return 'The 30 A relay is meant for an AC, a TV point or a whole classroom'
  return null
}

export default function RoomsPage() {
  const { user } = useAuth()
  const { data, index, refresh } = useLive()
  const toast = useToast()
  const confirm = useConfirm()
  const [modal, setModal] = useState(null)

  if (!data) return <Loading />

  const remove = async (path, what) => {
    if (!(await confirm({ title: `Delete ${what}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return
    try {
      await api(path, { method: 'DELETE' })
      await refresh()
      toast.ok(`${what} deleted`)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Rooms"
        description="Floors, rooms and the lights & fans in each room. Renaming or moving things here never needs a firmware update."
        actions={
          isAdmin(user) && (
            <Button variant="primary" icon={Plus} onClick={() => setModal({ kind: 'floor' })}>
              Add floor
            </Button>
          )
        }
      />

      {!data.floors.length && (
        <Card>
          <EmptyState
            icon={Layers}
            title="Start by adding a floor"
            action={
              isAdmin(user) && (
                <Button variant="primary" icon={Plus} onClick={() => setModal({ kind: 'floor' })}>
                  Add floor
                </Button>
              )
            }
          >
            Then add the rooms on that floor and the lights and fans in each room.
          </EmptyState>
        </Card>
      )}

      {data.floors.map((floor) => {
        const rooms = index.roomsByFloor.get(floor._id) ?? []
        return (
          <section key={floor._id} className="floor-block">
            <div className="floor-head">
              <h2>
                <Layers size={19} aria-hidden="true" />
                {floor.name} <span className="small muted">· {rooms.length} room{rooms.length === 1 ? '' : 's'}</span>
              </h2>
              {isAdmin(user) && (
                <div className="row">
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => setModal({ kind: 'room', floor: floor._id })}>
                    Add room
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${floor.name}`} title="Edit floor" onClick={() => setModal({ kind: 'floor', item: floor })} />
                  <Button size="sm" variant="ghost" icon={Trash} aria-label={`Delete ${floor.name}`} title="Delete floor" onClick={() => remove(`/floors/${floor._id}`, floor.name)} />
                </div>
              )}
            </div>
            {!rooms.length ? (
              <p className="small muted">No rooms on this floor yet.</p>
            ) : (
              <div className="grid-cards">
                {rooms.map((room) => (
                  <RoomCard key={room._id} room={room} user={user} setModal={setModal} remove={remove} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {modal?.kind === 'floor' && <FloorModal item={modal.item} onClose={() => setModal(null)} />}
      {modal?.kind === 'room' && <RoomModal item={modal.item} floor={modal.floor} onClose={() => setModal(null)} />}
      {modal?.kind === 'group' && <GroupModal item={modal.item} room={modal.room} onClose={() => setModal(null)} />}
    </>
  )
}

function RoomCard({ room, user, setModal, remove }) {
  const { index } = useLive()
  const groups = index.groupsByRoom.get(room._id) ?? []
  const devices = (index.devicesByRoom.get(room._id) ?? []).filter((d) => d.status !== 'retired')

  return (
    <div className="card stack-sm">
      <div className="room-head">
        <div style={{ minWidth: 0 }}>
          <h3>{room.displayName}</h3>
          <div className="room-meta">
            <Badge>{ROOM_TYPES[room.type]}</Badge>
            <Badge tone={room.stage === 'live' ? 'ok' : 'neutral'}>{STAGES[room.stage]}</Badge>
            {room.roomNumber && <span>Room {room.roomNumber}</span>}
          </div>
        </div>
        {isAdmin(user) && (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Button size="sm" variant="ghost" icon={Pencil} aria-label="Edit room" title="Edit room" onClick={() => setModal({ kind: 'room', item: room })} />
            <Button size="sm" variant="ghost" icon={Trash} aria-label="Delete room" title="Delete room" onClick={() => remove(`/rooms/${room._id}`, room.displayName)} />
          </div>
        )}
      </div>

      <div className="small muted">
        Device:{' '}
        {devices.length
          ? devices.map((d, i) => (
              <span key={d._id}>
                {i > 0 && ', '}
                <Link to={`/devices/${d._id}`}>{d.name}</Link>
              </span>
            ))
          : 'none yet'}
      </div>

      <div>
        {!groups.length && (
          <EmptyState icon={DoorOpen} title="No lights or fans yet">
            Add each set of switches that should be controlled together.
          </EmptyState>
        )}
        {groups.map((g) => {
          const feeds = index.channelsByGroup.get(g._id) ?? []
          const warnings = feeds.map((f) => loadWarning(index.profiles.get(f.device.profile), g)).filter(Boolean)
          return (
            <div key={g._id} className="group-row">
              <GroupIcon type={g.type} />
              <div className="group-text">
                <div className="group-name">{g.name}</div>
                <div className="group-state">
                  {GROUP_TYPES[g.type]} · {g.estimatedAmps} A{g.switches && ` · ${g.switches}`}
                </div>
                <div className="group-state">
                  {feeds.length ? feeds.map((f) => <span key={f.channel._id}>relay {f.channel.index} of {f.device.name}</span>) : <span>not connected to a device yet</span>}
                </div>
                {warnings.map((w) => (
                  <div key={w} className="group-state" style={{ color: 'var(--warn)' }}>
                    <TriangleAlert size={13} aria-hidden="true" /> {w}
                  </div>
                ))}
              </div>
              {isEditor(user) && (
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${g.name}`} title="Edit" onClick={() => setModal({ kind: 'group', item: g })} />
                  <Button size="sm" variant="ghost" icon={Trash} aria-label={`Delete ${g.name}`} title="Delete" onClick={() => remove(`/groups/${g._id}`, g.name)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="row-between" style={{ marginTop: 4 }}>
        {isEditor(user) ? (
          <Button size="sm" icon={Plus} onClick={() => setModal({ kind: 'group', room: room._id })}>
            Add lights / fans
          </Button>
        ) : (
          <span />
        )}
        <LinkButton size="sm" variant="ghost" icon={ClipboardCheck} to={`/rooms/${room._id}/install`}>
          Installation steps
        </LinkButton>
      </div>
    </div>
  )
}
