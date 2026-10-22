import { useCallback, useEffect, useState } from 'react'
import { Power, RefreshCw, Settings2 } from 'lucide-react'
import { api } from '../../api/client.js'
import { changedFields, formatDateTime } from '../../lib/format.js'
import { COMMAND_RESULTS } from '../../lib/labels.js'
import { Alert, Button, Card, EmptyState, PageHeader, Tabs } from '../../components/ui/index.js'
import { CommandTable } from '../../components/CommandTable.jsx'

const ENTITY_LABELS = {
  floor: 'Floor',
  room: 'Room',
  lightingGroup: 'Lights / fans group',
  device: 'Device',
  channel: 'Relay',
  hardwareProfile: 'Hardware type',
  user: 'User',
  settings: 'Settings',
  guide: 'Guide',
}

export default function ActivityPage() {
  const [tab, setTab] = useState('commands')
  return (
    <>
      <PageHeader title="Activity log" description="Who switched what and when, and every change to rooms, devices and settings. Kept for one year." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'commands', label: 'Switching', icon: Power },
          { id: 'changes', label: 'Changes', icon: Settings2 },
        ]}
      />
      {tab === 'commands' ? <Commands /> : <Changes />}
    </>
  )
}

function usePaged(path, params, timeKey) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [more, setMore] = useState(false)
  const query = (extra) => new URLSearchParams(Object.entries({ ...params, ...extra, limit: 100 }).filter(([, v]) => v)).toString()
  const key = JSON.stringify(params)
  const load = useCallback(async () => {
    try {
      const r = await api(`${path}?${query()}`)
      setRows(r)
      setMore(r.length === 100)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key])
  useEffect(() => {
    load()
  }, [load])
  const loadMore = async () => {
    const r = await api(`${path}?${query({ before: rows.at(-1)?.[timeKey] })}`)
    setRows((prev) => [...prev, ...r])
    setMore(r.length === 100)
  }
  return { rows, error, more, load, loadMore }
}

function Commands() {
  const [filters, setFilters] = useState({ result: '', deviceId: '', actor: '' })
  const { rows, error, more, load, loadMore } = usePaged('/audit/commands', filters, 'createdAt')
  return (
    <div className="stack">
      <div className="filters">
        <input placeholder="Who (name)" value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
        <input placeholder="Device ID (acls-…)" value={filters.deviceId} onChange={(e) => setFilters({ ...filters, deviceId: e.target.value.trim() })} />
        <select value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })} aria-label="Result">
          <option value="">Any result</option>
          {Object.entries(COMMAND_RESULTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <Button icon={RefreshCw} onClick={load}>
          Refresh
        </Button>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      <CommandTable commands={rows} showDevice />
      {more && (
        <div>
          <Button onClick={loadMore}>Show older</Button>
        </div>
      )}
    </div>
  )
}

function Changes() {
  const [entity, setEntity] = useState('')
  const { rows, error, more, loadMore } = usePaged('/audit/changes', { entity }, 'time')
  const show = (v) => (v == null || v === '' ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 80)
  return (
    <div className="stack">
      <div className="filters">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="What changed">
          <option value="">Everything</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      {!rows.length ? (
        <Card>
          <EmptyState icon={Settings2} title="No changes yet" />
        </Card>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const fields = c.action === 'update' ? changedFields(c) : []
                const name = (c.after ?? c.before)?.name ?? (c.after ?? c.before)?.displayName ?? (c.after ?? c.before)?.title ?? ''
                return (
                  <tr key={c._id}>
                    <td className="nowrap small">{formatDateTime(c.time)}</td>
                    <td>{c.actor?.name}</td>
                    <td>
                      {ENTITY_LABELS[c.entity] ?? c.entity}
                      {name && <div className="sub">{name}</div>}
                    </td>
                    <td className="small">
                      {c.action === 'create' ? (
                        <span className="muted">added</span>
                      ) : c.action === 'delete' ? (
                        <span className="muted">deleted</span>
                      ) : !fields.length ? (
                        <span className="muted">no visible change</span>
                      ) : (
                        <ul className="plain-list">
                          {fields.map((k) => (
                            <li key={k}>
                              <strong>{k}</strong>: <span className="muted">{show(c.before[k])}</span> → {show(c.after[k])}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {more && (
        <div>
          <Button onClick={loadMore}>Show older</Button>
        </div>
      )}
    </div>
  )
}
