// Schematic of one relay box: ESP pins → relay IN pins, 5V rail and common ground, relay COM/NO → groups.
export function WiringDiagram({ profile, channels, groupName }) {
  const sorted = [...channels].sort((a, b) => a.index - b.index)
  const n = sorted.length
  const rowH = 30
  const top = 64
  const powerY = top + n * rowH + 14
  const boxH = n * rowH + 2 * rowH + 24
  const H = powerY + 2 * rowH + 70
  const esp = { x: 10, w: 170 }
  const relay = { x: 300, w: 150 }
  const outX = relay.x + relay.w + 20
  const espName = profile.espModel === 'esp32' ? 'ESP32 DevKit' : 'NodeMCU v3'
  const inName = (i) => (profile.channels === 1 ? 'IN' : `IN${i}`)
  const vcc = profile.moduleKind === 'red30' ? 'DC+' : profile.moduleKind === 'blue2' ? '5V' : 'VCC'
  const gnd = profile.moduleKind === 'red30' ? 'DC−' : 'GND'
  const label = (gpio) => profile.pins?.find((p) => p.gpio === gpio)?.label ?? `GPIO${gpio}`
  const railX = 240
  const gndX = 258
  const supplyY = H - 46

  return (
    <svg className="wiring" viewBox={`0 0 760 ${H}`} role="img" aria-label="Wiring diagram">
      <rect className="box" x={esp.x} y={top - 34} width={esp.w} height={boxH} rx="8" />
      <text className="title" x={esp.x + 10} y={top - 14}>
        {espName}
      </text>
      <rect className="box" x={relay.x} y={top - 34} width={relay.w} height={boxH} rx="8" />
      <text className="title" x={relay.x + 10} y={top - 14}>
        Relay {profile.channels}-ch
      </text>
      <text className="small-t" x={relay.x + 10} y={top - 2}>
        active {profile.trigger}
      </text>

      {sorted.map((c, i) => {
        const y = top + 14 + i * rowH
        const g = groupName(c.lightingGroup)
        return (
          <g key={c.index}>
            <text x={esp.x + esp.w - 8} y={y + 4} textAnchor="end">
              {label(c.gpio)} · GPIO{c.gpio}
            </text>
            <line className="sig" x1={esp.x + esp.w} y1={y} x2={relay.x} y2={y} />
            <circle className="pin" cx={esp.x + esp.w} cy={y} r="3.5" />
            <circle className="pin" cx={relay.x} cy={y} r="3.5" />
            <text x={relay.x + 10} y={y + 4}>
              {inName(c.index)}
            </text>
            <text className="small-t" x={relay.x + relay.w - 8} y={y + 4} textAnchor="end">
              K{c.index}
            </text>
            <line className="out" x1={relay.x + relay.w} y1={y} x2={outX} y2={y} />
            <text x={outX + 6} y={y + 4}>
              <tspan className="small-t">COM ← L · NO → </tspan>
              <tspan className={g ? 'grp' : 'small-t'}>{g ?? 'spare'}</tspan>
            </text>
          </g>
        )
      })}

      {/* power rows */}
      {[
        ['VIN (5V)', vcc, railX, 'pwr'],
        ['GND', gnd, gndX, 'gnd'],
      ].map(([espPin, relayPin, x, cls], k) => {
        const y = powerY + 14 + k * rowH
        return (
          <g key={cls}>
            <text x={esp.x + esp.w - 8} y={y + 4} textAnchor="end">
              {espPin}
            </text>
            <text x={relay.x + 10} y={y + 4}>
              {relayPin}
            </text>
            <line className={cls} x1={esp.x + esp.w} y1={y} x2={relay.x} y2={y} />
            <line className={cls} x1={x} y1={y} x2={x} y2={supplyY} />
            <circle className={`dot-${cls}`} cx={x} cy={y} r="3.5" />
          </g>
        )
      })}
      <rect className="box" x={railX - 70} y={supplyY} width="160" height="34" rx="6" />
      <text x={railX + 10} y={supplyY + 21} textAnchor="middle">
        5V supply (+ / −)
      </text>
      <text className="small-t" x={outX + 6} y={supplyY + 14}>
        L = incoming phase, before the relays.
      </text>
      <text className="small-t" x={outX + 6} y={supplyY + 30}>
        NC unused. Electrician only.
      </text>
    </svg>
  )
}
