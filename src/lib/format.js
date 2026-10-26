// Formatting helpers for dates, durations and sizes.

export function timeAgo(date) {
  if (!date) return 'never'
  const s = Math.round((Date.now() - new Date(date)) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} seconds ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(date).toLocaleDateString()
}

export function formatUptime(sec) {
  if (sec == null) return '–'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`
}

export const formatDateTime = (d) => (d ? new Date(d).toLocaleString() : '–')
export const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '–')

export function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// "Thursday 22 October"
export function todayText(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

// Field names that differ between two versions of a record (for the activity log).
export function changedFields(change) {
  if (!change.before || !change.after) return []
  return Object.keys({ ...change.before, ...change.after }).filter(
    (k) => !['_id', 'updatedAt', 'createdAt', '__v'].includes(k) && JSON.stringify(change.before[k]) !== JSON.stringify(change.after[k])
  )
}

// ON time for Analytics: "45 min", "3.5 h", "1,240 h"
export function formatHours(h) {
  if (!h) return '0 h'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  if (h < 100) return `${Math.round(h * 10) / 10} h`
  return `${Math.round(h).toLocaleString()} h`
}
