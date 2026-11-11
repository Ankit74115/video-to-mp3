import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { config } from '../api/config'

export type HealthStatus = 'checking' | 'online' | 'offline'

/** Pings GET /health every 30s (while visible). Never blocks the UI. */
export function useApiHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    let active = true
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const ok = await api.health()
      if (active) setStatus(ok ? 'online' : 'offline')
    }
    void check()
    const timer = setInterval(check, config.healthIntervalMs)
    document.addEventListener('visibilitychange', check)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  return status
}
