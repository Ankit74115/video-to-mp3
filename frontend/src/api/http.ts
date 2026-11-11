import { config } from './config'
import { clearToken, notifyUnauthorized, readToken } from './token'
import { ApiError, type ApiClient, type Job, type UploadResult } from './types'

const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'

const url = (path: string) => `${config.apiBase}${path}`

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403
}

function signOutLocally(): void {
  clearToken()
  notifyUnauthorized()
}

function extractError(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error: unknown }).error
    if (typeof e === 'string' && e.trim()) return e
  }
  return null
}

async function errorFrom(res: Response, fallback: string): Promise<ApiError> {
  let message = fallback
  try {
    message = extractError(await res.json()) ?? fallback
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, message)
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken()
  if (!token) {
    signOutLocally()
    throw new ApiError(401, SESSION_EXPIRED)
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url(path), { ...init, headers })
  if (isAuthFailure(res.status)) {
    signOutLocally()
    throw new ApiError(res.status, SESSION_EXPIRED)
  }
  return res
}

export const httpClient: ApiClient = {
  async login(email, password) {
    const res = await fetch(url('/login'), {
      method: 'POST',
      headers: { Authorization: `Basic ${toBase64Utf8(`${email}:${password}`)}` },
    })
    if (res.status === 401) throw new ApiError(401, 'Invalid email or password.')
    if (!res.ok) throw await errorFrom(res, `Sign-in failed (${res.status}).`)
    const body = (await res.json()) as { token?: unknown }
    if (typeof body.token !== 'string' || !body.token) {
      throw new ApiError(502, 'The server did not return a token.')
    }
    return body.token
  },

  async register(email, password) {
    const res = await fetch(url('/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.status === 409) throw new ApiError(409, 'An account with that email already exists. Sign in instead.')
    if (!res.ok) throw await errorFrom(res, `Could not create your account (${res.status}).`)
    const body = (await res.json()) as { token?: unknown }
    if (typeof body.token !== 'string' || !body.token) {
      throw new ApiError(502, 'The server did not return a token.')
    }
    return body.token
  },

  async listJobs() {
    const res = await authedFetch('/jobs')
    if (!res.ok) throw await errorFrom(res, `Could not load conversions (${res.status}).`)
    const body = (await res.json()) as { jobs?: Job[] }
    return Array.isArray(body.jobs) ? body.jobs : []
  },

  async getJob(id) {
    const res = await authedFetch(`/jobs/${encodeURIComponent(id)}`)
    if (res.status === 404) throw new ApiError(404, 'That conversion no longer exists.')
    if (!res.ok) throw await errorFrom(res, `Could not load conversion (${res.status}).`)
    return (await res.json()) as Job
  },

  upload(file, onProgress) {
    const xhr = new XMLHttpRequest()
    const promise = new Promise<UploadResult>((resolve, reject) => {
      const token = readToken()
      if (!token) {
        signOutLocally()
        reject(new ApiError(401, SESSION_EXPIRED))
        return
      }
      xhr.open('POST', url('/upload'))
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.responseType = 'text'

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total)
      }
      xhr.onerror = () =>
        reject(new ApiError(0, 'Network error while uploading. Check your connection and try again.'))
      xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'))
      xhr.onload = () => {
        const { status } = xhr
        let body: unknown = null
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          /* non-JSON */
        }
        if (isAuthFailure(status)) {
          signOutLocally()
          reject(new ApiError(status, SESSION_EXPIRED))
        } else if (status === 413) {
          reject(new ApiError(413, extractError(body) ?? 'That file is larger than the server allows.'))
        } else if (status >= 200 && status < 300 && body && typeof body === 'object') {
          resolve(body as UploadResult)
        } else {
          reject(new ApiError(status, extractError(body) ?? `Upload failed (${status || 'no response'}).`))
        }
      }

      const form = new FormData()
      form.append('file', file, file.name)
      xhr.send(form)
    })
    return { promise, abort: () => xhr.abort() }
  },

  async download(mp3Fid) {
    const res = await authedFetch(`/download?fid=${encodeURIComponent(mp3Fid)}`)
    if (!res.ok) throw await errorFrom(res, `Download failed (${res.status}).`)
    return res.blob()
  },

  async health() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url('/health'), { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) return false
      const body = (await res.json()) as { status?: unknown }
      return body.status === 'ok'
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  },
}
