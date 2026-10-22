import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Download, Minus, Plus, Usb } from 'lucide-react'
import { errorText } from '../../api/client.js'
import { useLive } from '../../context/LiveContext.js'
import { connectBoard, disconnectBoard, usbSupport } from '../../lib/flasher.js'
import { downloadBase64 } from '../../lib/download.js'
import { GROUP_TYPES } from '../../lib/labels.js'
import { Alert, Badge, Button, Field, LinkButton, Warnings } from '../../components/ui/index.js'
import { WiringDiagram } from '../../components/wiring/WiringDiagram.jsx'
import { WiringTables } from '../../components/wiring/WiringTables.jsx'
import { LINE_TYPES, assignRelays, defaultCounts, maxRelays, planLines } from './lines.js'

function StepTitle({ title, children }) {
  return (
    <div>
      <h2>{title}</h2>
      {children && <p className="muted" style={{ marginTop: 4 }}>{children}</p>}
    </div>
  )
}

// ---- Step 1: plug in the board; the website reads its chip ID and type itself ----
export function StepBoard({ form, set, board, setBoard }) {
  const { index } = useLive()
  const usb = usbSupport()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [byHand, setByHand] = useState(false)
  const [typing, setTyping] = useState(!usb.ok)
  const existing = form.chipId && [...index.devices.values()].find((d) => d.deviceId === `acls-${form.chipId.toLowerCase().padStart(6, '0')}` && d.status !== 'retired')

  const connect = async (manual = false) => {
    setBusy(true)
    setError(null)
    try {
      const b = await connectBoard(() => {}, { manual })
      await disconnectBoard(b) // keep the port (no second question later), free it for now
      setBoard(b)
      setByHand(false)
      set({ chipId: b.chipId, espModel: b.chip === 'ESP32' ? 'esp32' : 'esp8266' })
    } catch (err) {
      if (err.name !== 'NotFoundError') setError(errorText(err))
      if (err.needsManual) setByHand(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <StepTitle title="Connect the board">Plug the ESP board into this PC with a USB cable. The website finds out which board it is by itself.</StepTitle>

      {usb.ok && !typing && (
        <div className="card card-sub stack-sm" style={{ textAlign: 'center', justifyItems: 'center' }}>
          {board ? (
            <>
              <CircleCheck size={36} color="var(--ok)" />
              <h3>{board.chip === 'ESP32' ? 'ESP32' : 'NodeMCU (ESP8266)'} found</h3>
              <p className="muted">
                Chip ID <span className="mono">{board.chipId}</span> · {board.description}
              </p>
              <Button size="sm" variant="ghost" onClick={() => connect()}>
                Use a different board
              </Button>
            </>
          ) : (
            <>
              <Usb size={36} className="muted" />
              <p className="muted">Unplug the board's 5V supply first. Then plug in the USB cable and press:</p>
              <Button variant="primary" size="lg" icon={Usb} onClick={() => connect()} disabled={busy}>
                {busy ? 'Looking for the board…' : 'Connect board'}
              </Button>
              <p className="tiny muted">Chrome asks which port: choose usbserial / CH340 / CP210x.</p>
            </>
          )}
        </div>
      )}

      {error && <Alert tone="bad">{error}</Alert>}
      {byHand && (
        <div className="card card-sub stack-sm">
          <strong>Put the board in upload mode by hand</strong>
          <ol className="small">
            <li>
              Press and <strong>hold BOOT</strong> (FLASH on a NodeMCU).
            </li>
            <li>
              While holding it, <strong>press and release EN</strong> (RST).
            </li>
            <li>
              <strong>Release BOOT</strong>, then press:
            </li>
          </ol>
          <div>
            <Button variant="primary" icon={Usb} onClick={() => connect(true)} disabled={busy}>
              Connect (board is in upload mode)
            </Button>
          </div>
        </div>
      )}

      {typing ? (
        <div className="form-grid">
          <Field label="Chip ID" hint="6 characters, printed by the board at start-up, e.g. 3fa2c1">
            <input value={form.chipId} onChange={(e) => set({ chipId: e.target.value.trim() })} />
          </Field>
          <Field label="Board">
            <select value={form.espModel} onChange={(e) => set({ espModel: e.target.value, profile: '' })}>
              <option value="esp8266">NodeMCU (ESP8266)</option>
              <option value="esp32">ESP32 DevKit</option>
            </select>
          </Field>
        </div>
      ) : (
        !board && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setTyping(true)}>
            The board is not here? Type its chip ID instead
          </button>
        )
      )}
      {!usb.ok && <p className="small muted">{usb.reason}</p>}

      {existing && (
        <Alert
          tone="info"
          title={`This board is already set up as "${existing.name}"`}
          action={
            <LinkButton size="sm" variant="primary" to={`/devices/${existing._id}/firmware`}>
              Upload firmware to it
            </LinkButton>
          }
        >
          To give it new firmware, open it instead of adding it again.
        </Alert>
      )}
    </>
  )
}

// ---- Step 2: the room and how many mains lines; relay board and relays are chosen automatically ----
export function StepLines({ form, set, profiles, profile }) {
  const { data, index } = useLive()
  const [changingBoard, setChangingBoard] = useState(form.profileTouched)
  const roomGroups = index.groupsByRoom.get(form.room) ?? []
  const lines = planLines(form.counts, roomGroups, form.names)
  const most = maxRelays(profiles, form.espModel)
  const byId = new Map(lines.map((l) => [l.id, l]))

  // Every change re-plans the relays, so the board and the matching are always filled in
  const update = (patch) => {
    const next = { ...form, ...patch }
    set({ ...patch, ...assignRelays(next, profiles, index.groupsByRoom.get(next.room) ?? []) })
  }
  const setCount = (type, n) => update({ counts: { ...form.counts, [type]: Math.max(0, n) } })

  return (
    <>
      <StepTitle title="What does it switch?">Choose the room and say how many lines (mains circuits) this board switches. The relay board and the wiring are worked out for you.</StepTitle>
      <div className="form-grid">
        <Field label="Room">
          <select
            value={form.room}
            onChange={(e) => {
              const room = index.rooms.get(e.target.value)
              update({
                room: e.target.value,
                counts: defaultCounts(index.groupsByRoom.get(e.target.value) ?? []),
                name: form.nameTouched ? form.name : room ? `${room.displayName} board` : '',
                wifiSsid: room?.wifiSsid || form.wifiSsid,
              })
            }}
          >
            <option value="">Choose a room…</option>
            {data.floors.map((f) => (
              <optgroup key={f._id} label={f.name}>
                {(index.roomsByFloor.get(f._id) ?? []).map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Device name">
          <input value={form.name} onChange={(e) => set({ name: e.target.value, nameTouched: true })} />
        </Field>
      </div>
      {!data.rooms.length && (
        <Alert tone="warn">
          There are no rooms yet. <Link to="/rooms">Add the room first</Link>.
        </Alert>
      )}

      {form.room && (
        <div className="stack-sm">
          <div className="field-label">How many lines does this board switch?</div>
          <div className="counter-list">
            {LINE_TYPES.map((type) => (
              <div key={type} className="counter-row">
                <span>{GROUP_TYPES[type]}</span>
                <div className="counter">
                  <Button size="sm" icon={Minus} aria-label={`Fewer ${GROUP_TYPES[type]}`} disabled={!form.counts?.[type]} onClick={() => setCount(type, (form.counts?.[type] ?? 0) - 1)} />
                  <strong aria-label={`${GROUP_TYPES[type]} count`}>{form.counts?.[type] ?? 0}</strong>
                  <Button size="sm" icon={Plus} aria-label={`More ${GROUP_TYPES[type]}`} disabled={lines.length >= most} onClick={() => setCount(type, (form.counts?.[type] ?? 0) + 1)} />
                </div>
              </div>
            ))}
          </div>
          <p className="tiny muted">One line = one separate circuit from the switchboard. This board can switch up to {most}.</p>
        </div>
      )}

      {form.room && lines.length > 0 && (
        <div className="stack-sm">
          <div className="row-between">
            <div>
              <div className="field-label">Relay board</div>
              {profile ? (
                <div className="row">
                  <strong>{profile.relayModule.split(',')[0]}</strong>
                  <span className="small muted">
                    {profile.channels} relay{profile.channels > 1 ? 's' : ''}
                  </span>
                  {profile.verified ? <Badge tone="ok">tested</Badge> : <Badge tone="warn">not tested yet</Badge>}
                </div>
              ) : (
                <span className="small muted">None chosen</span>
              )}
            </div>
            {!changingBoard && (
              <Button size="sm" variant="ghost" onClick={() => setChangingBoard(true)}>
                Use another relay board
              </Button>
            )}
          </div>
          {changingBoard && (
            <Field label="Relay board">
              <select value={form.profile} onChange={(e) => update({ profile: e.target.value, profileTouched: Boolean(e.target.value) })}>
                <option value="">Choose for me</option>
                {profiles
                  .filter((p) => p.espModel === form.espModel)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.relayModule.split(',')[0]} ({p.channels} relay{p.channels > 1 ? 's' : ''}
                      {p.verified ? ', tested' : ', not tested yet'})
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {profile && lines.length > profile.channels && <Alert tone="bad">This relay board has only {profile.channels} relays for {lines.length} lines. Choose a bigger one or fewer lines.</Alert>}
          {profile && !profile.verified && <Alert tone="warn">This relay board is not tested yet: fine on the desk, but do not install it in a classroom until an admin marks it as tested.</Alert>}

          {profile && (
            <div className="table-wrap">
              <table>
                <tbody>
                  {Object.entries(form.channels).map(([n, id]) => {
                    const line = byId.get(id) ?? (id ? { id, name: index.groups.get(id)?.name ?? '?' } : null)
                    return (
                      <tr key={n}>
                        <td className="strong nowrap" style={{ width: 90 }}>
                          Relay {n}
                        </td>
                        <td>
                          {!line ? (
                            <span className="muted">Nothing (spare)</span>
                          ) : line.isNew ? (
                            <input aria-label={`Name of relay ${n}`} value={line.name} onChange={(e) => set({ names: { ...form.names, [line.id]: e.target.value } })} />
                          ) : (
                            line.name
                          )}
                        </td>
                        <td className="small muted nowrap">{line?.isNew ? 'new, you can name it' : line ? GROUP_TYPES[byId.get(id)?.type ?? index.groups.get(id)?.type] : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ---- Step 4: the wires to connect, for exactly this board ----
export function StepWiring({ profile, channels, plan }) {
  const { index } = useLive()
  return (
    <>
      <StepTitle title="Connect the wires">Do these connections with all power OFF. The 230V side (COM / NO) is done by an electrician.</StepTitle>
      <div className="card card-sub" style={{ overflowX: 'auto' }}>
        <WiringDiagram profile={profile} channels={channels} groupName={(id) => index.groups.get(id)?.name} />
      </div>
      {plan ? <WiringTables plan={plan.plan} /> : <p className="muted small">Working out the wiring…</p>}
      <Warnings title="Please check" list={plan?.warnings} />
      {profile.setupNotes.length > 0 && (
        <div className="card card-sub stack-sm">
          <strong>Before you power it</strong>
          <ul className="small">
            {profile.setupNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ---- Step 3 (WiFi part): the classroom WiFi ----
export function WifiFields({ form, set, wifiPassword, setWifiPassword, disabled }) {
  return (
    <div className="form-grid">
      <Field label="WiFi name" hint="The WiFi this board will use">
        <input value={form.wifiSsid} disabled={disabled} onChange={(e) => set({ wifiSsid: e.target.value })} />
      </Field>
      <Field label="WiFi password" hint="Needed to join the WiFi. Only written onto the board, never stored">
        <input required type="password" autoComplete="off" value={wifiPassword} disabled={disabled} onChange={(e) => setWifiPassword(e.target.value)} />
      </Field>
    </div>
  )
}

export function ArduinoFallback({ result }) {
  if (!result) return null
  return (
    <div className="card card-sub stack-sm">
      <div className="row-between">
        <strong>Use Arduino IDE instead</strong>
        <Button size="sm" icon={Download} onClick={() => downloadBase64(result.zipName, result.zipBase64)}>
          Download {result.zipName}
        </Button>
      </div>
      <ol className="small">
        {result.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

export function BadWifiNote({ settings }) {
  if (settings?.brokerHost) return null
  return (
    <Alert tone="bad" title="This PC's network address was not found">
      Connect this PC to the school network (WiFi or cable), then restart the server.
    </Alert>
  )
}
