import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { UploadHandle, UploadResult } from '../api/types'

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File; loaded: number; total: number }
  | { phase: 'success'; file: File; result: UploadResult }
  | { phase: 'error'; file: File; message: string }

interface UploadCallbacks {
  onSuccess?: (result: UploadResult, file: File) => void
  onError?: (message: string, file: File) => void
}

export function useUpload(callbacks: UploadCallbacks = {}) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const handle = useRef<UploadHandle | null>(null)
  const cancelled = useRef(false)
  const latest = useRef(callbacks)
  latest.current = callbacks

  const start = useCallback((file: File) => {
    if (handle.current) return
    cancelled.current = false
    setState({ phase: 'uploading', file, loaded: 0, total: file.size })

    const h = api.upload(file, (loaded, total) => {
      setState((s) => (s.phase === 'uploading' ? { ...s, loaded, total } : s))
    })
    handle.current = h

    h.promise
      .then((result) => {
        handle.current = null
        setState({ phase: 'success', file, result })
        latest.current.onSuccess?.(result, file)
      })
      .catch((e: unknown) => {
        handle.current = null
        if (cancelled.current) {
          setState({ phase: 'idle' })
          return
        }
        const message = e instanceof Error ? e.message : 'Upload failed.'
        setState({ phase: 'error', file, message })
        latest.current.onError?.(message, file)
      })
  }, [])

  const cancel = useCallback(() => {
    cancelled.current = true
    handle.current?.abort()
  }, [])

  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  // Abort an in-flight upload if the component unmounts (e.g. sign-out mid-upload).
  useEffect(() => () => handle.current?.abort(), [])

  return { state, start, cancel, reset }
}
