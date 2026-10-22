// Who may do what (mirrors the server's role checks; the server always has the final say).

export const isAdmin = (user) => user?.role === 'admin'
export const isEditor = (user) => user?.role === 'admin' || user?.role === 'staff'

// Group / room switching for staff (optionally limited to some floors); floor / whole school for admins.
export function canControl(user, kind, floorId) {
  if (!user || user.role === 'viewer') return false
  if (user.role === 'admin') return true
  if (kind === 'floor' || kind === 'all') return false
  return !user.allowedFloors?.length || user.allowedFloors.includes(floorId)
}
