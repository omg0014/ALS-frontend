import { useEffect, useRef, useState } from 'react'
import { GROUP_TYPES, TYPE_ORDER } from '../../lib/labels.js'
import { formatHours } from '../../lib/format.js'

const H = 240
const PAD = { top: 12, right: 8, bottom: 26, left: 44 }

// 0, 2, 4… style ticks for the hours axis
function niceTicks(max) {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw)
  const ticks = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  if (ticks.at(-1) < max) ticks.push(Math.round((ticks.at(-1) + step) * 1e6) / 1e6)
  return ticks
}

const dayLabel = (iso, long) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })

// ON hours per day, stacked by line type (lights, fans, …), with a hover tooltip per day.
export function DailyChart({ days, types }) {
  const box = useRef(null)
  const [width, setWidth] = useState(720)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shown = TYPE_ORDER.filter((t) => types.includes(t))
  const ticks = niceTicks(Math.max(0, ...days.map((d) => d.lineHours)))
  const top = ticks.at(-1)
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, days.length)
  const barW = Math.max(2, Math.min(36, slot - 2))
  const y = (v) => PAD.top + innerH - (v / top) * innerH
  const labelEvery = Math.max(1, Math.ceil(64 / slot))

  return (
    <div className="viz" ref={box}>
      {shown.length > 1 && (
        <ul className="viz-legend" aria-label="Line types">
          {shown.map((t) => (
            <li key={t}>
              <span className="viz-swatch" style={{ background: `var(--series-${t})` }} />
              {GROUP_TYPES[t]}
            </li>
          ))}
        </ul>
      )}
      <div className="viz-plot" onMouseLeave={() => setHover(null)}>
        {/* 100% wide (never pushes the page wider); the drawing is laid out for the measured width */}
        <svg viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMinYMin meet" style={{ width: '100%', height: H }} role="img" aria-label="Hours ON per day">
          {ticks.map((t) => (
            <g key={t}>
              <line className="viz-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="viz-axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          <text className="viz-axis" x={4} y={PAD.top - 2}>
            h
          </text>
          {days.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2
            let acc = 0
            const segs = shown.filter((t) => d.byType[t] > 0)
            return (
              <g key={d.date}>
                {segs.map((t, k) => {
                  const v = d.byType[t]
                  const y1 = y(acc + v)
                  const h = Math.max(0, y(acc) - y1 - (k < segs.length - 1 ? 2 : 0)) // 2px gap between segments
                  acc += v
                  const isTop = k === segs.length - 1
                  const r = isTop ? Math.min(4, barW / 2, h) : 0
                  return (
                    <path
                      key={t}
                      fill={`var(--series-${t})`}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      d={`M${x},${y1 + h} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y1 + h} Z`}
                    />
                  )
                })}
                {i % labelEvery === 0 && (
                  <text className="viz-axis" x={x + barW / 2} y={H - 8} textAnchor="middle">
                    {dayLabel(d.date)}
                  </text>
                )}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            )
          })}
          <line className="viz-base" x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} />
        </svg>
        {hover !== null && days[hover] && (
          <div className="viz-tip" style={{ left: Math.min(width - 200, Math.max(0, PAD.left + hover * slot + slot / 2 - 90)) }}>
            <strong>{dayLabel(days[hover].date, true)}</strong>
            <span className="viz-tip-total">{formatHours(days[hover].lineHours)} ON</span>
            {shown
              .filter((t) => days[hover].byType[t] > 0)
              .reverse()
              .map((t) => (
                <span key={t} className="viz-tip-row">
                  <span className="viz-swatch" style={{ background: `var(--series-${t})` }} />
                  {GROUP_TYPES[t]}
                  <b>{formatHours(days[hover].byType[t])}</b>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
