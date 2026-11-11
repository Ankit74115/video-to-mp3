import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  error?: string
  hint?: string
}

export function TextField({ id, label, error, hint, className = '', ...rest }: TextFieldProps) {
  const describedBy = [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')

  const tone = error
    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15'
    : 'border-line hover:border-line-strong focus:border-moss-600 focus:ring-moss-600/15'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`h-12 w-full rounded-xl border bg-surface px-4 text-ink shadow-inset placeholder:text-ink-muted/70 focus:outline-none focus:ring-4 ${tone} ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}
