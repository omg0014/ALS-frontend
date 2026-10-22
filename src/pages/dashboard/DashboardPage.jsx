import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CircleCheck, CirclePlus, Cpu, DoorOpen, LifeBuoy, Lightbulb, Power, TriangleAlert } from 'lucide-react'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { canControl, isEditor } from '../../lib/permissions.js'
import { groupStatus } from '../../lib/status.js'
import { ALERT_LABELS } from '../../lib/labels.js'
import { greeting, todayText } from '../../lib/format.js'
import { Badge, Card, EmptyState, Loading, StatCard } from '../../components/ui/index.js'
import { Facade } from '../../components/Facade.jsx'
import { useSwitching } from '../control/useSwitching.jsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, index, cmds, connected } = useLive()
  const { sendWithConfirm } = useSwitching()
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const load = () => api('/alerts').then(setAlerts).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (!data) return <Loading />

  const active = data.devices.filter((d) => d.status === 'active')
  const online = active.filter((d) => d.state?.online).length
  const groupsOn = data.groups.filter((g) => groupStatus(index, cmds, g._id).state === 'on').length
  const live = data.rooms.filter((r) => r.stage === 'live').length
  const serious = alerts.filter((a) => a.severity !== 'info')

  return (
    <>
      <div className="hello">
        <div>
          <div className="hello-meta">
            <span className="hello-chip">
              <CalendarDays aria-hidden="true" />
              {todayText()}
            </span>
            <span className="hello-chip">
              <span className={`status ${connected ? 'online' : 'offline'}`}>
                <span className="status-dot" />
              </span>
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          <h1>
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="muted">Here is how the school's lights and fans are doing right now.</p>
        </div>
        {data.groups.length > 0 && (
          <div className="hello-glance">
            {/* One window per lighting group, lit when the group is on */}
            <Facade windows={data.groups.slice(0, 40).map((g) => ({ lit: groupStatus(index, cmds, g._id).state === 'on' }))} />
            <span className="hello-glance-label">
              {groupsOn} of {data.groups.length} groups on
            </span>
          </div>
        )}
      </div>

      <div className="grid-stats">
        <StatCard icon={Lightbulb} tone="on" label="Lights & fans on" value={groupsOn} total={data.groups.length} sub="lighting groups" />
        <StatCard icon={Cpu} tone={online === active.length ? 'ok' : 'bad'} label="Devices connected" value={online} total={active.length} sub={active.length - online ? `${active.length - online} offline` : 'all working'} />
        <StatCard icon={DoorOpen} label="Rooms in use" value={live} total={data.rooms.length} sub="marked Live" />
        <StatCard icon={TriangleAlert} tone={serious.length ? 'bad' : 'ok'} label="Needs attention" value={serious.length} sub={serious.length ? 'see below' : 'nothing to do'} />
      </div>

      <div className="grid-2 section">
        <Card title="Needs attention" icon={TriangleAlert} description="Devices that are offline, restarting or have weak WiFi.">
          {!alerts.length ? (
            <EmptyState icon={CircleCheck} title="All good">
              Every device is connected and working.
            </EmptyState>
          ) : (
            alerts.map((a) => (
              <div key={`${a.deviceId}-${a.kind}`} className="attention-item">
                <Badge tone={a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'neutral'}>{ALERT_LABELS[a.kind] ?? a.kind}</Badge>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/devices/${a.device}`}>
                    {a.name} · {a.room}
                  </Link>
                  <div className="small muted">{a.message}</div>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card title="Quick actions">
          <div className="quick-actions">
            <QuickAction to="/control" icon={Lightbulb} title="Switch lights & fans" text="Turn rooms, floors or single groups on and off" />
            {canControl(user, 'all') && (
              <QuickAction icon={Power} title="Turn everything off" text="All lights and fans in the whole school" onClick={() => sendWithConfirm({ kind: 'all' }, 'OFF')} />
            )}
            {isEditor(user) && <QuickAction to="/devices/new" icon={CirclePlus} title="Add a device" text="Register a new relay box and upload its firmware" />}
            <QuickAction to="/help" icon={LifeBuoy} title="Help & guides" text="Step-by-step help and troubleshooting" />
          </div>
        </Card>
      </div>

      {data.floors.length > 0 && (
        <Card title="Floors" className="section" flush>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Floor</th>
                  <th>Rooms</th>
                  <th>Devices connected</th>
                  <th>Groups on</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.floors.map((f) => {
                  const rooms = index.roomsByFloor.get(f._id) ?? []
                  const roomIds = new Set(rooms.map((r) => r._id))
                  const devs = active.filter((d) => roomIds.has(d.room))
                  const groups = data.groups.filter((g) => roomIds.has(g.room))
                  const on = groups.filter((g) => groupStatus(index, cmds, g._id).state === 'on').length
                  return (
                    <tr key={f._id}>
                      <td className="strong">{f.name}</td>
                      <td>{rooms.length}</td>
                      <td>
                        {devs.filter((d) => d.state?.online).length} / {devs.length}
                      </td>
                      <td>
                        {on} / {groups.length}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to="/control" className="small">
                          Open <ArrowRight size={14} style={{ verticalAlign: '-2px' }} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

function QuickAction({ to, onClick, icon: Icon, title, text }) {
  const body = (
    <>
      <span className="icon-chip">
        <Icon aria-hidden="true" />
      </span>
      <span className="quick-action-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <ArrowRight size={16} className="muted" aria-hidden="true" />
    </>
  )
  return to ? (
    <Link to={to} className="quick-action">
      {body}
    </Link>
  ) : (
    <button type="button" className="quick-action" onClick={onClick}>
      {body}
    </button>
  )
}
