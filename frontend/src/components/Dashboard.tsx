import { useCallback, useState } from 'react'
import { api } from '../api/client'
import type { Job, UploadResult } from '../api/types'
import { useAuth } from '../hooks/useAuth'
import { useJobs } from '../hooks/useJobs'
import { useToasts } from '../hooks/useToasts'
import { saveBlob } from '../lib/download'
import { stripExtension } from '../lib/format'
import { Header } from './Header'
import { JobsList } from './JobsList'
import { UploadDropzone } from './UploadDropzone'

export function Dashboard() {
  const { session } = useAuth()
  const { push } = useToasts()
  const { jobs, error, loading, refresh } = useJobs()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleUploaded = useCallback(
    (result: UploadResult) => {
      push('success', 'Upload complete', `${result.filename} is queued for conversion.`)
      void refresh()
    },
    [push, refresh],
  )

  const handleUploadError = useCallback(
    (message: string) => push('error', 'Upload failed', message),
    [push],
  )

  const handleDownload = useCallback(
    async (job: Job) => {
      if (!job.mp3_fid || downloadingId) return
      const filename = `${stripExtension(job.filename)}.mp3`
      setDownloadingId(job.id)
      try {
        const blob = await api.download(job.mp3_fid)
        saveBlob(blob, filename)
        push('info', 'Download started', filename)
      } catch (e) {
        push('error', 'Download failed', e instanceof Error ? e.message : undefined)
      } finally {
        setDownloadingId(null)
      }
    },
    [downloadingId, push],
  )

  const firstName = session?.email?.split('@')[0]

  return (
    <div className="relative min-h-dvh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="animate-fade-in mb-8 sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-moss-600 uppercase">
            {firstName ? `Welcome, ${firstName}` : 'Workspace'}
          </p>
          <h1 className="mt-2 text-[2.25rem] text-ink sm:text-[2.75rem]">Conversions</h1>
          <p className="mt-3 max-w-xl text-ink-muted">
            Drop in a video and we hand back the audio as an MP3. The list keeps itself up to date while this tab is open.
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <section aria-labelledby="upload-heading" className="animate-rise min-w-0 lg:sticky lg:top-24">
            <UploadDropzone onUploaded={handleUploaded} onUploadError={handleUploadError} />
          </section>
          <section aria-labelledby="jobs-heading" className="animate-rise min-w-0 [animation-delay:80ms]">
            <JobsList
              jobs={jobs}
              error={error}
              loading={loading}
              downloadingId={downloadingId}
              onDownload={handleDownload}
              onRetry={refresh}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
