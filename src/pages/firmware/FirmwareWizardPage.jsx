import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check as CheckIcon, Download, Pencil, Upload } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useLive } from '../../context/LiveContext.js'
import { usbSupport } from '../../lib/flasher.js'
import { downloadBase64 } from '../../lib/download.js'
import { timeAgo } from '../../lib/format.js'
import { ESP_NAMES } from '../../lib/labels.js'
import { Alert, Button, Card, LinkButton, Loading, PageHeader, StatusDot } from '../../components/ui/index.js'
import { UsbFlash } from '../../components/firmware/UsbFlash.jsx'
import { CodePreview } from '../../components/firmware/CodePreview.jsx'
import { ArduinoFallback, BadWifiNote, StepBoard, StepLines, StepWiring, WifiFields } from './WizardSteps.jsx'
import { assignRelays, countLines, defaultCounts, isNewLine, planLines } from './lines.js'

const STEPS = ['Connect the board', 'What it switches', 'WiFi', 'Wiring', 'Check and upload']
const [BOARD, LINES, WIFI, WIRING, CHECK] = [0, 1, 2, 3, 4]

// "Add a device" (new board) or "Upload firmware" (existing board): connect, say what it switches,
// WiFi, wiring, then check everything and upload. Progress is saved, so it can be continued later.
export default function FirmwareWizardPage() {
  const { deviceId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, index, refresh } = useLive()
  const draftKey = `firmware:${deviceId ?? 'new'}`

  const [profiles, setProfiles] = useState(null)
  const [settings, setSettings] = useState(null)
  const [info, setInfo] = useState(null)
  const [form, setForm] = useState(null)
  const [step, setStep] = useState(BOARD)
  const [draft, setDraft] = useState(null)
  const [board, setBoard] = useState(null) // the board found on USB in step 1 (its port is reused for the upload)
  const [wifiPassword, setWifiPassword] = useState('')
  const [plan, setPlan] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sent, setSent] = useState(null) // the code actually going onto the board, once an upload started
  const [job, setJob] = useState(null) // { device, buildId, result }
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data || form) return
    ;(async () => {
      const [p, s, d, fi] = await Promise.all([api('/profiles'), api('/settings'), api(`/drafts/${encodeURIComponent(draftKey)}`), api('/firmware/info')])
      setInfo(fi)
      setProfiles(p)
      setSettings(s.values)
      if (deviceId) {
        const dev = index.devices.get(deviceId)
        if (!dev) throw new Error('Device not found')
        const mapped = dev.channels.map((c) => index.groups.get(c.lightingGroup)).filter(Boolean)
        setForm({
          mode: 'existing',
          device: deviceId,
          chipId: dev.deviceId.slice(5),
          espModel: p.find((x) => x._id === dev.profile)?.espModel ?? 'esp8266',
          room: dev.room ?? '',
          name: dev.name,
          nameTouched: true,
          profile: dev.profile,
          profileTouched: true,
          counts: countLines(mapped),
          names: {},
          channels: Object.fromEntries(dev.channels.map((c) => [c.index, c.lightingGroup ?? ''])),
          wifiSsid: index.rooms.get(dev.room)?.wifiSsid ?? '',
        })
        setStep(dev.room ? WIFI : LINES) // a known board starts at the WiFi
      } else {
        const room = params.get('room') ?? ''
        const roomGroups = index.groupsByRoom.get(room) ?? []
        const f = {
          mode: 'new',
          device: '',
          chipId: '',
          espModel: 'esp8266',
          room,
          name: room ? `${index.rooms.get(room)?.displayName} board` : '',
          nameTouched: false,
          profile: '',
          profileTouched: false,
          counts: room ? defaultCounts(roomGroups) : {},
          names: {},
          channels: {},
          wifiSsid: index.rooms.get(room)?.wifiSsid ?? '',
        }
        setForm(room ? { ...f, ...assignRelays(f, p, roomGroups) } : f)
      }
      if (d) setDraft(d)
    })().catch((e) => setError(errorText(e)))
  }, [data, form, deviceId, draftKey, index, params])

  const profile = profiles?.find((p) => p._id === form?.profile)
  // Relays with their pins; lines not created yet count as spare until "Next" adds them to the room
  const channelList = useMemo(
    () =>
      profile
        ? profile.pins.slice(0, profile.channels).map((p, i) => {
            const id = form.channels[i + 1] || null
            return { index: i + 1, gpio: p.gpio, lightingGroup: isNewLine(id) ? null : id }
          })
        : [],
    [profile, form?.channels]
  )

  // Wiring and load warnings
  useEffect(() => {
    if (!profile || step < WIRING) return
    api('/firmware/plan', { method: 'POST', body: { profile: profile._id, channels: channelList } })
      .then(setPlan)
      .catch(() => {})
  }, [profile, channelList, step])

  // The exact code that will be uploaded, refreshed as the user types (secrets hidden)
  useEffect(() => {
    if (!profile || step < WIFI) return
    const t = setTimeout(() => {
      api('/firmware/preview', {
        method: 'POST',
        body: { device: form.device || undefined, chipId: form.chipId, name: form.name, room: form.room, profile: profile._id, channels: channelList, wifiSsid: form.wifiSsid, wifiPassword },
      })
        .then(setPreview)
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [profile, step, form?.device, form?.chipId, form?.name, form?.room, form?.wifiSsid, channelList, wifiPassword])

  // Once uploading: show the code of this exact build (passwords hidden), not the live preview
  useEffect(() => {
    if (!job?.buildId) return
    api(`/builds/${job.buildId}/code`)
      .then((code) => setSent({ ...code, buildId: job.buildId }))
      .catch(() => {})
  }, [job?.buildId])

  if (error && !form) return <Alert tone="bad">{error}</Alert>
  if (!form || !data || !profiles) return <Loading />

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const go = async (next, f = form) => {
    setError(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await api(`/drafts/${encodeURIComponent(draftKey)}`, { method: 'PUT', body: { step: next, data: f } }).catch(() => {})
  }
  const resume = () => {
    setForm({ ...form, ...draft.data })
    setStep(Math.min(draft.step, WIFI)) // the WiFi password is never saved, so it is asked again
    setDraft(null)
  }
  const discard = async () => {
    await api(`/drafts/${encodeURIComponent(draftKey)}`, { method: 'DELETE' })
    setDraft(null)
  }

  // New lines become lights/fans of the room before moving on, so the wiring and the code can name them.
  const saveLinesAndGo = async () => {
    setBusy(true)
    setError(null)
    try {
      const lines = new Map(planLines(form.counts, index.groupsByRoom.get(form.room) ?? [], form.names).map((l) => [l.id, l]))
      const channels = { ...form.channels }
      for (const [n, id] of Object.entries(channels)) {
        if (!isNewLine(id)) continue
        const line = lines.get(id)
        const g = await api('/groups', { method: 'POST', body: { room: form.room, name: line.name.trim() || line.id, type: line.type, estimatedAmps: 0 } })
        channels[n] = g._id
      }
      await refresh()
      const next = { ...form, channels, names: {} }
      setForm(next)
      await go(WIFI, next)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const chipOk = /^[0-9a-f]{1,6}$/i.test(form.chipId.replace(/^acls-/i, ''))
  const alreadyRegistered = form.mode === 'new' && [...index.devices.values()].some((d) => d.deviceId === `acls-${form.chipId.toLowerCase().padStart(6, '0')}` && d.status !== 'retired')
  const lineCount = Object.values(form.counts ?? {}).reduce((a, b) => a + b, 0)
  const wifiOk = Boolean(form.wifiSsid && wifiPassword && settings?.brokerHost)
  const canNext = {
    [BOARD]: chipOk && !alreadyRegistered,
    [LINES]: Boolean(form.room && form.name && profile && lineCount > 0 && lineCount <= profile.channels),
    [WIFI]: wifiOk,
    [WIRING]: true,
  }[step]

  // Save the device (new or changed), then prepare its firmware. Returns the firmware result.
  const saveAndPrepare = async (compile) => {
    let id = form.device
    const mapping = channelList.map((c) => ({ index: c.index, lightingGroup: c.lightingGroup }))
    if (form.mode === 'new') {
      const r = await api('/devices', { method: 'POST', body: { chipId: form.chipId, name: form.name, room: form.room, profile: form.profile, channels: mapping } })
      id = r.device._id
      set({ mode: 'existing', device: id }) // a retry must not register the board twice
    } else {
      const dev = index.devices.get(id)
      const body = {}
      if (dev.name !== form.name) body.name = form.name
      if (dev.room !== form.room) body.room = form.room
      if (dev.profile !== form.profile) body.profile = form.profile
      if (Object.keys(body).length) await api(`/devices/${id}`, { method: 'PUT', body })
      for (const c of mapping) await api(`/devices/${id}/channels/${c.index}`, { method: 'PUT', body: { lightingGroup: c.lightingGroup } })
    }
    const fw = await api(`/devices/${id}/firmware`, { method: 'POST', body: { wifiSsid: form.wifiSsid, wifiPassword, compile } })
    await api(`/drafts/${encodeURIComponent(draftKey)}`, { method: 'DELETE' }).catch(() => {})
    return { device: id, fw }
  }

  const startUpload = async () => {
    setBusy(true)
    setError(null)
    try {
      const { device, fw } = await saveAndPrepare(true)
      setJob({ device, buildId: fw.buildId, result: fw, startedAt: Date.now() })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const downloadInstead = async () => {
    setBusy(true)
    setError(null)
    try {
      const { device, fw } = await saveAndPrepare(false)
      downloadBase64(fw.zipName, fw.zipBase64)
      setJob({ device, buildId: fw.buildId, result: fw, startedAt: Date.now(), ideOnly: true })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const room = index.rooms.get(form.room)
  const dev = job && index.devices.get(job.device)
  const connected = dev?.state?.online && new Date(dev.state.lastSeen).getTime() > job.startedAt
  const usb = usbSupport().ok && info?.buildService?.ready
  const offset = form.mode === 'existing' && deviceId ? LINES : BOARD // a known board skips "Connect the board"
  const visibleSteps = STEPS.slice(offset)
  const wires = plan ? plan.plan.signal.length + plan.plan.power.length + plan.plan.outputs.length : null

  // One line of the final check, with a way back to change it
  const checkRow = (label, to, value) => (
    <div className="check-row">
      <div className="check-label">{label}</div>
      <div className="check-value">{value}</div>
      {!job && to >= offset && (
        <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${label}`} onClick={() => go(to)}>
          Edit
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        back={deviceId ? { to: `/devices/${deviceId}`, label: form.name } : { to: '/devices', label: 'Devices' }}
        title={deviceId ? `Upload firmware to ${form.name}` : 'Add a device'}
        description={deviceId ? 'Type the WiFi, check the wiring, then confirm and upload.' : 'Connect the board, say what it switches, type the WiFi, wire it, then confirm and upload.'}
      />

      <ol className="stepper" aria-label="Steps">
        {visibleSteps.map((s, i) => {
          const n = i + offset
          return (
            <li key={s} className={n === step ? 'current' : n < step ? 'done' : ''}>
              <span className="num">{n < step ? <CheckIcon aria-hidden="true" /> : i + 1}</span>
              {s}
            </li>
          )
        })}
      </ol>

      {draft && !job && (
        <Alert
          tone="info"
          title="Continue where you left off?"
          action={
            <div className="row">
              <Button size="sm" variant="primary" onClick={resume}>
                Continue
              </Button>
              <Button size="sm" onClick={discard}>
                Start over
              </Button>
            </div>
          }
        >
          You started this {timeAgo(draft.updatedAt)}.
        </Alert>
      )}

      <Card className="stack" style={{ marginTop: draft && !job ? 16 : 0 }}>
        {step === BOARD && <StepBoard form={form} set={set} board={board} setBoard={setBoard} />}
        {step === LINES && <StepLines form={form} set={set} profiles={profiles} profile={profile} />}

        {step === WIFI && profile && (
          <>
            <div>
              <h2>Classroom WiFi</h2>
              <p className="muted" style={{ marginTop: 4 }}>
                The board joins this WiFi to reach the website. Both the name and the password are needed.
              </p>
            </div>
            <WifiFields form={form} set={set} wifiPassword={wifiPassword} setWifiPassword={setWifiPassword} />
            <BadWifiNote settings={settings} />
            <div className="stack-sm">
              <div className="field-label">Your code, made from your answers</div>
              <CodePreview preview={preview} />
            </div>
          </>
        )}

        {step === WIRING && profile && <StepWiring profile={profile} channels={channelList} plan={plan} />}

        {step === CHECK && profile && (
          <>
            <div>
              <h2>{job ? (job.ideOnly ? 'Saved' : 'Uploading') : 'Is everything correct?'}</h2>
              {!job && (
                <p className="muted" style={{ marginTop: 4 }}>
                  Check each line. Use <strong>Edit</strong> to change something, or upload when it is right.
                </p>
              )}
            </div>
            <div className="check-list">
              {checkRow(
                'Board',
                BOARD,
                <>
                  {ESP_NAMES[form.espModel]} · chip <span className="mono">acls-{form.chipId.padStart(6, '0')}</span>
                </>
              )}
              {checkRow(
                'Name and room',
                LINES,
                <>
                  <strong>{form.name}</strong> in {room?.displayName}
                </>
              )}
              {checkRow(
                'What it switches',
                LINES,
                <>
                  {profile.relayModule.split(',')[0]}: {channelList.map((c) => `Relay ${c.index} → ${index.groups.get(c.lightingGroup)?.name ?? 'spare'}`).join(' · ')}
                </>
              )}
              {checkRow(
                'WiFi',
                WIFI,
                <>
                  "{form.wifiSsid}" · password {wifiPassword ? '•'.repeat(Math.min(wifiPassword.length, 12)) : <strong>missing</strong>}
                </>
              )}
              {checkRow('Wiring', WIRING, wires ? `${wires} connections${plan.warnings.length ? `, ${plan.warnings.length} thing(s) to check` : ''}` : '…')}
            </div>

            <div className="stack-sm">
              <div className="field-label">{!job ? 'The code that will be uploaded' : job.ideOnly ? 'The code in the download' : 'The code being uploaded to the board'}</div>
              {job ? <CodePreview key={job.buildId} preview={sent?.buildId === job.buildId ? sent : null} initialTab="config.h" /> : <CodePreview preview={preview} />}
            </div>

            {!job && (
              <div className="row">
                {usb ? (
                  <Button variant="primary" size="lg" icon={Upload} disabled={!wifiOk || busy} onClick={startUpload}>
                    {busy ? 'Saving…' : 'Yes, upload to board'}
                  </Button>
                ) : (
                  <Alert tone="info">
                    {info?.buildService?.ready ? usbSupport().reason : 'The website cannot build firmware yet (run "npm run toolchain:install" on the server).'} You can still download it for
                    Arduino IDE.
                  </Alert>
                )}
                <Button variant="ghost" icon={Download} disabled={!wifiOk || busy} onClick={downloadInstead}>
                  Download for Arduino IDE instead
                </Button>
                {!wifiPassword && <span className="small muted">The WiFi password is missing: use Edit next to WiFi.</span>}
              </div>
            )}

            {job?.buildId && !job.ideOnly && (
              <UsbFlash buildId={job.buildId} espModel={form.espModel} expectedDeviceId={job.result.deviceId} port={board?.port} autoStart={Boolean(board?.port)} />
            )}
            {job?.ideOnly && <ArduinoFallback result={job.result} />}

            {job && (
              <div className="card card-sub row-between">
                <div>
                  <strong>{connected ? `${form.name} is connected to the website ✓` : 'Waiting for the board to connect…'}</strong>
                  <div className="small muted">{connected ? 'All done. Next: the installation steps for the room.' : 'This updates by itself when the board starts with the new firmware.'}</div>
                </div>
                {connected ? (
                  <div className="row">
                    <LinkButton size="sm" variant="primary" to={`/rooms/${form.room}/install`}>
                      Installation steps
                    </LinkButton>
                    <LinkButton size="sm" to={`/devices/${job.device}`}>
                      Open the device
                    </LinkButton>
                  </div>
                ) : (
                  <StatusDot online={false} offlineText="Not connected yet" />
                )}
              </div>
            )}
          </>
        )}

        {error && <Alert tone="bad">{error}</Alert>}
        {!job && (
          <>
            <hr className="divider" />
            <div className="row-between">
              {step > offset ? (
                <Button icon={ArrowLeft} onClick={() => go(step - 1)} disabled={busy}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => navigate(-1)} disabled={busy}>
                  Cancel
                </Button>
              )}
              {step < CHECK && (
                <Button variant="primary" disabled={!canNext || busy} onClick={() => (step === LINES ? saveLinesAndGo() : go(step + 1))}>
                  {step === WIRING ? 'Wires done, check everything' : 'Next'} <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
            {step === WIFI && !wifiOk && settings?.brokerHost && (
              <p className="small muted" style={{ textAlign: 'right', margin: 0 }}>
                Type the WiFi {form.wifiSsid ? 'password' : 'name and password'} to continue.
              </p>
            )}
          </>
        )}
        {step === BOARD && alreadyRegistered && <p className="small muted">This board is already set up; open it above to give it new firmware.</p>}
        {job && (
          <p className="small muted">
            Something went wrong? <Link to="/help/flash-boot-rst">Board won't connect</Link> · <Link to="/help/device-not-online">Uploaded but not connected</Link>
          </p>
        )}
      </Card>
    </>
  )
}
