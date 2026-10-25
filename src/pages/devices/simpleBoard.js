// Defaults match a board running the usual sketch: public HiveMQ, "<topic>" takes ON / OFF,
// "<topic>/state" answers ON / OFF.
export const SIMPLE_DEFAULTS = {
  name: '',
  room: '',
  lineGroup: '',
  lineType: 'ac',
  lineName: '',
  host: 'broker.hivemq.com',
  port: 1883,
  tls: false,
  username: '',
  password: '',
  commandTopic: '',
  stateTopic: '',
  stateTouched: false,
  onPayload: 'ON',
  offPayload: 'OFF',
  retain: true,
}

// Form values from a saved board (overview data)
export function simpleFormFrom(device, channels) {
  const s = device.simple ?? {}
  const u = s.url ? new URL(s.url.replace(/^mqtt/, 'http')) : null
  return {
    ...SIMPLE_DEFAULTS,
    name: device.name,
    room: device.room ?? '',
    lineGroup: channels?.[0]?.lightingGroup ?? '',
    host: u?.hostname ?? '',
    port: Number(u?.port) || (s.url?.startsWith('mqtts') ? 8883 : 1883),
    tls: Boolean(s.url?.startsWith('mqtts')),
    username: s.username ?? '',
    commandTopic: s.commandTopic ?? '',
    stateTopic: s.stateTopic ?? '',
    stateTouched: true,
    onPayload: s.onPayload ?? 'ON',
    offPayload: s.offPayload ?? 'OFF',
    retain: s.retain !== false,
  }
}
