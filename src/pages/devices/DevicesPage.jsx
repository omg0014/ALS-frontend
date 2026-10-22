import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CirclePlus, Cpu, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.js'
import { useLive } from '../../context/LiveContext.js'
import { isEditor } from '../../lib/permissions.js'
import { ESP_NAMES } from '../../lib/labels.js'
import { timeAgo } from '../../lib/format.js'
import { useTick } from '../../hooks/useTick.js'
import { Badge, Card, EmptyState, LinkButton, Loading, PageHeader, StatusDot } from '../../components/ui/index.js'

const STATUS_FILTERS = {
  all: 'All devices',
  online: 'Connected',
  offline: 'Offline',
  update: 'Needs a firmware update',
  unverified: 'Hardware not yet tested',
  spare: 'Spare (no room)',
}

export default function DevicesPage() {
  const { user } = useAuth()
  const { data, index } = useLive()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [floor, setFloor] = useState('all')
  const [status, setStatus] = useState('all')
  useTick(15000)

  const rows = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.devices
      .map((d) => {
        const room = index.rooms.get(d.room)
        return { d, room, floor: room && index.floors.get(room.floor), profile: index.profiles.get(d.profile) }
      })
      .filter(({ d, room, floor: f, profile }) => {
        if (floor !== 'all' && f?._id !== floor) return false
        if (needle && ![d.name, d.deviceId, room?.displayName, room?.roomNumber, f?.name].join(' ').toLowerCase().includes(needle)) return false
        switch (status) {
          case 'online': return d.state?.online
          case 'offline': return !d.state?.online
          case 'unverified': return profile && !profile.verified
          case 'update': return d.updateNeeded
          case 'spare': return d.status === 'spare'
          default: return true
        }
      })
      .sort((a, b) => (a.floor?.order ?? 999) - (b.floor?.order ?? 999) || (a.room?.displayName ?? '').localeCompare(b.room?.displayName ?? ''))
  }, [data, index, q, floor, status])

  if (!data) return <Loading />

  return (
    <>
      <PageHeader
        title="Devices"
        description="The relay boxes in the rooms. Each one switches up to four groups of lights or fans."
        actions={
          isEditor(user) && (
            <LinkButton to="/devices/new" variant="primary" icon={CirclePlus}>
              Add a device
            </LinkButton>
          )
        }
      />

      {!data.devices.length ? (
        <Card>
          <EmptyState
            icon={Cpu}
            title="No devices yet"
            action={isEditor(user) && <LinkButton to="/devices/new" variant="primary" icon={CirclePlus}>Add the first device</LinkButton>}
          >
            Adding a device takes you through choosing the room, the hardware and the WiFi, and then uploading its firmware.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="filters">
            <div className="search">
              <Search aria-hidden="true" />
              <input placeholder="Find a device or room…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={floor} onChange={(e) => setFloor(e.target.value)} aria-label="Floor">
              <option value="all">All floors</option>
              {data.floors.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              {Object.entries(STATUS_FILTERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Hardware</th>
                  <th>Firmware</th>
                  <th>WiFi signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, room, floor: f, profile }) => (
                  <tr key={d._id} className="clickable" onClick={() => navigate(`/devices/${d._id}`)}>
                    <td>
                      <div className="strong">{d.name}</div>
                      <div className="sub mono">{d.deviceId}</div>
                    </td>
                    <td>
                      {room?.displayName ?? <span className="muted">no room</span>}
                      <div className="sub">{f?.name}</div>
                    </td>
                    <td>
                      <StatusDot online={d.state?.online} />
                      <div className="sub">{d.state?.online ? `since ${timeAgo(d.state.onlineSince)}` : `last seen ${timeAgo(d.state?.lastSeen)}`}</div>
                    </td>
                    <td>
                      <div className="row">
                        <span>
                          {profile?.code} · {ESP_NAMES[profile?.espModel]}
                        </span>
                        {profile && !profile.verified && <Badge tone="warn">not tested</Badge>}
                      </div>
                      <div className="sub">{d.channels.length} relays</div>
                    </td>
                    <td>
                      {d.firmwareVersion || <span className="muted">not uploaded</span>}
                      {d.updateNeeded && (
                        <div>
                          <Badge tone="info" title={d.updateReasons.map((r) => r.reason).join('\n')}>
                            update needed
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td>
                      {d.state?.rssi != null ? (
                        <Badge tone={d.state.rssi < data.settings.rssiAlertDbm ? 'warn' : 'ok'}>{d.state.rssi < data.settings.rssiAlertDbm ? 'Weak' : 'Good'} ({d.state.rssi} dBm)</Badge>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <EmptyState icon={Search} title="No device matches these filters" />}
          </div>
        </>
      )}
    </>
  )
}
