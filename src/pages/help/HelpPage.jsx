import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Pencil, Plus } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.js'
import { useToast } from '../../context/feedback.js'
import { isAdmin } from '../../lib/permissions.js'
import { timeAgo } from '../../lib/format.js'
import { Alert, Button, Card, EmptyState, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui/index.js'
import { Markdown } from '../../components/Markdown.jsx'

const CATEGORIES = { upload: 'Uploading firmware', setup: 'Getting set up', troubleshooting: 'When something goes wrong', other: 'Other' }

export default function HelpPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [creating, setCreating] = useState(false)
  const loadList = useCallback(() => api('/guides').then(setList), [])
  useEffect(() => {
    loadList()
  }, [loadList])

  return (
    <>
      <PageHeader
        title="Help & guides"
        description="Step-by-step help for setting up boards, uploading firmware and fixing common problems."
        actions={
          isAdmin(user) && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New guide
            </Button>
          )
        }
      />
      <div className="help-layout">
        <Card className="help-nav">
          {Object.entries(CATEGORIES).map(([cat, title]) => {
            const items = list.filter((g) => g.category === cat)
            if (!items.length) return null
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div className="nav-title" style={{ padding: '0 10px 6px' }}>
                  {title}
                </div>
                {items.map((g) => (
                  <Link key={g.slug} to={`/help/${g.slug}`} className={g.slug === slug ? 'active' : ''}>
                    {g.title}
                  </Link>
                ))}
              </div>
            )
          })}
        </Card>
        {slug ? (
          <GuideView key={slug} slug={slug} admin={isAdmin(user)} onChanged={loadList} />
        ) : (
          <Card>
            <EmptyState icon={BookOpen} title="Choose a guide">
              Pick a topic on the left. New here? Start with “Upload firmware from the website (USB)”.
            </EmptyState>
          </Card>
        )}
      </div>
      {creating && (
        <GuideEditor
          guide={{ slug: '', title: '', category: 'troubleshooting', order: 10, markdown: '' }}
          isNew
          onClose={() => setCreating(false)}
          onSaved={(g) => {
            setCreating(false)
            loadList()
            navigate(`/help/${g.slug}`)
          }}
        />
      )}
    </>
  )
}

function GuideView({ slug, admin, onChanged }) {
  const [guide, setGuide] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const load = useCallback(() => api(`/guides/${slug}`).then(setGuide).catch((e) => setError(e.message)), [slug])
  useEffect(() => {
    load()
  }, [load])
  if (error) return <Alert tone="bad">{error}</Alert>
  if (!guide) return <Card><Loading /></Card>
  return (
    <Card
      title={guide.title}
      actions={
        admin && (
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )
      }
    >
      <Markdown text={guide.markdown} />
      <p className="tiny muted" style={{ marginTop: 18 }}>
        Last updated {timeAgo(guide.updatedAt)} by {guide.updatedBy?.name ?? 'unknown'}
      </p>
      {editing && (
        <GuideEditor
          guide={guide}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
            onChanged()
          }}
        />
      )}
    </Card>
  )
}

// Admins edit guides in Markdown, with a preview.
function GuideEditor({ guide, isNew, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ slug: guide.slug, title: guide.title, category: guide.category, order: guide.order, markdown: guide.markdown })
  const [tab, setTab] = useState('write')
  const [error, setError] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    try {
      const g = await api(isNew ? '/guides' : `/guides/${guide.slug}`, { method: isNew ? 'POST' : 'PUT', body: { ...form, order: Number(form.order) } })
      toast.ok('Guide saved')
      onSaved(g)
    } catch (err) {
      setError(errorText(err))
    }
  }
  return (
    <Modal title={isNew ? 'New guide' : `Edit: ${guide.title}`} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="form-grid">
          <Field label="Title">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          {isNew && (
            <Field label="Web address" hint="lowercase-words-with-dashes">
              <input required pattern="[a-z0-9\-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </Field>
          )}
          <Field label="Section">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Position in the section">
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          </Field>
        </div>
        <div>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'write', label: 'Write' }, { id: 'preview', label: 'Preview' }]} />
          {tab === 'preview' ? <Markdown text={form.markdown} /> : <textarea className="code" value={form.markdown} onChange={(e) => setForm({ ...form, markdown: e.target.value })} />}
          <p className="tiny muted">Formatting: **bold**, # Heading, - list item, 1. numbered step, `code`.</p>
        </div>
        {error && <Alert tone="bad">{error}</Alert>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save guide
          </Button>
        </div>
      </form>
    </Modal>
  )
}
