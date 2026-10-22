import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { CircleCheck, FilePlus, Hammer, Save, Trash, TriangleAlert, Upload } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { useBuild } from '../../hooks/useBuild.js'
import { useTheme } from '../../hooks/useTheme.js'
import { formatDateTime } from '../../lib/format.js'
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner } from '../../components/ui/index.js'
import { UsbFlash } from '../../components/firmware/UsbFlash.jsx'
import { EXAMPLES } from './examples.js'

const BOARDS = { esp8266: 'NodeMCU (ESP8266)', esp32: 'ESP32 DevKit' }
const DRAFT_KEY = 'acls.codeEditor.draft'
const loadDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null
  } catch {
    return null
  }
}
const saveDraft = (d) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable: the draft just isn't kept */
  }
}

// Compiler messages like ".../sketch.ino:12:5: error: 'x' was not declared" → { line, col, kind, text }
function parseMessages(log = '') {
  const out = []
  for (const m of log.matchAll(/sketch\.ino:(\d+):(\d+):\s+(error|warning):\s+(.*)/g)) {
    out.push({ line: Number(m[1]), col: Number(m[2]), kind: m[3], text: m[4] })
  }
  return out
}

// Write your own Arduino program, compile it on the server and upload it over USB: the website's own Arduino IDE.
export default function CodeEditorPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { dark } = useTheme()
  const editor = useRef(null)
  const [draft] = useState(loadDraft)

  const [info, setInfo] = useState(null)
  const [programs, setPrograms] = useState([])
  const [doc, setDoc] = useState(() => draft ?? { id: null, name: 'My program', board: 'esp8266', code: EXAMPLES[0].code })
  // What was last opened or saved: edits are compared against it (a draft restored from the browser counts as changed).
  const [base, setBase] = useState(() => (draft ? null : { name: 'My program', board: 'esp8266', code: EXAMPLES[0].code }))
  const [buildId, setBuildId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const build = useBuild(buildId)

  const loadPrograms = useCallback(() => api('/sketches').then(setPrograms).catch(() => {}), [])
  useEffect(() => {
    api('/code/info').then(setInfo).catch((e) => setError(errorText(e)))
    loadPrograms()
  }, [loadPrograms])
  useEffect(() => saveDraft(doc), [doc])

  const set = (patch) => setDoc((d) => ({ ...d, ...patch }))
  const dirty = !base || base.name !== doc.name || base.board !== doc.board || base.code !== doc.code
  const status = doc.id ? (dirty ? 'Changes not saved yet (kept in this browser)' : 'Saved') : dirty ? 'Not saved yet (kept in this browser)' : 'Not saved yet'
  const messages = parseMessages(build?.compile?.log)
  const compiling = ['queued', 'compiling'].includes(build?.compile?.status)

  const confirmDiscard = async () =>
    !dirty || (await confirm({ title: 'Discard your changes?', message: 'The current program has changes that are not saved.', confirmLabel: 'Discard' }))

  const open = async (id) => {
    if (!(await confirmDiscard())) return
    const p = await api(`/sketches/${id}`)
    setDoc({ id: p._id, name: p.name, board: p.board, code: p.code })
    setBase({ name: p.name, board: p.board, code: p.code })
    setBuildId(null)
    setUploading(false)
  }

  const fromExample = async (ex) => {
    if (!(await confirmDiscard())) return
    const next = { name: ex.title, board: ex.boards.includes(doc.board) ? doc.board : ex.boards[0], code: ex.code }
    setDoc({ id: null, ...next })
    setBase(next)
    setBuildId(null)
    setUploading(false)
  }

  const save = async () => {
    try {
      const body = { name: doc.name, board: doc.board, code: doc.code }
      const p = doc.id ? await api(`/sketches/${doc.id}`, { method: 'PUT', body }) : await api('/sketches', { method: 'POST', body })
      setDoc((d) => ({ ...d, id: p._id }))
      setBase(body)
      toast.ok(`"${doc.name}" saved`)
      loadPrograms()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const remove = async () => {
    if (!(await confirm({ title: `Delete "${doc.name}"?`, message: 'The saved program is deleted for everyone.', confirmLabel: 'Delete', tone: 'danger' }))) return
    await api(`/sketches/${doc.id}`, { method: 'DELETE' })
    toast.ok('Program deleted')
    setDoc({ ...doc, id: null })
    setBase(null)
    loadPrograms()
  }

  const compile = async (thenUpload) => {
    setError(null)
    setUploading(false)
    try {
      const r = await api('/code/compile', { method: 'POST', body: { board: doc.board, code: doc.code, name: doc.name } })
      setBuildId(r._id)
      setUploading(thenUpload)
    } catch (err) {
      setBuildId(null)
      setError(errorText(err))
    }
  }

  const upload = async () => {
    const ok = await confirm({
      title: 'Upload your own program?',
      message: (
        <p>
          It <strong>replaces the ACLS firmware</strong> on the board you connect. That board then stops working with the lighting system until the ACLS firmware is uploaded
          again (Devices → Upload firmware).
        </p>
      ),
      confirmLabel: 'Compile and upload',
    })
    if (ok) compile(true)
  }

  const jumpTo = (line) => {
    const view = editor.current?.view
    if (!view) return
    const target = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines))
    view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true })
    view.focus()
  }

  const extensions = useMemo(() => [cpp()], [])

  return (
    <>
      <PageHeader
        title="Code editor"
        description="Write your own Arduino program, check it, and upload it to a board over USB, all from the website."
        actions={
          <>
            <Button icon={Hammer} onClick={() => compile(false)} disabled={compiling || !info?.ready}>
              Check
            </Button>
            <Button variant="primary" icon={Upload} onClick={upload} disabled={compiling || !info?.ready}>
              Upload
            </Button>
          </>
        }
      />

      <div className="stack">
        {info && !info.ready && <Alert tone="warn">The build toolchain is not installed on the server yet. Run "npm run toolchain:install" on the server.</Alert>}
        <Alert tone="info">
          For the lights, use <strong>Devices → Upload firmware</strong>: that firmware is made for each board automatically. This editor is for your own programs and
          experiments. Available libraries: {info?.libraries.join(', ') ?? '…'} and the built-in ESP libraries (WiFi, WebServer, …).
        </Alert>

        <div className="code-layout">
          <Card className="code-side stack-sm">
            <div className="row-between">
              <h3>My programs</h3>
              <Button size="sm" variant="ghost" icon={FilePlus} aria-label="New program" title="New program" onClick={() => fromExample({ title: 'New program', boards: [doc.board], code: 'void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n}\n' })} />
            </div>
            {!programs.length && <p className="small muted">Nothing saved yet.</p>}
            {programs.map((p) => (
              <button key={p._id} type="button" className={`code-item ${doc.id === p._id ? 'active' : ''}`} onClick={() => open(p._id)}>
                <span className="strong">{p.name}</span>
                <span className="tiny muted">
                  {BOARDS[p.board]} · {formatDateTime(p.updatedAt)}
                </span>
              </button>
            ))}
            <hr className="divider" />
            <h3>Examples</h3>
            {EXAMPLES.map((ex, i) => (
              <Fragment key={ex.id}>
                {ex.group !== EXAMPLES[i - 1]?.group && <div className="tiny muted strong">{ex.group}</div>}
                <button type="button" className="code-item" onClick={() => fromExample(ex)}>
                  <span>{ex.title}</span>
                </button>
              </Fragment>
            ))}
          </Card>

          <div className="stack" style={{ minWidth: 0 }}>
            <Card className="stack-sm">
              <div className="form-grid">
                <Field label="Program name">
                  <input value={doc.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
                <Field label="Board">
                  <select value={doc.board} onChange={(e) => set({ board: e.target.value })}>
                    {Object.entries(BOARDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="code-editor">
                <CodeMirror
                  ref={editor}
                  value={doc.code}
                  height="460px"
                  theme={dark ? 'dark' : 'light'}
                  extensions={extensions}
                  onChange={(code) => set({ code })}
                  basicSetup={{ tabSize: 2 }}
                />
              </div>
              <div className="row-between">
                <span className="small muted">{status}</span>
                <div className="row">
                  {doc.id && (
                    <Button size="sm" variant="ghost" icon={Trash} onClick={remove}>
                      Delete
                    </Button>
                  )}
                  <Button size="sm" icon={Save} onClick={save} disabled={(doc.id && !dirty) || !doc.name.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            </Card>

            {(buildId || error) && (
              <Card title="Result">
                {error && <Alert tone="bad">{error}</Alert>}
                {build && (
                  <div className="stack-sm">
                    <div className="row">
                      {compiling && <Spinner />}
                      {build.compile?.status === 'ready' && (
                        <Badge tone="ok" icon={CircleCheck}>
                          No errors · {Math.round((build.compile.usb?.size ?? 0) / 1024)} KB
                        </Badge>
                      )}
                      {build.compile?.status === 'failed' && (
                        <Badge tone="bad" icon={TriangleAlert}>
                          {messages.filter((m) => m.kind === 'error').length || 'Some'} error(s)
                        </Badge>
                      )}
                      {compiling && <span className="small muted">Compiling on the server…</span>}
                    </div>
                    {messages.length > 0 && (
                      <ul className="plain-list code-messages">
                        {messages.map((m, i) => (
                          <li key={i}>
                            <button type="button" className={`code-msg ${m.kind}`} onClick={() => jumpTo(m.line)}>
                              <span className="mono">Line {m.line}</span> {m.text}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {build.compile?.log && (
                      <details>
                        <summary className="small">Full compiler output</summary>
                        <pre style={{ marginTop: 8 }}>{build.compile.log.slice(-6000)}</pre>
                      </details>
                    )}
                  </div>
                )}
              </Card>
            )}

            {uploading && build?.compile?.status !== 'failed' && buildId && (
              <Card title="Upload to the board">
                <UsbFlash key={buildId} buildId={buildId} espModel={doc.board} />
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
