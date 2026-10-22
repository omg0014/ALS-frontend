import { useMemo, useState } from 'react'
import { Building, DoorOpen, Lightbulb, Power, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { canControl } from '../../lib/permissions.js'
import { groupStatus } from '../../lib/status.js'
import { useTick } from '../../hooks/useTick.js'
import { Alert, Button, Card, EmptyState, LinkButton, Loading, PageHeader } from '../../components/ui/index.js'
import { RoomCard } from './RoomCard.jsx'
import { useSwitching } from './useSwitching.jsx'

export default function ControlPage() {
  const { user } = useAuth()
  const { data, index, error, cmds } = useLive()
  const { send, sendWithConfirm } = useSwitching()
  const [floorFilter, setFloorFilter] = useState('all')
  const [q, setQ] = useState('')
  useTick(15000)

  const floors = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.floors
      .filter((f) => floorFilter === 'all' || f._id === floorFilter)
      .map((f) => ({ floor: f, rooms: (index.roomsByFloor.get(f._id) ?? []).filter((r) => !needle || r.displayName.toLowerCase().includes(needle)) }))
      .filter((x) => !needle || x.rooms.length)
  }, [data, index, floorFilter, q])

  if (error && !data) return <Alert tone="bad">Could not load: {error}</Alert>
  if (!data) return <Loading />

  const groupsOn = data.groups.filter((g) => groupStatus(index, cmds, g._id).state === 'on').length

  return (
    <>
      <PageHeader
        title="Lights & fans"
        description={`Switch the lights and fans in any room. ${groupsOn} of ${data.groups.length} groups are on right now.`}
      />

      <Alert tone="info">
        The wall switches keep working: when a group is <strong>on</strong> here, its wall switches and fan regulators work as usual. When it is{' '}
        <strong>off</strong>, that group has no power.
      </Alert>

      {canControl(user, 'all') && (
        <Card className="school-bar" style={{ marginTop: 16 }}>
          <div className="row">
            <span className="icon-chip">
              <Building aria-hidden="true" />
            </span>
            <div>
              <h3>Whole school</h3>
              <div className="small muted">Every room on every floor</div>
            </div>
          </div>
          <div className="row">
            <Button variant="on" icon={Power} onClick={() => sendWithConfirm({ kind: 'all' }, 'ON')}>
              Everything on
            </Button>
            <Button icon={Power} onClick={() => sendWithConfirm({ kind: 'all' }, 'OFF')}>
              Everything off
            </Button>
          </div>
        </Card>
      )}

      {data.floors.length > 0 && (
        <div className="filters" style={{ marginTop: 20 }}>
          <div className="search">
            <Search aria-hidden="true" />
            <input placeholder="Find a room…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {data.floors.length > 1 && (
            <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} aria-label="Floor">
              <option value="all">All floors</option>
              {data.floors.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!data.floors.length && (
        <Card>
          <EmptyState icon={DoorOpen} title="No rooms yet" action={<LinkButton to="/rooms" variant="primary">Set up rooms</LinkButton>}>
            Add the floors and rooms of the school first, then their lights and fans.
          </EmptyState>
        </Card>
      )}
      {q && !floors.length && <EmptyState icon={Search} title="No room matches your search" />}

      {floors.map(({ floor, rooms }) => (
        <section key={floor._id} className="floor-block">
          <div className="floor-head">
            <h2>{floor.name}</h2>
            {canControl(user, 'floor', floor._id) && rooms.length > 0 && (
              <div className="row">
                <Button size="sm" variant="on" icon={Lightbulb} onClick={() => sendWithConfirm({ kind: 'floor', id: floor._id }, 'ON')}>
                  Floor on
                </Button>
                <Button size="sm" icon={Power} onClick={() => sendWithConfirm({ kind: 'floor', id: floor._id }, 'OFF')}>
                  Floor off
                </Button>
              </div>
            )}
          </div>
          {!rooms.length ? (
            <p className="small muted">No rooms on this floor yet.</p>
          ) : (
            <div className="grid-cards">
              {rooms.map((room) => (
                <RoomCard key={room._id} room={room} allowed={canControl(user, 'room', floor._id)} send={send} />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}
