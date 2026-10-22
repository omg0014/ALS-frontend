import { useEffect, useRef, useState } from 'react'
import { Check as CheckIcon, Upload, Usb } from 'lucide-react'
import { errorText } from '../../api/client.js'
import { useBuild } from '../../hooks/useBuild.js'
import { checkBoard, connectBoard, disconnectBoard, flashImage, openMonitor, usbSupport } from '../../lib/flasher.js'
import { Alert, Button, Spinner } from '../ui/index.js'

const STEPS = [
  ['build', 'Prepare the firmware'],
  ['connect', 'Connect to the board'],
  ['upload', 'Upload'],
  ['start', 'Start the board'],
]

// Compile status line (used where a build is shown on its own).
export function BuildStatus({ build }) {
  const c = build?.compile
  if (!c || c.status === 'none') return null
  if (c.status === 'failed')
    return (
      <Alert tone="bad" title="The firmware could not be prepared">
        <details>
          <summary className="small">Show the compiler message</summary>
          <pre style={{ marginTop: 8 }}>{(c.log || '').slice(-4000)}</pre>
        </details>
      </Alert>
    )
  return (
    <div className="row small">
      {c.status === 'ready' ? <CheckIcon size={16} color="var(--ok)" /> : <Spinner />}
      {c.status === 'ready' ? 'Firmware ready' : 'Preparing the firmware on the server (10-40 s)…'}
    </div>
  )
}

// One button: connect → check it is the right board → upload → start it and show what it prints.
// port: a board already chosen earlier (no port picker); autoStart: upload as soon as the firmware is ready.
export function UsbFlash({ buildId, espModel, expectedDeviceId, port, autoStart, onDone }) {
  const build = useBuild(buildId)
  const support = usbSupport()
  const [stage, setStage] = useState(null) // null | connect | upload | start | done
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [manual, setManual] = useState(false)
  const [log, setLog] = useState('')
  const [serial, setSerial] = useState('')
  const stopMonitor = useRef(null)
  const serialBox = useRef(null)
  const started = useRef(false)

  const ready = build?.compile?.status === 'ready' && build.binaryAvailable
  const failed = build?.compile?.status === 'failed'
  const busy = stage === 'connect' || stage === 'upload'

  useEffect(() => () => void stopMonitor.current?.(), [])
  useEffect(() => {
    if (serialBox.current) serialBox.current.scrollTop = serialBox.current.scrollHeight
  }, [serial])

  const run = async ({ byHand = false } = {}) => {
    setError(null)
    setManual(false)
    await stopMonitor.current?.()
    stopMonitor.current = null
    let board
    try {
      setStage('connect')
      board = await connectBoard((t) => setLog((l) => (l + t).slice(-20000)), { manual: byHand, port })
      const problems = checkBoard(board, { espModel, deviceId: expectedDeviceId })
      if (problems.length) {
        await disconnectBoard(board)
        throw new Error(`This is not the right board. ${problems.join(' ')}`)
      }
      setStage('upload')
      setProgress(0)
      const res = await fetch(`/api/builds/${buildId}/usb.bin`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not download the firmware')
      await flashImage(board, new Uint8Array(await res.arrayBuffer()), Number(res.headers.get('X-Flash-Offset') || 0), setProgress)
      setStage('start')
      setSerial('')
      stopMonitor.current = await openMonitor(board.port, (t) => setSerial((s) => (s + t).slice(-30000)))
      onDone?.()
    } catch (err) {
      setStage(null)
      if (err.name === 'NotFoundError') return // the port picker was closed
      setError(errorText(err))
      if (err.needsManual) setManual(true)
    }
  }

  // Board already chosen in an earlier step: start by itself as soon as the firmware is ready.
  useEffect(() => {
    if (autoStart && port && ready && !started.current) {
      started.current = true
      run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, port, ready])

  const finish = async () => {
    await stopMonitor.current?.()
    stopMonitor.current = null
    setStage('done')
  }

  if (!support.ok) return <Alert tone="warn" title="Uploading by USB is not possible here">{support.reason}</Alert>

  const order = ['build', 'connect', 'upload', 'start', 'done']
  const at = failed ? 0 : !ready ? 0 : stage ? order.indexOf(stage) : 1
  return (
    <div className="stack">
      <ol className="progress-steps">
        {STEPS.map(([key, label], i) => {
          const state = i < at || stage === 'done' ? 'done' : i === at && (key === 'build' ? !failed : stage) ? 'now' : 'todo'
          return (
            <li key={key} className={state}>
              <span className="mark">{state === 'done' ? <CheckIcon size={14} /> : state === 'now' ? <Spinner /> : i + 1}</span>
              {label}
              {key === 'upload' && stage === 'upload' && <strong> {Math.round(progress * 100)}%</strong>}
            </li>
          )
        })}
      </ol>
      {failed && <BuildStatus build={build} />}
      {stage === 'upload' && (
        <div className="progress" aria-label="Upload progress">
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {!stage && ready && (
        <div className="stack-sm">
          {!port && <p className="small muted">Unplug the board's 5V supply and connect it to this PC with a USB data cable. Chrome will ask which port: choose usbserial / CH340 / CP210x.</p>}
          <div className="row">
            <Button variant="primary" size="lg" icon={Upload} onClick={() => run()}>
              Upload to board
            </Button>
          </div>
        </div>
      )}
      {stage === 'start' && (
        <div className="row">
          <Button icon={CheckIcon} onClick={finish}>
            Finish (free the USB port)
          </Button>
        </div>
      )}

      {error && <Alert tone="bad">{error}</Alert>}
      {(manual || (error && !stage)) && ready && (
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
              <strong>Release BOOT</strong>, then press the button below.
            </li>
          </ol>
          <div>
            <Button variant="primary" icon={Usb} onClick={() => run({ byHand: true })} disabled={busy}>
              Upload (board is in upload mode)
            </Button>
          </div>
        </div>
      )}

      {(stage === 'start' || serial) && (
        <div className="stack-sm">
          <div className="field-label">What the board says</div>
          <pre ref={serialBox} className="serial">
            {serial || 'Starting…'}
          </pre>
        </div>
      )}
      {stage === 'done' && <Alert tone="ok">Done. You can unplug the USB cable and connect the board's 5V supply.</Alert>}
      {log && (
        <details>
          <summary className="small muted">Technical log</summary>
          <pre>{log}</pre>
        </details>
      )}
    </div>
  )
}
