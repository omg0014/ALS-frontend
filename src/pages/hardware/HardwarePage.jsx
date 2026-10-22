import { useEffect, useState } from 'react'
import { CircleCheck, Plus, TriangleAlert } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { isAdmin } from '../../lib/permissions.js'
import { ESP_NAMES } from '../../lib/labels.js'
import { Badge, Button, Card, Loading, PageHeader } from '../../components/ui/index.js'
import { TestSketchesButton } from '../../components/firmware/TestSketches.jsx'
import { NewProfileModal } from './NewProfileModal.jsx'

// The ESP + relay board combinations the school uses (P1-P5 from the tested hardware reference).
export default function HardwarePage() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [profiles, setProfiles] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = () => api('/profiles').then(setProfiles).catch((e) => toast.error(e.message))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleVerified = async (p) => {
    const ok = await confirm(
      p.verified
        ? { title: `Mark ${p.code} as not tested?`, message: 'Devices of this type will show a warning again.', confirmLabel: 'Mark as not tested' }
        : {
            title: `Mark ${p.code} as tested?`,
            message: (
              <>
                <p>Only do this after the desk test passed on a real board:</p>
                <ul>
                  <li>each relay clicks</li>
                  <li>COM-NO closes when a relay is on</li>
                  <li>the board does not restart when all relays switch together</li>
                </ul>
              </>
            ),
            confirmLabel: 'Mark as tested',
          }
    )
    if (!ok) return
    try {
      await api(`/profiles/${p._id}/verification`, {
        method: 'PATCH',
        body: { verified: !p.verified, statusNote: p.verified ? 'Unverified' : `Verified by bench test (${new Date().toLocaleDateString()})` },
      })
      toast.ok(`${p.code} updated`)
      load()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  if (!profiles) return <Loading />
  return (
    <>
      <PageHeader
        title="Hardware types"
        description="Each type is an ESP board plus a relay board, with its tested pins. The firmware and wiring sheets are made from these. Pins of a type are never changed silently."
        actions={
          isAdmin(user) && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Add a hardware type
            </Button>
          )
        }
      />
      <div className="grid-cards">
        {profiles.map((p) => (
          <Card
            key={p._id}
            title={`${p.code} · ${ESP_NAMES[p.espModel]} + ${p.channels} relay${p.channels > 1 ? 's' : ''}`}
            actions={p.verified ? <Badge tone="ok" icon={CircleCheck}>Tested</Badge> : <Badge tone="warn" icon={TriangleAlert}>Not yet tested</Badge>}
            className="stack-sm"
          >
            {!p.verified && <p className="small" style={{ color: 'var(--warn)' }}>{p.statusNote}. Use on the desk only until it is tested.</p>}
            <dl className="kv small">
              <dt>ESP board</dt>
              <dd>{p.espBoard}</dd>
              <dt>Relay board</dt>
              <dd>{p.relayModule}</dd>
              <dt>Relay turns on at</dt>
              <dd>
                {p.trigger}
                {p.triggerNote && <span className="muted"> · {p.triggerNote}</span>}
              </dd>
              <dt>Pins</dt>
              <dd>{p.pins.map((x, i) => `${p.channels > 1 ? `Relay ${i + 1}` : 'Relay'}: ${x.label}`).join(', ')}</dd>
              <dt>Load</dt>
              <dd>
                {p.contactRatingA ? `${p.contactRatingA} A relay` : '–'}
                {p.maxAmpsPerChannel ? `, keep each group under ${p.maxAmpsPerChannel} A` : ''}
              </dd>
            </dl>
            {p.setupNotes?.length > 0 && (
              <details>
                <summary className="small">Setup notes ({p.setupNotes.length})</summary>
                <ul className="small" style={{ marginTop: 8 }}>
                  {p.setupNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="row" style={{ marginTop: 6 }}>
              <TestSketchesButton profile={p} />
              {isAdmin(user) && (
                <Button size="sm" variant="ghost" onClick={() => toggleVerified(p)}>
                  {p.verified ? 'Mark as not tested' : 'Mark as tested'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {creating && (
        <NewProfileModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
    </>
  )
}
