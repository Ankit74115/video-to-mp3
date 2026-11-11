interface ProgressBarProps {
  /** 0..1 */
  value: number
  label: string
}

/** Fill moves with translateX (not width) so only transform is ever transitioned. */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const pct = Math.round(clamped * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-paper-deep shadow-inset"
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-full bg-moss-600 transition-transform duration-300 ease-soft"
        style={{ transform: `translateX(${(clamped - 1) * 100}%)` }}
      >
        <div className="stripes-moss animate-stripes absolute inset-y-0 -left-6 w-[calc(100%+3rem)]" />
      </div>
    </div>
  )
}
