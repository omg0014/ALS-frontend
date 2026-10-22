import { GROUP_TYPES } from '../../lib/labels.js'

// The kinds of mains lines a board can switch, in the order they go onto the relays.
export const LINE_TYPES = ['lights', 'fans', 'mixed', 'load']

export function countLines(groups) {
  const counts = Object.fromEntries(LINE_TYPES.map((t) => [t, 0]))
  for (const g of groups) counts[g.type] = (counts[g.type] ?? 0) + 1
  return counts
}

// A room with nothing set up yet starts with one line of lights and one of fans.
export function defaultCounts(roomGroups) {
  return roomGroups.length ? countLines(roomGroups) : { lights: 1, fans: 1, mixed: 0, load: 0 }
}

// The lines in relay order: the room's own lights/fans of each kind first, then new ones
// (id "new:<type>:<n>", created in the room when the user moves on).
export function planLines(counts, roomGroups, names = {}) {
  const lines = []
  for (const type of LINE_TYPES) {
    const have = roomGroups.filter((g) => g.type === type)
    for (let i = 0; i < (counts?.[type] ?? 0); i++) {
      if (have[i]) lines.push({ id: have[i]._id, name: have[i].name, type })
      else {
        const id = `new:${type}:${i + 1}`
        lines.push({ id, name: names[id] ?? `${GROUP_TYPES[type]} ${i + 1}`, type, isNew: true })
      }
    }
  }
  return lines
}

// Smallest relay board for this ESP that has enough relays, tested ones first.
export function pickBoard(profiles, espModel, needed) {
  const fits = profiles.filter((p) => p.espModel === espModel && p.channels >= needed)
  fits.sort((a, b) => Number(b.verified) - Number(a.verified) || a.channels - b.channels)
  return fits[0] ?? null
}

export const maxRelays = (profiles, espModel) => Math.max(0, ...profiles.filter((p) => p.espModel === espModel).map((p) => p.channels))

// Room, line counts and relay board → which relay switches what. Returns { profile, channels }.
export function assignRelays(form, profiles, roomGroups) {
  const lines = planLines(form.counts, roomGroups, form.names)
  const profile = form.profileTouched ? profiles.find((p) => p._id === form.profile) : pickBoard(profiles, form.espModel, lines.length)
  const channels = Object.fromEntries(Array.from({ length: profile?.channels ?? 0 }, (_, i) => [i + 1, lines[i]?.id ?? '']))
  return { profile: profile?._id ?? '', channels }
}

export const isNewLine = (id) => typeof id === 'string' && id.startsWith('new:')
