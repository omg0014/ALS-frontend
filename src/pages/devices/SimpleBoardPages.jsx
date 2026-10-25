import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Radio, Trash } from 'lucide-react'
import { api } from '../../api/client.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { GROUP_TYPES } from '../../lib/labels.js'
import { formatDateTime } from '../../lib/format.js'
import { Alert, Button, Card, Loading, PageHeader, StatusDot } from '../../components/ui/index.js'
import { CommandTable } from '../../components/CommandTable.jsx'
import { SimpleBoardForm } from './SimpleBoardForm.jsx'
import { SIMPLE_DEFAULTS, simpleFormFrom } from './simpleBoard.js'

// "Add MQTT board": a board that already runs its own code (topic + ON/OFF message), saved to a classroom.
export default function NewSimpleBoardPage() {
  const { data, refresh } = useLive()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  if (!data) return <Loading />
  return (
    <>
      <PageHeader
        back={{ to: '/devices', label: 'Devices' }}
        title="Add an MQTT board"
        description="For a board that already runs its own code: enter its broker, topic and ON/OFF messages, and choose its classroom. The website then sends ON or OFF for you."
      />
      <Card>
        <SimpleBoardForm
          initial={{ ...SIMPLE_DEFAULTS, room: params.get('room') ?? '' }}
          onSaved={async (d) => {
            await refresh()
            toast.ok(`${d.name} saved`)
            navigate(`/devices/${d._id}`)
          }}
          onCancel={() => navigate(-1)}
        />
      </Card>
    </>
  )
}

// Device page for an MQTT board: what it is connected to, edit, recent switching, remove.
export function SimpleDeviceView({ detail, editor, onChanged }) {
  const { index, refresh } = useLive()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const { device, channels, commands } = detail
  const live = index.devices.get(device._id)
  const s = live?.simple ?? device.simple ?? {}
  const state = live?.state ?? detail.state
  const group = index.groups.get(channels[0]?.lightingGroup?._id ?? channels[0]?.lightingGroup)
  const reported = state?.channelStates?.[0]

  const retire = async () => {
    const ok = await confirm({
      title: `Remove ${device.name}?`,
      message: 'The website stops sending it ON/OFF. Its line stays in the room, and the history is kept.',
      confirmLabel: 'Remove board',
      tone: 'danger',
    })
    if (!ok) return
    await api(`/devices/${device._id}/retire`, { method: 'POST' })
    await refresh()
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
            {device.room ? `${device.room.displayName}${device.room.floor?.name ? `, ${device.room.floor.name}` : ''}` : 'No room'} · MQTT board (own code)
          </>
        }
        actions={
          editor &&
          !editing && (
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              Edit board
            </Button>
          )
        }
      />
      <div className="stack">
        {editing ? (
          <Card title="Edit board">
            <SimpleBoardForm
              initial={simpleFormFrom({ ...device, room: device.room?._id, simple: s }, [{ lightingGroup: channels[0]?.lightingGroup?._id ?? channels[0]?.lightingGroup }])}
              deviceId={device._id}
              onSaved={async () => {
                setEditing(false)
                await refresh()
                onChanged()
                toast.ok('Saved')
              }}
              onCancel={() => setEditing(false)}
            />
          </Card>
        ) : (
          <Card title="Connection" icon={Radio}>
            <dl className="kv">
              <dt>Status</dt>
              <dd>
                <StatusDot online={state?.online} onlineText="Broker connected" offlineText="Broker not reachable" />
              </dd>
              <dt>Switches</dt>
              <dd>
                {group ? `${group.name} (${GROUP_TYPES[group.type]})` : 'nothing'}
                {reported != null && s.stateTopic && <> · board says <strong>{reported ? 'ON' : 'OFF'}</strong></>}
              </dd>
              <dt>Broker</dt>
              <dd className="mono">
                {s.url}
                {s.username ? ` · login ${s.username}` : ' · no login (public)'}
              </dd>
              <dt>Topic</dt>
              <dd className="mono">
                {s.commandTopic} ← "{s.onPayload}" / "{s.offPayload}"
              </dd>
              <dt>State topic</dt>
              <dd className="mono">{s.stateTopic || 'none (switching is "sent", not confirmed)'}</dd>
              <dt>After a power cut</dt>
              <dd>{s.retain ? 'the board gets the last ON/OFF from the broker and switches back' : 'the board stays as its own code starts it'}</dd>
              {state?.lastSeen && (
                <>
                  <dt>Last message</dt>
                  <dd>{formatDateTime(state.lastSeen)}</dd>
                </>
              )}
            </dl>
            {!s.username && <Alert tone="warn">This broker has no login: anyone who knows the topic can switch this classroom.</Alert>}
            <p className="small muted" style={{ margin: 0 }}>
              Its own code does not report online/offline, so "Broker connected" means the website reaches the broker. Switch it on the Lights &amp; fans page.
            </p>
          </Card>
        )}
        <Card title="Recent switching">
          <CommandTable commands={commands} />
        </Card>
        {editor && (
          <div>
            <Button variant="danger" icon={Trash} onClick={retire}>
              Remove board
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
