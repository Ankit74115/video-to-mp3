export type JobStatus = 'queued' | 'processing' | 'done' | 'failed'

export interface Job {
  id: string
  filename: string
  status: JobStatus
  video_fid: string
  mp3_fid: string | null
  created_at: string
  updated_at: string
  error: string | null
}

export interface UploadResult {
  job_id: string
  video_fid: string
  filename: string
  status: JobStatus
}

export type UploadProgress = (loaded: number, total: number) => void

export interface UploadHandle {
  promise: Promise<UploadResult>
  abort: () => void
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiClient {
  /** Resolves with the raw JWT. Rejects with ApiError(401) on bad credentials. */
  login(email: string, password: string): Promise<string>
  /** Creates an account and resolves with a JWT. Rejects with ApiError(409) if the email is taken. */
  register(email: string, password: string): Promise<string>
  listJobs(): Promise<Job[]>
  getJob(id: string): Promise<Job>
  upload(file: File, onProgress: UploadProgress): UploadHandle
  download(mp3Fid: string): Promise<Blob>
  /** Never throws; false when the gateway is unreachable or unhealthy. */
  health(): Promise<boolean>
}
