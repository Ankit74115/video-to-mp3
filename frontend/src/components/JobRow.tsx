import type { Job } from '../api/types'
import { absoluteTime, relativeTime, stripExtension } from '../lib/format'
import { Button } from './Button'
import { FileGlyph } from './FileGlyph'
import { Icon } from './Icon'
import { StatusPill } from './StatusPill'

interface JobRowProps {
  job: Job
  downloading: boolean
  onDownload: (job: Job) => void
}

export function JobRow({ job, downloading, onDownload }: JobRowProps) {
  const done = job.status === 'done' && Boolean(job.mp3_fid)
  const tone = done ? 'moss' : job.status === 'failed' ? 'rose' : 'stone'

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FileGlyph filename={job.filename} tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink" title={job.filename}>
            {job.filename}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <time dateTime={job.created_at} title={absoluteTime(job.created_at)}>
              {relativeTime(job.created_at)}
            </time>
            {job.status === 'processing' && <span> · converting now</span>}
            {job.status === 'queued' && <span> · waiting for a worker</span>}
          </p>
          {job.status === 'failed' && job.error && (
            <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 font-mono text-xs break-words text-rose-700 ring-1 ring-rose-100 ring-inset">
              {job.error}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:justify-end sm:pl-0">
        <StatusPill status={job.status} />
        <Button
          variant={done ? 'secondary' : 'ghost'}
          size="sm"
          disabled={!done}
          loading={downloading}
          onClick={() => onDownload(job)}
          aria-label={`Download ${stripExtension(job.filename)}.mp3`}
          leadingIcon={<Icon name="download" className="size-4" />}
        >
          Download
        </Button>
      </div>
    </li>
  )
}
