import { COMMAND_RESULTS } from '../lib/labels.js'
import { formatDateTime } from '../lib/format.js'
import { Badge, EmptyState } from './ui/index.js'
import { ScrollText } from 'lucide-react'

// History of ON/OFF commands: who, what, and whether the device confirmed it.
export function CommandTable({ commands, showDevice }) {
  if (!commands.length) {
    return (
      <EmptyState icon={ScrollText} title="Nothing switched yet">
        Every ON/OFF command will be listed here.
      </EmptyState>
    )
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>What</th>
            {showDevice && <th>Device</th>}
            <th>Switched</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {commands.map((c) => {
            const result = COMMAND_RESULTS[c.result] ?? { label: c.result, tone: 'neutral' }
            return (
              <tr key={c.cmdId}>
                <td className="nowrap small">{formatDateTime(c.createdAt)}</td>
                <td>
                  {c.actor?.kind === 'user' ? c.actor.name : <span className="muted">{c.actor?.name ?? 'system'}</span>}
                  {c.sourceIp && <div className="sub">{c.sourceIp}</div>}
                </td>
                <td>{c.target?.label}</td>
                {showDevice && (
                  <td>
                    <code>{c.deviceId}</code>
                    <div className="sub">relay IN{c.channel}</div>
                  </td>
                )}
                <td>
                  <Badge tone={c.desired === 'ON' ? 'on' : 'neutral'}>{c.desired}</Badge>
                </td>
                <td className="nowrap">
                  <Badge tone={result.tone}>{result.label}</Badge>
                  {c.latencyMs != null && <span className="small muted"> in {c.latencyMs} ms</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
