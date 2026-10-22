import { Alert, Warnings } from '../ui/index.js'

// Wiring tables for one relay box: signal + power wires, relay outputs, jumper settings, mains notes.
export function WiringTables({ plan }) {
  return (
    <div className="stack">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {[...plan.signal, ...plan.power].map((r, i) => (
              <tr key={i}>
                <td>{r.from}</td>
                <td>{r.to}</td>
                <td className="small muted">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Relay</th>
              <th>COM</th>
              <th>NO</th>
              <th>NC</th>
            </tr>
          </thead>
          <tbody>
            {plan.outputs.map((o) => (
              <tr key={o.relay}>
                <td className="nowrap">{o.relay}</td>
                <td>{o.com}</td>
                <td>{o.no}</td>
                <td className="muted">{o.nc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Warnings title="Module settings" list={plan.jumpers} />
      <Alert tone="info" title="Power and safety">
        <ul>
          {plan.mains.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Alert>
    </div>
  )
}
