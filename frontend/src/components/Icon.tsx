import type { SVGProps } from 'react'

export type IconName =
  | 'upload'
  | 'download'
  | 'check'
  | 'alert'
  | 'info'
  | 'close'
  | 'film'
  | 'refresh'
  | 'logout'

const PATHS: Record<IconName, string> = {
  upload: 'M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  download: 'M12 4v12m0 0 4-4m-4 4-4-4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v4.5m0 3.5h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8h.01',
  close: 'M6 6l12 12M18 6 6 18',
  film: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm4-2v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
}

/** 24-grid stroke icon; sized via className (defaults to 1em). */
export function Icon({ name, className = 'size-[1em]', ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
