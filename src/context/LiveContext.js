import { createContext, useContext } from 'react'

// Live building data: { data, index, error, connected, cmds, refresh, recordCommands }. See LiveProvider.
export const LiveContext = createContext(null)
export const useLive = () => useContext(LiveContext)
