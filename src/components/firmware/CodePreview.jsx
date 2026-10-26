import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { EditorView } from '@codemirror/view'
import { Code, ListChecks } from 'lucide-react'
import { Tabs } from '../ui/index.js'

// What will be uploaded: a plain-language summary, and the real code with the user's values filled in.
// initialTab: which tab opens first (default: the summary when there is one)
export function CodePreview({ preview, initialTab }) {
  const [picked, setPicked] = useState(null)
  const extensions = useMemo(() => [cpp(), EditorView.lineWrapping], [])
  if (!preview) return null
  // The plain-language tab is there only when a summary is given (not for code already uploaded).
  const tab = picked ?? initialTab ?? (preview.summary ? 'summary' : preview.files[0]?.name)
  const file = preview.files.find((f) => f.name === tab)
  return (
    <div className="stack-sm">
      <Tabs
        value={tab}
        onChange={setPicked}
        tabs={[
          ...(preview.summary ? [{ id: 'summary', label: 'What it will do', icon: ListChecks }] : []),
          ...preview.files.map((f) => ({ id: f.name, label: f.name, icon: Code })),
        ]}
      />
      {tab === 'summary' ? (
        <ul className="plain-list">
          {preview.summary.map((line) => (
            <li key={line} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span className="badge badge-ok" style={{ marginTop: 2 }}>
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {file.note}. Passwords are hidden here; the real ones go onto the board.
          </p>
          <div className="code-editor">
            <CodeMirror value={file.content} height="380px" theme="light" extensions={extensions} editable={false} basicSetup={{ foldGutter: false }} />
          </div>
        </>
      )}
    </div>
  )
}
