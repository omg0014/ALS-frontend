import { Boxes, CalendarClock, ChartColumn, CirclePlus, Code, Cpu, DoorOpen, House, LifeBuoy, Lightbulb, ScrollText, Settings, Users } from 'lucide-react'

// The sidebar menu. `roles` limits who sees an item; `exclude` keeps a parent link from lighting up on a child page.
export const NAVIGATION = [
  {
    title: 'Everyday',
    items: [
      { to: '/', label: 'Home', icon: House, end: true },
      { to: '/control', label: 'Lights & fans', icon: Lightbulb },
      { to: '/schedules', label: 'Schedules', icon: CalendarClock },
      { to: '/analytics', label: 'Analytics', icon: ChartColumn },
      { to: '/rooms', label: 'Rooms', icon: DoorOpen },
      { to: '/devices', label: 'Devices', icon: Cpu, exclude: ['/devices/new'] },
    ],
  },
  {
    title: 'Setup',
    items: [
      { to: '/devices/new', label: 'Add a device', icon: CirclePlus, roles: ['admin', 'staff'] },
      { to: '/hardware', label: 'Hardware types', icon: Boxes },
      { to: '/code', label: 'Code editor', icon: Code, roles: ['admin'] },
      { to: '/help', label: 'Help & guides', icon: LifeBuoy },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/activity', label: 'Activity log', icon: ScrollText },
      { to: '/users', label: 'Users', icon: Users, roles: ['admin'] },
      { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ],
  },
]
