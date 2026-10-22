// Decorative school building: a grid of windows, lit ones glow amber.
// windows: [{ lit, flicker }]; flicker windows slowly turn on and off by themselves.
export function Facade({ windows }) {
  return (
    <div className="facade" aria-hidden="true">
      {windows.map((w, i) => (
        <span key={i} className={`window ${w.lit ? 'lit' : ''} ${w.flicker ? 'flicker' : ''}`} style={w.flicker ? { '--d': `${-((i * 7) % 9)}s` } : undefined} />
      ))}
    </div>
  )
}
