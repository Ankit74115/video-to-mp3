import { httpClient } from './http'
import { mockClient } from './mock'
import type { ApiClient } from './types'

// Compared against the inlined env string so the unused client is tree-shaken out of production builds.
export const api: ApiClient = import.meta.env.VITE_USE_MOCK_API === 'true' ? mockClient : httpClient
