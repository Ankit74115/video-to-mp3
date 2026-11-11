import { fileExtension } from '../lib/format'

type Tone = 'moss' | 'stone' | 'rose'

const TONES: Record<Tone, string> = {
  moss: 'bg-moss-50 text-moss-700 ring-moss-100',
  stone: 'bg-stone-100 text-stone-700 ring-line',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
}

/** Small tile showing the file's extension; stands in for a thumbnail. */
export function FileGlyph({ filename, tone = 'stone' }: { filename: string; tone?: Tone }) {
  const ext = fileExtension(filename).slice(0, 4) || 'file'
  return (
    <span
      aria-hidden="true"
      className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[0.7rem] font-semibold tracking-wide uppercase ring-1 ring-inset ${TONES[tone]}`}
    >
      {ext}
    </span>
  )
}
