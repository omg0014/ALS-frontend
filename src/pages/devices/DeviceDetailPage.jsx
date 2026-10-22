import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, Cpu, Pencil, RefreshCw, Replace, Trash, Upload, Wifi } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { isAdmin, isEditor } from '../../lib/permissions.js'
import { GROUP_TYPES } from '../../lib/labels.js'
import { changedFields, formatDate, formatDateTime, formatUptime, timeAgo } from '../../lib/format.js'
import { useTick } from '../../hooks/useTick.js'
import { Alert, Badge, Button, Card, LinkButton, Loading, PageHeader, StatusDot, Warnings } from '../../components/ui/index.js'
import { CommandTable } from '../../components/CommandTable.jsx'
import { BuildHistory } from './BuildHistory.jsx'
import { EditDeviceModal, ReplaceBoardModal, WifiUpdateModal } from './DeviceModals.jsx'

export default function DeviceDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, index, refresh } = useLive()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [detail, setDetail] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  useTick(10000)

  const load = useCallback(async () => {
    try {
      setDetail(await api(`/devices/${id}`))
    } catch (err) {
      setError(errorText(err))
    }
  }, [id])

  useEffect(() => {
    load()
    api('/profiles').then(setProfiles).catch(() => {})
  }, [load])

  if (error) return <Alert tone="bad">{error}</Alert>
  if (!detail || !data) return <Loading />

  const { device, channels, commands, history } = detail
  const profile = device.profile
  const live = index.devices.get(device._id)?.state ?? detail.state
  const groups = device.room ? index.groupsByRoom.get(device.room._id) ?? [] : []
  const pins = profiles.find((p) => p._id === profile._id)?.allowedPins ?? []
  const editor = isEditor(user) && device.status !== 'retired'
  const boots = (live?.recentBoots ?? []).filter((t) => Date.now() - new Date(t) < 24 * 3600e3).length
  const weak = live?.rssi != null && live.rssi < data.settings.rssiAlertDbm

  const updateChannel = async (index, body) => {
    try {
      const r = await api(`/devices/${device._id}/channels/${index}`, { method: 'PUT', body })
      if (r.warnings?.length) toast.warn(r.warnings.join(' '))
      else toast.ok('Saved')
      load()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const retire = async () => {
    const ok = await confirm({
      title: `Remove ${device.name}?`,
      message: 'Use this when a board is taken out for good. Its relays are disconnected from the groups and it can no longer connect. The history is kept.',
      confirmLabel: 'Remove device',
      tone: 'danger',
    })
    if (!ok) return
    await api(`/devices/${device._id}/retire`, { method: 'POST' })
    await refresh() // so the list no longer shows it
    toast.ok(`${device.name} removed`)
    navigate('/devices')
  }

  return (
    <>
      <PageHeader
        back={{ to: '/devices', label: 'Devices' }}
        title={device.name}
        description={
          <>
            {device.room ? `${device.room.displayName}, ${device.room.floor?.name}` : 'No room (spare)'} · <span className="mono">{device.deviceId}</span>
          </>
        }
        actions={
          editor && (
            <>
              <LinkButton variant="primary" icon={Upload} to={`/devices/${device._id}/firmware`}>
                Upload firmware
              </LinkButton>
              <Button icon={Wifi} onClick={() => setModal('ota')}>
                Update over WiFi
              </Button>
              <Button icon={Pencil} onClick={() => setModal('edit')}>
                Edit
              </Button>
            </>
          )
        }
      />

      <div className="stack">
        {!profile.verified && (
          <Alert tone="warn" title={`Hardware type ${profile.code} is not tested yet`}>
            {profile.statusNote}. Use this device on the desk only, not in a classroom.
          </Alert>
        )}
        {device.updateNeeded && (
          <Alert
            tone="info"
            title="A firmware update is needed"
            action={
              editor && (
                <LinkButton size="sm" variant="primary" to={`/devices/${device._id}/firmware`}>
                  Update now
                </LinkButton>
              )
            }
          >
            {device.updateReasons.map((r) => r.reason).join('. ')}.
          </Alert>
        )}
        <Warnings title="Please check" list={detail.warnings.filter((w) => !w.startsWith(`Profile ${profile.code} is UNVERIFIED`))} />

        <div className="grid-2">
          <Card title="Status" icon={Activity}>
            <dl className="kv">
              <dt>Connection</dt>
              <dd>
                <StatusDot online={live?.online} onlineText="Connected" />
              </dd>
              <dt>Last heard from</dt>
              <dd>{live?.lastSeen ? timeAgo(live.lastSeen) : 'never'}</dd>
              <dt>WiFi signal</dt>
              <dd>{live?.rssi != null ? <Badge tone={weak ? 'warn' : 'ok'}>{weak ? 'Weak' : 'Good'} ({live.rssi} dBm)</Badge> : '–'}</dd>
              <dt>Running for</dt>
              <dd>{formatUptime(live?.uptime)}</dd>
              <dt>Restarts today</dt>
              <dd>
                {boots > 2 ? <Badge tone="bad">{boots}: check the 5 V power supply</Badge> : boots}
                {live?.rebootReason && <span className="muted small"> · last: {live.rebootReason}</span>}
              </dd>
              <dt>Firmware</dt>
              <dd>
                {device.firmwareVersion || 'not uploaded yet'}
                {device.firmwareVersion && device.firmwareVersion !== data.settings.firmwareVersion && (
                  <>
                    {' '}
                    <Badge tone="warn">newer {data.settings.firmwareVersion} available</Badge>
                  </>
                )}
              </dd>
            </dl>
          </Card>

          <Card title="Details" icon={Cpu}>
            <dl className="kv">
              <dt>Room</dt>
              <dd>
                {device.room ? (
                  <>
                    {device.room.displayName} · <Link to={`/rooms/${device.room._id}/install`}>installation</Link> ·{' '}
                    <Link to={`/rooms/${device.room._id}/wiring-sheet`}>wiring sheet</Link>
                  </>
                ) : (
                  'none'
                )}
              </dd>
              <dt>Hardware type</dt>
              <dd>
                {profile.code} {profile.verified ? <Badge tone="ok">tested</Badge> : <Badge tone="warn">not yet tested</Badge>}
              </dd>
              <dt>ESP board</dt>
              <dd>{profile.espBoard}</dd>
              <dt>Relay board</dt>
              <dd>{profile.relayModule}</dd>
              <dt>Installed on</dt>
              <dd>{formatDate(device.installedOn)}</dd>
              {device.previousIds?.length > 0 && (
                <>
                  <dt>Replaced boards</dt>
                  <dd className="mono small">{device.previousIds.join(', ')}</dd>
                </>
              )}
            </dl>
          </Card>
        </div>

        <Card title="Relays" description="Which lights or fans each relay switches. Changing this takes effect immediately, no firmware update needed.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Relay</th>
                  <th>Switches</th>
                  <th>Device reports</th>
                  {isAdmin(user) && <th>ESP pin</th>}
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => {
                  const reported = live?.channelStates?.[c.index - 1]
                  return (
                    <tr key={c._id}>
                      <td className="strong nowrap">Relay {c.index}</td>
                      <td style={{ minWidth: 220 }}>
                        {editor ? (
                          <select value={c.lightingGroup?._id ?? ''} onChange={(e) => updateChannel(c.index, { lightingGroup: e.target.value || null })}>
                            <option value="">Nothing (spare)</option>
                            {groups.map((g) => (
                              <option key={g._id} value={g._id}>
                                {g.name} ({GROUP_TYPES[g.type]}, {g.estimatedAmps} A)
                              </option>
                            ))}
                          </select>
                        ) : (
                          c.lightingGroup?.name ?? <span className="muted">nothing (spare)</span>
                        )}
                      </td>
                      <td>
                        {reported == null ? (
                          <span className="muted">–</span>
                        ) : (
                          <Badge tone={reported ? 'on' : 'neutral'}>
                            {reported ? 'On' : 'Off'}
                            {!live?.online && ' (last known)'}
                          </Badge>
                        )}
                      </td>
                      {isAdmin(user) && (
                        <td>
                          {editor ? (
                            <select value={c.gpio} style={{ width: 'auto' }} onChange={(e) => updateChannel(c.index, { gpio: Number(e.target.value) })}>
                              {!pins.some((p) => p.gpio === c.gpio) && <option value={c.gpio}>GPIO{c.gpio}</option>}
                              {pins.map((p) => (
                                <option key={p.gpio} value={p.gpio}>
                                  {p.label} (GPIO{p.gpio})
                                </option>
                              ))}
                            </select>
                          ) : (
                            `GPIO${c.gpio}`
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {isAdmin(user) && <p className="small muted" style={{ marginTop: 10 }}>Changing a pin needs a firmware update. Only safe pins can be chosen.</p>}
        </Card>

        {profile.setupNotes?.length > 0 && (
          <Card title="Setup notes for this hardware">
            <ul className="small">
              {profile.setupNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>
        )}

        <BuildHistory deviceId={device._id} refreshKey={device.updateReasons?.length} />

        <Card
          title="Recent switching"
          actions={
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          }
        >
          <CommandTable commands={commands} />
        </Card>

        {history.length > 0 && (
          <Card title="Changes to this device">
            <ul className="plain-list small">
              {history.map((h) => {
                const fields = changedFields(h)
                return (
                  <li key={h._id}>
                    <span className="muted">{formatDateTime(h.time)}</span> · {h.actor?.name} · {h.action === 'create' ? 'added' : h.action === 'delete' ? 'removed' : 'changed'}
                    {fields.length > 0 && ` ${fields.join(', ')}`}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {editor && (
          <Card title="Other actions">
            <div className="row">
              <Button icon={Replace} onClick={() => setModal('replace')}>
                Replace a broken board
              </Button>
              <Button variant="danger" icon={Trash} onClick={retire}>
                Remove device
              </Button>
            </div>
          </Card>
        )}
      </div>

      {modal === 'edit' && (
        <EditDeviceModal
          device={device}
          profiles={profiles}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
        />
      )}
      {modal === 'ota' && (
        <WifiUpdateModal
          device={device}
          onClose={() => {
            setModal(null)
            load()
          }}
        />
      )}
      {modal === 'replace' && (
        <ReplaceBoardModal
          device={device}
          onClose={() => setModal(null)}
          onDone={async () => {
            await refresh()
            navigate(`/devices/${device._id}/firmware`)
          }}
        />
      )}
    </>
  )
}
