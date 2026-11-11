/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_POLL_INTERVAL_MS?: string
  readonly VITE_MAX_UPLOAD_MB?: string
  readonly VITE_USE_MOCK_API?: string
}
