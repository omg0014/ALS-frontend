// Wording helpers for schedules: days, times and "next / last" lines.

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // the week starts on Monday at school

export const DAY_PRESETS = [
  { label: 'Mon–Fri', days: [1, 2, 3, 4, 5] },
  { label: 'Mon–Sat', days: [1, 2, 3, 4, 5, 6] },
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
]

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

export function daysText(days) {
  const preset = DAY_PRESETS.find((p) => same(p.days, days))
  if (preset) return preset.label
  if (same(days, [0, 6])) return 'Weekends'
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(', ')
}

// "09:00" → "9:00 AM" (or "09:00", following the computer's settings)
export function timeText(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function durationText(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ')
}

export function addMinutes(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = (h * 60 + m + min) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// "9:00 AM – 10:00 AM" or "11:00 AM, 30 min (off 11:30 AM)"
export function slotText(slot) {
  if (slot.kind === 'timer') return `${timeText(slot.start)} for ${durationText(slot.minutes)} (off ${timeText(addMinutes(slot.start, slot.minutes))})`
  return `${timeText(slot.start)} – ${timeText(slot.end)}${slot.end < slot.start ? ' (next day)' : ''}`
}

// "today 11:00 AM", "tomorrow 9:00 AM", "Mon 9:00 AM"
export function whenText(iso, now = new Date()) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(d) - day(now)) / 86400000)
  if (diff === 0) return `today ${time}`
  if (diff === 1) return `tomorrow ${time}`
  if (diff === -1) return `yesterday ${time}`
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString([], { month: 'short' })}, ${time}`
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
