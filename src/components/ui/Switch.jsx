// The big ON/OFF toggle used for lights and fans. state: on | off | mixed | unknown
export function Switch({ state, disabled, onToggle, label }) {
  const on = state === 'on'
  return (
    <button
      type="button"
      className={`switch ${on ? 'on' : state === 'mixed' ? 'mixed' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? 'on' : 'off'}`}
      disabled={disabled}
      onClick={onToggle}
    />
  )
}
