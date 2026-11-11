import type { JobStatus } from '../api/types'

const STYLES: Record<JobStatus, { label: string; pill: string; dot: string; pulse: boolean }> = {
  queued: { label: 'Queued', pill: 'bg-stone-100 text-stone-700 ring-stone-500/25', dot: 'bg-stone-500', pulse: false },
  processing: { label: 'Processing', pill: 'bg-butter-50 text-butter-700 ring-butter-500/35', dot: 'bg-butter-500', pulse: true },
  done: { label: 'Done', pill: 'bg-moss-50 text-moss-700 ring-moss-500/30', dot: 'bg-moss-500', pulse: false },
  failed: { label: 'Failed', pill: 'bg-rose-50 text-rose-700 ring-rose-500/30', dot: 'bg-rose-500', pulse: false },
}

export function StatusPill({ status }: { status: JobStatus }) {
  const { label, pill, dot, pulse } = STYLES[status]
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-semibold ring-1 ring-inset ${pill}`}>
      <span className="relative flex size-1.5">
        {pulse && <span className={`absolute inset-0 rounded-full ${dot} animate-pulse-dot`} />}
        <span className={`relative size-1.5 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  )
}
