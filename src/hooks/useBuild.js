import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const RUNNING_OTA = ['waiting_build', 'sent', 'downloading', 'started']

// Polls a firmware build (compile status, OTA progress) until it has finished.
export function useBuild(buildId) {
  const [build, setBuild] = useState(null)
  useEffect(() => {
    if (!buildId) return
    let stop = false
    let timer
    const poll = async () => {
      const b = await api(`/builds/${buildId}`).catch(() => null)
      if (stop) return
      if (b) setBuild(b)
      const done = b && ['ready', 'failed', 'none'].includes(b.compile?.status) && !RUNNING_OTA.includes(b.ota?.status)
      if (!done) timer = setTimeout(poll, 1500)
    }
    poll()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [buildId])
  return build
}
