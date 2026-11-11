function positiveNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const config = {
  /** Base path the browser calls. The dev proxy / nginx forward it to the gateway. */
  apiBase: (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, ''),
  pollIntervalMs: positiveNumber(import.meta.env.VITE_POLL_INTERVAL_MS, 3000),
  maxUploadMb: positiveNumber(import.meta.env.VITE_MAX_UPLOAD_MB, 100),
  healthIntervalMs: 30_000,
  useMockApi: import.meta.env.VITE_USE_MOCK_API === 'true',
} as const

export const maxUploadBytes = config.maxUploadMb * 1024 * 1024
