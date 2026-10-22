import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check as CheckIcon, CirclePlus, Printer, Upload } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'
import { isEditor } from '../../lib/permissions.js'
import { groupStatus } from '../../lib/status.js'
import { STAGES } from '../../lib/labels.js'
import { formatDate, timeAgo } from '../../lib/format.js'
import { Alert, Badge, Button, Card, Check, LinkButton, Loading, PageHeader, Spinner, StatusDot } from '../../components/ui/index.js'
import { TestSketchesButton } from '../../components/firmware/TestSketches.jsx'

// The 8 installation steps for one room (PRD C2), from creating it to marking it Live.
export default function RoomInstallPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data } = useLive()
  const toast = useToast()
  const [st, setSt] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => api(`/rooms/${id}/install`).then(setSt).catch((e) => setError(errorText(e))), [id])
  useEffect(() => {
    load()
  }, [load, data]) // live changes (device online, new firmware) refresh the steps

  if (error && !st) return <Alert tone="bad">{error}</Alert>
  if (!st) return <Loading />
  const editor = isEditor(user)
  const done = (key) => st.steps.find((s) => s.key === key)?.done
  const stageIndex = Object.keys(STAGES).indexOf(st.room.stage)

  const setStage = async (stage) => {
    try {
      setSt(await api(`/rooms/${id}/stage`, { method: 'PUT', body: { stage } }))
      toast.ok(`${st.room.displayName} is now "${STAGES[stage]}"`)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const blocks = {
    room: (
      <p className="small">
        {st.groups.length ? `${st.groups.length} group(s): ${st.groups.map((g) => g.name).join(', ')}.` : 'No lights or fans added yet.'}{' '}
        <Link to="/rooms">Edit in Rooms</Link>
      </p>
    ),
    device: (
      <div className="stack-sm">
        {st.devices.map((d) => (
          <div key={d._id} className="row small">
            <Link to={`/devices/${d._id}`} className="strong">
              {d.name}
            </Link>
            <Badge>{d.profile.code}</Badge>
            {!d.profile.verified && <Badge tone="warn">Not yet tested</Badge>}
            <span className="muted">
              {d.channels.filter((c) => c.lightingGroup).length} of {d.channels.length} relays connected to groups
            </span>
          </div>
        ))}
        {editor && (
          <div>
            <LinkButton size="sm" icon={CirclePlus} to={`/devices/new?room=${id}`}>
              Add a device
            </LinkButton>
          </div>
        )}
      </div>
    ),
    wiring: (
      <div>
        <LinkButton size="sm" icon={Printer} to={`/rooms/${id}/wiring-sheet`}>
          Open the wiring sheet
        </LinkButton>
      </div>
    ),
    bench: (
      <div className="stack">
        {st.devices.map((d) => (
          <BenchTest key={d._id} device={d} editor={editor} onSaved={load} />
        ))}
      </div>
    ),
    flash: (
      <div className="stack-sm">
        {st.devices.map((d) => (
          <div key={d._id} className="row small">
            <strong>{d.name}</strong>
            {d.build ? <span className="muted">firmware {d.build.version} prepared {timeAgo(d.build.createdAt)}</span> : <Badge tone="warn">no firmware yet</Badge>}
            <StatusDot online={d.state?.online} />
            {d.updateNeeded && <Badge tone="info">update needed</Badge>}
            {editor && (
              <LinkButton size="sm" icon={Upload} to={`/devices/${d._id}/firmware`}>
                Upload firmware
              </LinkButton>
            )}
          </div>
        ))}
      </div>
    ),
    install: (
      <div className="row small">
        <span className="muted">The electrician wires the box using the printed sheet. All 230 V work is done by an electrician only.</span>
        {editor && stageIndex < 2 && (
          <Button size="sm" variant="primary" icon={CheckIcon} onClick={() => setStage('installed')}>
            Mark as installed
          </Button>
        )}
      </div>
    ),
    commission: <Commissioning st={st} editor={editor} onSaved={load} />,
    live: (
      <div className="row small">
        {st.room.stage === 'live' ? (
          <Badge tone="ok">This room is Live</Badge>
        ) : (
          editor && (
            <Button size="sm" variant="primary" disabled={!done('commission')} onClick={() => setStage('live')}>
              Mark room Live
            </Button>
          )
        )}
        {!done('commission') && st.room.stage !== 'live' && <span className="muted">First pass the website test for every connected group (step 7).</span>}
      </div>
    ),
  }

  return (
    <>
      <PageHeader
        back={{ to: '/rooms', label: 'Rooms' }}
        title={`Installation: ${st.room.displayName}`}
        description={`${st.room.floor?.name}. Work through the steps from top to bottom; each step ticks itself off when it is done.`}
      />
      <ol className="stepper" aria-label="Room status">
        {Object.entries(STAGES).map(([k, v], i) => (
          <li key={k} className={i === stageIndex ? 'current' : i < stageIndex ? 'done' : ''}>
            <span className="num">{i < stageIndex ? <CheckIcon aria-hidden="true" /> : i + 1}</span>
            {v}
          </li>
        ))}
      </ol>
      <Card>
        {st.steps.map((s, i) => (
          <div key={s.key} className="checklist-step">
            <div className={`step-mark ${s.done ? 'done' : ''}`}>{s.done ? <CheckIcon aria-hidden="true" /> : i + 1}</div>
            <div className="stack-sm" style={{ minWidth: 0 }}>
              <h3>{s.title}</h3>
              {blocks[s.key]}
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

function BenchTest({ device, editor, onSaved }) {
  const toast = useToast()
  // Start from the last saved desk test, so a saved result does not look empty.
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(device.checklist.map((c) => [c, Boolean(device.bench?.checks?.find((x) => x.label === c)?.ok)]))
  )
  const [notes, setNotes] = useState('')
  const save = async () => {
    try {
      const r = await api(`/devices/${device._id}/bench-test`, {
        method: 'POST',
        body: { checks: device.checklist.map((label, i) => ({ key: `c${i}`, label, ok: checks[label] })), notes },
      })
      if (r.passed) toast.ok(`${device.name}: desk test passed`)
      else toast.warn(`${device.name}: desk test saved as failed`)
      onSaved()
    } catch (err) {
      toast.error(errorText(err))
    }
  }
  return (
    <div className="card card-sub stack-sm">
      <div className="row-between">
        <strong>{device.name}</strong>
        {device.bench ? (
          <Badge tone={device.bench.passed ? 'ok' : 'bad'}>
            {device.bench.passed ? 'Passed' : 'Failed'} · {device.bench.by?.name} · {timeAgo(device.bench.at)}
          </Badge>
        ) : (
          <Badge>Not tested yet</Badge>
        )}
      </div>
      <div className="row small">
        <span className="muted">Upload the relay test to the board on your desk, then tick what you saw.</span>
        <TestSketchesButton profile={device.profile} device={device._id} />
      </div>
      {editor && (
        <>
          <div className="stack-sm small">
            {device.checklist.map((c) => (
              <Check key={c} checked={checks[c]} onChange={(v) => setChecks({ ...checks, [c]: v })}>
                {c}
              </Check>
            ))}
          </div>
          <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <Button size="sm" variant="primary" onClick={save}>
              {device.bench ? 'Save desk test again' : 'Save desk test'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// Switch each group from the website and confirm the right lights respond; saved with name and date.
function Commissioning({ st, editor, onSaved }) {
  const { index, cmds, recordCommands } = useLive()
  const toast = useToast()
  const send = async (groupId, state) => {
    try {
      recordCommands((await api('/control', { method: 'POST', body: { target: { kind: 'group', id: groupId }, state } })).commands)
    } catch (err) {
      toast.error(errorText(err))
    }
  }
  const record = async (group, result) => {
    try {
      await api(`/rooms/${st.room._id}/commissioning`, { method: 'POST', body: { lightingGroup: group._id, result } })
      toast.ok(`${group.name}: ${result === 'pass' ? 'passed' : 'marked as failed'}`)
      onSaved()
    } catch (err) {
      toast.error(errorText(err))
    }
  }
  return (
    <div className="stack-sm">
      <p className="small muted">For each group: switch it on, check the right lights or fans come on in the room, switch it off, then record the result.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Now</th>
              <th>Try it</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {st.commissioning.map(({ group, record: rec, wired }) => {
              const s = index ? groupStatus(index, cmds, group._id) : null
              return (
                <tr key={group._id}>
                  <td className="strong">{group.name}</td>
                  <td>
                    {!wired ? (
                      <Badge>not connected</Badge>
                    ) : !s?.anyOnline ? (
                      <Badge>device offline</Badge>
                    ) : (
                      <span className="row">
                        <Badge tone={s.state === 'on' ? 'on' : 'neutral'}>{s.state === 'on' ? 'On' : 'Off'}</Badge>
                        {s.pending && <Spinner />}
                        {s.notConfirmed && <Badge tone="bad">no reply</Badge>}
                      </span>
                    )}
                  </td>
                  <td className="nowrap">
                    {editor && wired && (
                      <div className="segmented">
                        <button className="btn btn-sm" disabled={!s?.anyOnline} onClick={() => send(group._id, 'ON')}>
                          On
                        </button>
                        <button className="btn btn-sm" disabled={!s?.anyOnline} onClick={() => send(group._id, 'OFF')}>
                          Off
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {rec && (
                      <div className="small" style={{ marginBottom: 4 }}>
                        <Badge tone={rec.result === 'pass' ? 'ok' : 'bad'}>{rec.result === 'pass' ? 'Passed' : 'Failed'}</Badge> {rec.installer?.name}, {formatDate(rec.at)}
                      </div>
                    )}
                    {editor && wired && (
                      <div className="row">
                        <Button size="sm" onClick={() => record(group, 'pass')}>
                          Right lights responded
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => record(group, 'fail')}>
                          Wrong / nothing
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
