import { AirVent, Fan, Lightbulb, Plug, Tv } from 'lucide-react'

const ICONS = { lights: Lightbulb, fans: Fan, mixed: Plug, ac: AirVent, load: Tv }

// Icon for a lighting group type, in a rounded chip (amber when ON).
export function GroupIcon({ type, on }) {
  const Icon = ICONS[type] ?? Plug
  return (
    <span className={`icon-chip ${on ? 'on' : ''}`}>
      <Icon aria-hidden="true" />
    </span>
  )
}
