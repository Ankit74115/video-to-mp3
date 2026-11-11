/**
 * In-browser stand-in for the gateway. Enabled with VITE_USE_MOCK_API=true.
 * Sign in with any email and any password except "wrong".
 * Creating an account works for any email except ones starting with "taken".
 * Uploads whose filename contains "fail" end in the failed state.
 */
import { ApiError, type ApiClient, type Job, type UploadResult } from './types'

const SESSION_LENGTH_S = 60 * 60
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

let counter = 0
const nextId = (prefix: string) => `${prefix}-${(++counter).toString(36)}${Date.now().toString(36).slice(-4)}`

let jobs: Job[] = [
  {
    id: 'job-seed-1',
    filename: 'townhall-keynote-2026.mp4',
    status: 'queued',
    video_fid: 'vid-seed-1',
    mp3_fid: null,
    created_at: minutesAgo(0.3),
    updated_at: minutesAgo(0.3),
    error: null,
  },
  {
    id: 'job-seed-2',
    filename: 'podcast-ep-14-raw-cut.mov',
    status: 'processing',
    video_fid: 'vid-seed-2',
    mp3_fid: null,
    created_at: minutesAgo(4),
    updated_at: minutesAgo(1),
    error: null,
  },
  {
    id: 'job-seed-3',
    filename: 'lecture-07-signal-processing.mkv',
    status: 'done',
    video_fid: 'vid-seed-3',
    mp3_fid: 'mp3-seed-3',
    created_at: hoursAgo(2),
    updated_at: hoursAgo(1.9),
    error: null,
  },
  {
    id: 'job-seed-4',
    filename: 'screen-recording 2026-11-08 at 14.22.webm',
    status: 'failed',
    video_fid: 'vid-seed-4',
    mp3_fid: null,
    created_at: hoursAgo(26),
    updated_at: hoursAgo(25.9),
    error: 'ffmpeg: no audio stream found in input',
  },
  {
    id: 'job-seed-5',
    filename: 'interview_b-roll_final.mp4',
    status: 'done',
    video_fid: 'vid-seed-5',
    mp3_fid: 'mp3-seed-5',
    created_at: hoursAgo(49),
    updated_at: hoursAgo(48.8),
    error: null,
  },
]

function patch(id: string, changes: Partial<Job>): void {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...changes, updated_at: new Date().toISOString() } : j))
}

function schedule(id: string, toProcessingMs: number, toFinishedMs: number, shouldFail: boolean): void {
  setTimeout(() => patch(id, { status: 'processing' }), toProcessingMs)
  setTimeout(() => {
    if (shouldFail) patch(id, { status: 'failed', error: 'ffmpeg: no audio stream found in input' })
    else patch(id, { status: 'done', mp3_fid: `mp3-${id}` })
  }, toProcessingMs + toFinishedMs)
}

// Runs on first use (not at import) so the module stays side-effect free and tree-shakeable.
let seeded = false
function ensureSeeded(): void {
  if (seeded) return
  seeded = true
  // Let the seeded in-flight jobs finish on their own so the list visibly changes.
  schedule('job-seed-1', 12_000, 25_000, false)
  setTimeout(() => patch('job-seed-2', { status: 'done', mp3_fid: 'mp3-seed-2' }), 30_000)
}

const base64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function fakeJwt(email: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ sub: email, email, iat: now, exp: now + SESSION_LENGTH_S }))
  return `${header}.${payload}.mock-signature`
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const mockClient: ApiClient = {
  async login(email, password) {
    ensureSeeded()
    await wait(650)
    if (!email.includes('@') || !password || password === 'wrong') {
      throw new ApiError(401, 'Invalid email or password.')
    }
    return fakeJwt(email)
  },

  async register(email, password) {
    ensureSeeded()
    await wait(700)
    if (!email.includes('@')) throw new ApiError(400, 'Enter a valid email address.')
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.')
    if (email.toLowerCase().startsWith('taken')) {
      throw new ApiError(409, 'An account with that email already exists. Sign in instead.')
    }
    return fakeJwt(email)
  },

  async listJobs() {
    ensureSeeded()
    await wait(180)
    return [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async getJob(id) {
    await wait(120)
    const job = jobs.find((j) => j.id === id)
    if (!job) throw new ApiError(404, 'That conversion no longer exists.')
    return job
  },

  upload(file, onProgress) {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    let rejectFn: ((e: Error) => void) | undefined

    const promise = new Promise<UploadResult>((resolve, reject) => {
      rejectFn = reject
      const total = Math.max(file.size, 1)
      const steps = 24
      let step = 0
      timer = setInterval(() => {
        if (cancelled) return
        step += 1
        onProgress(Math.min(total, Math.round((total * step) / steps)), total)
        if (step >= steps) {
          clearInterval(timer)
          const job: Job = {
            id: nextId('job'),
            filename: file.name,
            status: 'queued',
            video_fid: nextId('vid'),
            mp3_fid: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error: null,
          }
          jobs = [job, ...jobs]
          schedule(job.id, 2_500, 5_000, /fail/i.test(file.name))
          resolve({ job_id: job.id, video_fid: job.video_fid, filename: job.filename, status: 'queued' })
        }
      }, 90)
    })

    return {
      promise,
      abort: () => {
        cancelled = true
        clearInterval(timer)
        rejectFn?.(new ApiError(0, 'Upload cancelled.'))
      },
    }
  },

  async download(mp3Fid) {
    await wait(500)
    if (!jobs.some((j) => j.mp3_fid === mp3Fid)) throw new ApiError(404, 'File not found.')
    // A tiny silent MP3 frame header so the saved file is recognisably audio/mpeg.
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64, ...new Array(412).fill(0)])
    return new Blob([bytes], { type: 'audio/mpeg' })
  },

  async health() {
    await wait(120)
    return true
  },
}
