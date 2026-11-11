import type { HealthStatus } from '../hooks/useApiHealth'

const STYLES: Record<HealthStatus, { dot: string; label: string; pulse: boolean }> = {
  checking: { dot: 'bg-stone-500', label: 'Checking API', pulse: true },
  online: { dot: 'bg-moss-500', label: 'API online', pulse: true },
  offline: { dot: 'bg-rose-500', label: 'API offline', pulse: false },
}

export function ApiStatusDot({ status }: { status: HealthStatus }) {
  const { dot, label, pulse } = STYLES[status]
  return (
    <span
      role="status"
      title={label}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface-raised/70 px-2.5 text-xs font-medium text-ink-soft sm:pr-3"
    >
      <span className="relative flex size-2">
        {pulse && <span className={`absolute inset-0 rounded-full ${dot} animate-pulse-dot`} />}
        <span className={`relative size-2 rounded-full ${dot}`} />
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  )
}
