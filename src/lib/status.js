// Turns the /overview payload into lookups, and works out the confirmed state of a lighting group.

export const chKey = (deviceId, index) => `${deviceId}:${index}`

function groupBy(list, keyOf) {
  const map = new Map()
  for (const item of list) {
    const k = keyOf(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

export function buildIndex(data) {
  const byId = (list) => new Map(list.map((x) => [x._id, x]))
  const channelsByGroup = new Map()
  for (const d of data.devices) {
    if (d.status !== 'active') continue
    for (const c of d.channels) {
      if (!c.lightingGroup) continue
      if (!channelsByGroup.has(c.lightingGroup)) channelsByGroup.set(c.lightingGroup, [])
      channelsByGroup.get(c.lightingGroup).push({ device: d, channel: c })
    }
  }
  return {
    floors: byId(data.floors),
    rooms: byId(data.rooms),
    groups: byId(data.groups),
    profiles: byId(data.profiles),
    devices: byId(data.devices),
    channelsByGroup,
    roomsByFloor: groupBy(data.rooms, (r) => r.floor),
    groupsByRoom: groupBy(data.groups, (g) => g.room),
    devicesByRoom: groupBy(data.devices, (d) => d.room ?? 'none'),
  }
}

// State of a group from device feedback (never assumed), plus any command still in flight.
export function groupStatus(index, cmds, groupId) {
  const feeds = index.channelsByGroup.get(groupId) ?? []
  if (!feeds.length) return { wired: false, online: false, anyOnline: false, state: 'unknown', pending: false, notConfirmed: false, queued: false, feeds }
  const onlineCount = feeds.filter((f) => f.device.state?.online).length
  const states = feeds.map((f) => f.device.state?.channelStates?.[f.channel.index - 1])
  const latest = feeds.map((f) => cmds[chKey(f.device.deviceId, f.channel.index)]).filter(Boolean)
  let state = 'mixed'
  if (states.every((s) => s === 1)) state = 'on'
  else if (states.every((s) => s === 0 || s == null)) state = states.some((s) => s === 0) ? 'off' : 'unknown'
  return {
    wired: true,
    online: onlineCount === feeds.length,
    anyOnline: onlineCount > 0,
    state,
    pending: latest.some((c) => c.result === 'pending'),
    notConfirmed: latest.some((c) => c.result === 'not_confirmed' || c.result === 'failed'),
    queued: latest.some((c) => c.result === 'queued_offline'),
    feeds,
  }
}
