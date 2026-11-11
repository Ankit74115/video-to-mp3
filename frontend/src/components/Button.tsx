import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leadingIcon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

// Only transform/opacity are transitioned. The hover tint is an ::after layer that fades in.
const BASE =
  'relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium whitespace-nowrap select-none ' +
  'transition-transform duration-300 ease-spring hover:-translate-y-px active:translate-y-0 active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  'after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:opacity-0 after:transition-opacity after:duration-300 after:ease-soft ' +
  'hover:after:opacity-100 active:after:opacity-100'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-moss-700 text-white shadow-moss after:bg-white/12',
  secondary: 'border border-line bg-surface-raised text-ink shadow-card after:bg-moss-50',
  ghost: 'text-ink-soft after:bg-ink/6',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[0.8125rem]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="size-4 shrink-0" /> : leadingIcon}
      {children}
    </button>
  )
}
