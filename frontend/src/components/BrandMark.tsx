interface BrandMarkProps {
  size?: 'md' | 'lg'
}

export function BrandMark({ size = 'md' }: BrandMarkProps) {
  const mark = size === 'lg' ? 'size-12 rounded-2xl' : 'size-9 rounded-xl'
  const word = size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`${mark} grid shrink-0 place-items-center bg-moss-700 text-paper shadow-moss`} aria-hidden="true">
        <svg viewBox="0 0 32 32" className="size-[70%]" fill="none">
          <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M7 13v6" />
            <path d="M11.5 10v12" />
            <path d="M16 6v20" />
            <path d="M20.5 11v10" />
            <path d="M25 14v4" />
          </g>
          <circle cx="24.5" cy="7.5" r="3.4" className="fill-peach-500" />
        </svg>
      </span>
      <span className={`font-display ${word} leading-none font-semibold tracking-[-0.03em] text-ink`}>
        Track<span className="font-medium text-peach-600">bay</span>
      </span>
    </span>
  )
}
