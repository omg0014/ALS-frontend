import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { api } from '../api/client.js'
import { buildIndex, chKey } from '../lib/status.js'
import { LiveContext } from './LiveContext.js'

// The backend's own address when the website is hosted elsewhere (Vercel → Render), set at build time.
// API calls still go to /api on the website's address (forwarded by Vercel, so the login cookie works);
// only the live-updates connection goes straight to the backend, with a short-lived token.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''

function connectLive() {
  if (!BACKEND_URL) return io({ withCredentials: true })
  return io(BACKEND_URL, {
    // Asked again before every (re)connect, because the token is only valid for 2 minutes
    auth: (cb) =>
      api('/auth/socket-token')
        .then(({ token }) => cb({ token }))
        .catch(() => cb({})),
  })
}

// Loads /overview once and keeps it current with Socket.IO pushes from the server.
export function LiveProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)
  const [cmds, setCmds] = useState({}) // latest command per relay channel

  const refresh = useCallback(async () => {
    try {
      setData(await api('/overview'))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const recordCommands = useCallback((list) => {
    setCmds((prev) => {
      const next = { ...prev }
      for (const c of list) {
        const key = chKey(c.deviceId, c.channel)
        const cur = next[key]
        // The device may confirm before the HTTP response arrives: never step back to "pending".
        if (cur?.cmdId === c.cmdId && cur.result !== 'pending' && c.result === 'pending') continue
        next[key] = c
      }
      return next
    })
  }, [])

  useEffect(() => {
    const socket = connectLive()
    let timer
    socket.on('connect', () => {
      setConnected(true)
      refresh()
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('device:state', (st) =>
      setData((d) => d && { ...d, devices: d.devices.map((x) => (x.deviceId === st.deviceId ? { ...x, state: st } : x)) })
    )
    socket.on('devices:changed', () => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 300)
    })
    socket.on('command', (c) => recordCommands([c]))
    return () => {
      clearTimeout(timer)
      socket.close()
    }
  }, [refresh, recordCommands])

  const index = useMemo(() => (data ? buildIndex(data) : null), [data])
  const value = useMemo(() => ({ data, index, error, connected, cmds, refresh, recordCommands }), [data, index, error, connected, cmds, refresh, recordCommands])
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
