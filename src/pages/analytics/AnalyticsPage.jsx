import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Clock, DoorOpen, Download, Gauge, Lightbulb, Search, Zap } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useLive } from '../../context/LiveContext.js'
import { GROUP_TYPES, TYPE_ORDER } from '../../lib/labels.js'
import { formatHours } from '../../lib/format.js'
import { downloadText } from '../../lib/download.js'
import { Alert, Card, EmptyState, Loading, PageHeader, StatCard, Tabs } from '../../components/ui/index.js'
import { DailyChart } from '../../components/analytics/DailyChart.jsx'

const PERIODS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month30: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  custom: 'Choose dates…',
}

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function periodRange(period, custom) {
  const now = new Date()
  const today = midnight(now)
  const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n)
  switch (period) {
    case 'today':
      return [today, now]
    case 'yesterday':
      return [daysAgo(1), today]
    case 'week':
      return [daysAgo(6), now]
    case 'month30':
      return [daysAgo(29), now]
    case 'thisMonth':
      return [new Date(today.getFullYear(), today.getMonth(), 1), now]
    case 'lastMonth':
      return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 1)]
    default: {
      const from = custom.from ? new Date(`${custom.from}T00:00:00`) : daysAgo(6)
      const to = custom.to ? new Date(`${custom.to}T00:00:00`) : today
      return [from, new Date(Math.min(now, to.getTime() + 24 * 3600e3))]
    }
  }
}

// Column values that are not plain fields: "type:lights" = hours of that type, "typeLabel" = type name
function columnValue(row, key) {
  if (key.startsWith('type:')) return row.byType?.[key.slice(5)] ?? 0
  if (key === 'typeLabel') return GROUP_TYPES[row.type] ?? ''
  return row[key]
}

// Sorting for one table: click a column to sort, click again to flip
function useSort(rows, initialKey, initialDir = 'desc') {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir })
  const sorted = useMemo(() => {
    const val = (r) => {
      const v = columnValue(r, sort.key)
      return typeof v === 'string' ? v.toLowerCase() : (v ?? 0)
    }
    return [...rows].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1))
  }, [rows, sort])
  const header = (key, label, numeric = false) => {
    const active = sort.key === key
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return (
      <th key={label} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={numeric ? 'num' : ''}>
        <button type="button" className={`sort ${active ? 'active' : ''}`} onClick={() => setSort({ key, dir: active && sort.dir === 'desc' ? 'asc' : active ? 'desc' : numeric ? 'desc' : 'asc' })}>
          {label}
          <Icon aria-hidden="true" />
        </button>
      </th>
    )
  }
  return [sorted, header]
}

const kwhText = (v) => (v ? `${v.toLocaleString()} kWh` : '–')

// Share-of-the-biggest bar beside a number
function Share({ value, max }) {
  return (
    <span className="share">
      <span style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </span>
  )
}

function csv(rows) {
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

// How long lights, fans and the rest were ON: whole school, floors, classrooms and lines.
export default function AnalyticsPage() {
  const { data, index } = useLive()
  const [period, setPeriod] = useState('week')
  const [custom, setCustom] = useState(() => ({ from: dayInput(new Date(Date.now() - 6 * 24 * 3600e3)), to: dayInput(new Date()) }))
  const [floor, setFloor] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('rooms')
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [refreshAt, setRefreshAt] = useState(0)

  // Refresh every minute: lines that are ON right now keep adding time
  useEffect(() => {
    const t = setInterval(() => setRefreshAt(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const [from, to] = periodRange(period, custom)
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), tz: String(new Date().getTimezoneOffset()) })
    if (floor) qs.set('floor', floor)
    if (type) qs.set('type', type)
    let stale = false
    api(`/analytics?${qs}`)
      .then((r) => !stale && (setReport(r), setError(null)))
      .catch((err) => !stale && setError(errorText(err)))
    return () => {
      stale = true
    }
  }, [period, custom, floor, type, refreshAt])

  const needle = q.trim().toLowerCase()
  const roomRows = useMemo(() => (report?.rooms ?? []).filter((r) => !needle || `${r.name} ${r.floorName}`.toLowerCase().includes(needle)), [report, needle])
  const lineRows = useMemo(
    () =>
      (report?.lines ?? [])
        .map((l) => {
          const room = index?.rooms.get(l.room)
          return { ...l, roomName: room?.displayName ?? '', floorName: index?.floors.get(room?.floor)?.name ?? '' }
        })
        .filter((l) => !needle || `${l.name} ${l.roomName} ${l.floorName}`.toLowerCase().includes(needle)),
    [report, needle, index]
  )
  const floorRows = report?.floors ?? []
  const [sortedFloors, floorHead] = useSort(floorRows, 'lineHours')
  const [sortedRooms, roomHead] = useSort(roomRows, 'lineHours')
  const [sortedLines, lineHead] = useSort(lineRows, 'hours')

  if (!data) return <Loading />
  const typesWithData = TYPE_ORDER.filter((t) => (type ? t === type : report?.rooms.some((r) => r.byType[t] > 0)))
  const roomTypes = typesWithData.length ? typesWithData : type ? [type] : ['lights', 'fans']
  const busiest = [...(report?.rooms ?? [])].sort((a, b) => b.lineHours - a.lineHours)[0]
  const maxFloor = Math.max(0, ...floorRows.map((f) => f.lineHours))
  const maxRoom = Math.max(0, ...roomRows.map((r) => r.lineHours))
  const maxLine = Math.max(0, ...lineRows.map((l) => l.hours))
  const [from, to] = periodRange(period, custom)
  const rangeText = `${from.toLocaleDateString()} – ${new Date(to - 1).toLocaleDateString()}`

  const exportCsv = () => {
    const name = `acls-analytics-${tab}-${dayInput(from)}-to-${dayInput(new Date(to - 1))}.csv`
    if (tab === 'floors') {
      downloadText(name, csv([['Floor', 'Classrooms', 'Hours ON (all lines)', 'Hours something ON', 'Energy (kWh, est.)', 'Busiest classroom'], ...sortedFloors.map((f) => [f.name, f.rooms, f.lineHours, f.anyOnHours, f.kwh, f.busiestRoom ?? ''])]))
    } else if (tab === 'lines') {
      downloadText(name, csv([['Line', 'Type', 'Classroom', 'Floor', 'Hours ON', 'Times switched on', 'Load (A)', 'Energy (kWh, est.)'], ...sortedLines.map((l) => [l.name, GROUP_TYPES[l.type], l.roomName, l.floorName, l.hours, l.switchedOn, l.amps, l.kwh])]))
    } else {
      downloadText(
        name,
        csv([
          ['Classroom', 'Floor', ...roomTypes.map((t) => `${GROUP_TYPES[t]} (h)`), 'Hours ON (all lines)', 'Hours something ON', 'Energy (kWh, est.)', 'Lines'],
          ...sortedRooms.map((r) => [r.name, r.floorName, ...roomTypes.map((t) => r.byType[t] ?? 0), r.lineHours, r.anyOnHours, r.kwh, r.lines]),
        ])
      )
    }
  }

  return (
    <>
      <PageHeader title="Analytics" description="How long lights, fans and everything else were ON: the whole school, each floor, each classroom and each line." />

      <div className="filters" role="group" aria-label="Filters">
        <select id="an-period" aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {Object.entries(PERIODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {period === 'custom' && (
          <>
            <input id="an-from" type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input id="an-to" type="date" aria-label="To" value={custom.to} min={custom.from} max={dayInput(new Date())} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>
        )}
        <select id="an-floor" aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)}>
          <option value="">All floors</option>
          {data.floors.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name}
            </option>
          ))}
        </select>
        <select id="an-type" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Lights, fans and all</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {GROUP_TYPES[t]} only
            </option>
          ))}
        </select>
        <div className="search">
          <Search aria-hidden="true" />
          <input id="an-search" placeholder="Find a classroom or line…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <Alert tone="bad">{error}</Alert>}
      {!report ? (
        <Loading />
      ) : (
        <div className="stack">
          <div className="grid-stats">
            <StatCard icon={Clock} tone="on" label="Hours ON" value={formatHours(report.totals.lineHours)} sub={`all lines added up · ${rangeText}`} />
            <StatCard icon={Zap} label="Energy (estimate)" value={kwhText(report.totals.kwh)} sub={report.totals.linesWithoutLoad ? `${report.totals.linesWithoutLoad} of ${report.totals.lines} lines have no load (A) set` : 'from each line’s load (A) × 230 V'} />
            <StatCard icon={Lightbulb} tone={report.totals.onNow ? 'on' : ''} label="ON right now" value={report.totals.onNow} total={report.totals.lines} sub="lines" />
            <StatCard icon={DoorOpen} label="Busiest classroom" value={busiest?.lineHours ? busiest.name : '–'} sub={busiest?.lineHours ? `${formatHours(busiest.lineHours)} · ${busiest.floorName}` : 'nothing was ON'} />
          </div>

          <Card title="Hours ON per day" icon={Gauge} description="Every line's ON time added up: two lines ON for 1 hour count as 2 hours. Time while a board was offline is not counted.">
            {report.days.some((d) => d.lineHours > 0) ? (
              <DailyChart days={report.days} types={typesWithData} />
            ) : (
              <EmptyState icon={Clock} title="Nothing was ON in this period">
                Try a longer period, or another floor or type.
              </EmptyState>
            )}
          </Card>

          <div className="row-between">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'floors', label: `Floors (${floorRows.length})`, icon: Building2 },
                { id: 'rooms', label: `Classrooms (${roomRows.length})`, icon: DoorOpen },
                { id: 'lines', label: `Lines (${lineRows.length})`, icon: Lightbulb },
              ]}
            />
            <button type="button" className="btn btn-sm" onClick={exportCsv}>
              <Download aria-hidden="true" />
              Download CSV
            </button>
          </div>

          {tab === 'floors' && (
            <div className="table-wrap">
              <table className="sortable">
                <thead>
                  <tr>
                    {floorHead('name', 'Floor')}
                    {floorHead('rooms', 'Classrooms', true)}
                    {floorHead('lineHours', 'Hours ON', true)}
                    {floorHead('anyOnHours', 'Something ON', true)}
                    {floorHead('kwh', 'Energy (est.)', true)}
                    <th>Busiest classroom</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFloors.map((f) => (
                    <tr key={f.floor}>
                      <td className="strong">{f.name}</td>
                      <td className="num">{f.rooms}</td>
                      <td className="num">
                        <div className="num-bar">
                          {formatHours(f.lineHours)}
                          <Share value={f.lineHours} max={maxFloor} />
                        </div>
                      </td>
                      <td className="num">{formatHours(f.anyOnHours)}</td>
                      <td className="num">{kwhText(f.kwh)}</td>
                      <td>{f.busiestRoom ?? <span className="muted">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'rooms' && (
            <div className="table-wrap">
              <table className="sortable">
                <thead>
                  <tr>
                    {roomHead('name', 'Classroom')}
                    {roomHead('floorName', 'Floor')}
                    {roomTypes.map((t) => roomHead(`type:${t}`, GROUP_TYPES[t], true))}
                    {roomHead('lineHours', 'Hours ON', true)}
                    {roomHead('anyOnHours', 'Something ON', true)}
                    {roomHead('kwh', 'Energy (est.)', true)}
                  </tr>
                </thead>
                <tbody>
                  {sortedRooms.map((r) => (
                    <tr key={r.room}>
                      <td className="strong">
                        <Link to={`/rooms`}>{r.name}</Link>
                      </td>
                      <td>{r.floorName}</td>
                      {roomTypes.map((t) => (
                        <td key={t} className="num">
                          {r.byType[t] ? formatHours(r.byType[t]) : <span className="muted">–</span>}
                        </td>
                      ))}
                      <td className="num">
                        <div className="num-bar">
                          <strong>{formatHours(r.lineHours)}</strong>
                          <Share value={r.lineHours} max={maxRoom} />
                        </div>
                      </td>
                      <td className="num">{formatHours(r.anyOnHours)}</td>
                      <td className="num">{kwhText(r.kwh)}</td>
                    </tr>
                  ))}
                  {!sortedRooms.length && (
                    <tr>
                      <td colSpan={5 + roomTypes.length} className="muted">
                        No classroom matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'lines' && (
            <div className="table-wrap">
              <table className="sortable">
                <thead>
                  <tr>
                    {lineHead('name', 'Line')}
                    {lineHead('typeLabel', 'Type')}
                    {lineHead('roomName', 'Classroom')}
                    {lineHead('floorName', 'Floor')}
                    {lineHead('hours', 'Hours ON', true)}
                    {lineHead('switchedOn', 'Times ON', true)}
                    {lineHead('kwh', 'Energy (est.)', true)}
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((l) => (
                    <tr key={l.group}>
                      <td className="strong">
                        <span className="viz-swatch" style={{ background: `var(--series-${l.type})` }} /> {l.name}
                      </td>
                      <td>{GROUP_TYPES[l.type]}</td>
                      <td>{l.roomName}</td>
                      <td>{l.floorName}</td>
                      <td className="num">
                        <div className="num-bar">
                          {formatHours(l.hours)}
                          <Share value={l.hours} max={maxLine} />
                        </div>
                      </td>
                      <td className="num">{l.switchedOn}</td>
                      <td className="num">{l.amps ? kwhText(l.kwh) : <span className="muted">no load set</span>}</td>
                    </tr>
                  ))}
                  {!sortedLines.length && (
                    <tr>
                      <td colSpan={7} className="muted">
                        No line matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <details className="small muted">
            <summary>How these numbers are worked out</summary>
            <ul>
              <li>
                <strong>Hours ON</strong> adds up every line: two lines ON for 1 hour count as 2 hours. <strong>Something ON</strong> is how long at least one line in that
                classroom (or floor) was ON.
              </li>
              <li>A line's time starts when its relay reports ON and stops when it reports OFF or its board goes offline (for example a power cut).</li>
              <li>
                <strong>Energy</strong> is an estimate: hours × the line's load in amps (set on the Rooms page) × 230 V. Lines without a load count as 0.
              </li>
              <li>Switching from before Analytics existed was rebuilt from the confirmed switch commands in the activity log.</li>
            </ul>
          </details>
        </div>
      )}
    </>
  )
}
