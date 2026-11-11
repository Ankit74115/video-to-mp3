import { config } from '../api/config'
import type { Job } from '../api/types'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { JobRow } from './JobRow'

interface JobsListProps {
  jobs: Job[] | null
  error: string | null
  loading: boolean
  downloadingId: string | null
  onDownload: (job: Job) => void
  onRetry: () => void
}

export function JobsList({ jobs, error, loading, downloadingId, onDownload, onRetry }: JobsListProps) {
  const active = jobs?.filter((j) => j.status === 'queued' || j.status === 'processing').length ?? 0
  const seconds = Math.round(config.pollIntervalMs / 1000)

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-surface-raised/85 shadow-card backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <h2 id="jobs-heading" className="text-[1.375rem] text-ink">
            Recent
          </h2>
          {jobs && jobs.length > 0 && (
            <span className="rounded-full bg-paper-deep px-2.5 py-0.5 font-mono text-xs font-semibold text-ink-soft tabular-nums">
              {jobs.length}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {active > 0 ? (
            <>
              <span className="font-medium text-butter-700">{active} in progress</span> · refreshes every {seconds}s
            </>
          ) : (
            <>Refreshes every {seconds}s</>
          )}
        </p>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-5">
          <span className="flex items-center gap-2">
            <Icon name="alert" className="size-4 shrink-0" />
            {error}
          </span>
          <Button variant="secondary" size="sm" onClick={onRetry} leadingIcon={<Icon name="refresh" className="size-4" />}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <ul aria-label="Loading conversions" aria-busy="true" className="divide-y divide-line/70">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <span className="size-10 shrink-0 animate-pulse rounded-xl bg-paper-deep" />
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-2/3 animate-pulse rounded bg-paper-deep" />
                <span className="block h-2.5 w-1/4 animate-pulse rounded bg-paper-deep" />
              </span>
              <span className="h-6 w-20 animate-pulse rounded-full bg-paper-deep" />
            </li>
          ))}
        </ul>
      ) : jobs && jobs.length > 0 ? (
        <ul className="divide-y divide-line/70">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} downloading={downloadingId === job.id} onDownload={onDownload} />
          ))}
        </ul>
      ) : (
        !error && <EmptyState />
      )}
    </div>
  )
}
