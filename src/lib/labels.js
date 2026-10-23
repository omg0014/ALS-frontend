// Every user-facing name for an internal value, in one place (easy to reword or translate later).

export const ROLE_LABELS = { admin: 'Admin', staff: 'Facility staff', viewer: 'Viewer' }
export const ROLE_HELP = {
  admin: 'Everything: rooms, devices, users, settings and switching whole floors or the school.',
  staff: 'Switch lights in rooms, add and edit devices, run installation checks.',
  viewer: 'Can look at everything but cannot switch or change anything.',
}

export const STAGES = { draft: 'Being set up', bench_tested: 'Tested on the desk', installed: 'Installed', live: 'Live' }
export const ROOM_TYPES = { classroom: 'Classroom', office: 'Office', reception: 'Reception', staffroom: 'Staff room', other: 'Other' }
export const GROUP_TYPES = { lights: 'Lights', fans: 'Fans', mixed: 'Lights and fans', ac: 'AC', load: 'TV / smart board' }

export const COMMAND_RESULTS = {
  confirmed: { label: 'Done', tone: 'ok' },
  pending: { label: 'Waiting', tone: 'info' },
  not_confirmed: { label: 'No reply', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
  queued_offline: { label: 'Will apply when online', tone: 'warn' },
  superseded: { label: 'Replaced by newer', tone: 'neutral' },
}

export const ESP_NAMES = { esp32: 'ESP32', esp8266: 'NodeMCU' }

export const ALERT_LABELS = {
  offline: 'Offline',
  reboots: 'Restarting often',
  weak_wifi: 'Weak WiFi',
  never_seen: 'Never connected',
}
