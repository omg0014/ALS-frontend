import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme.js'

const CHOICES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Same as this computer', icon: Monitor },
]

// Light / dark / follow the computer. Remembered in this browser.
export function ThemeSwitch() {
  const { choice, setChoice } = useTheme()
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {CHOICES.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" title={label} aria-label={label} aria-pressed={choice === id} onClick={() => setChoice(id)}>
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
