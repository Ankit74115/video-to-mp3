const BARS = [20, 42, 64, 90, 56, 74, 36, 58, 28]

export function EmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div aria-hidden="true" className="flex h-12 items-end gap-1">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full ${i === 3 ? 'bg-peach-300' : 'bg-moss-200'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <h3 className="mt-6 text-xl text-ink">Nothing converted yet</h3>
      <p className="mt-2 max-w-xs text-sm text-ink-muted">
        Upload a video and it will appear here, moving from queued to done as the worker gets to it.
      </p>
    </div>
  )
}
