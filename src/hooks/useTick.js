import { useEffect, useState } from 'react'

// Re-render every few seconds so "x min ago" labels stay current.
export function useTick(ms = 10000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}
