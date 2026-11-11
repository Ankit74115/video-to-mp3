import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { config } from '../api/config'
import { ApiError, type Job } from '../api/types'

export interface JobsState {
  /** null until the first successful load */
  jobs: Job[] | null
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
}

/** Polls GET /jobs every VITE_POLL_INTERVAL_MS while the tab is visible. */
export function useJobs(): JobsState {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const list = await api.listJobs()
      if (!mounted.current) return
      setJobs(list)
      setError(null)
    } catch (e) {
      if (!mounted.current) return
      // 401/403 already triggered a sign-out; nothing to show here.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return
      setError(e instanceof Error ? e.message : 'Could not load conversions.')
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    tick()
    const timer = setInterval(tick, config.pollIntervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      mounted.current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh])

  return { jobs, error, loading: jobs === null && error === null, refresh }
}
