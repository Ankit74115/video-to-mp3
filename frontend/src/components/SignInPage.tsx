import { useId, useState, type FormEvent } from 'react'
import { config } from '../api/config'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from './BrandMark'
import { Button } from './Button'
import { Icon } from './Icon'
import { TextField } from './TextField'

// Decorative waveform heights for the brand panel (static, aria-hidden).
const BARS = [18, 34, 52, 72, 46, 88, 60, 96, 40, 70, 30, 58, 84, 44, 66, 26, 50, 36, 20]

const MIN_PASSWORD = 8

type Mode = 'signin' | 'signup'

const COPY: Record<Mode, { heading: string; blurb: string; cta: string; busy: string }> = {
  signin: {
    heading: 'Sign in',
    blurb: 'Welcome back. Your conversions are waiting.',
    cta: 'Sign in',
    busy: 'Signing in…',
  },
  signup: {
    heading: 'Create your account',
    blurb: 'Free to use. Just an email and a password.',
    cta: 'Create account',
    busy: 'Creating account…',
  },
}

export function SignInPage() {
  const { signIn, signUp, notice } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingId = useId()

  const copy = COPY[mode]
  const isSignUp = mode === 'signup'

  const switchMode = () => {
    setMode(isSignUp ? 'signin' : 'signup')
    setError(null)
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    const trimmed = email.trim()
    if (!trimmed || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    if (isSignUp && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      if (isSignUp) await signUp(trimmed, password)
      else await signIn(trimmed, password)
    } catch (err) {
      const fallback = isSignUp ? 'Could not create your account. Please try again.' : 'Sign-in failed. Please try again.'
      setError(err instanceof Error ? err.message : fallback)
      setSubmitting(false)
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-16">
      <section className="animate-fade-in mb-10 lg:mb-0" aria-labelledby="brand-heading">
        <BrandMark size="lg" />
        <h1 id="brand-heading" className="mt-10 max-w-[12ch] text-[2.5rem] text-ink sm:text-[3.25rem] lg:text-[4rem]">
          Pull the sound out of any video.
        </h1>
        <p className="mt-5 max-w-md text-[1.05rem] text-ink-soft">
          Upload once. We transcode in the background and hand you a clean MP3 the moment it is ready.
        </p>
        <div aria-hidden="true" className="mt-10 hidden h-24 items-end gap-1.5 sm:flex lg:mt-14">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-2 rounded-full ${i % 5 === 3 ? 'bg-peach-500' : 'bg-moss-700'}`}
              style={{ height: `${h}%`, opacity: 0.55 + (h / 100) * 0.45 }}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={headingId} className="animate-rise w-full max-w-[26rem] lg:ml-auto">
        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-[1.75rem] border border-white/70 bg-surface-raised/90 p-6 shadow-float backdrop-blur sm:p-8"
        >
          <h2 id={headingId} className="text-[1.75rem] text-ink">
            {copy.heading}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{copy.blurb}</p>

          <div className="mt-7 flex flex-col gap-5">
            {notice && !isSignUp && (
              <p role="status" className="rounded-xl bg-butter-50 px-4 py-3 text-sm text-butter-700 ring-1 ring-butter-100 ring-inset">
                {notice}
              </p>
            )}
            <TextField
              id="email"
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              name="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              hint={isSignUp ? `At least ${MIN_PASSWORD} characters.` : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100 ring-inset">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
              {submitting ? copy.busy : copy.cta}
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={switchMode}
              disabled={submitting}
              className="rounded-sm font-medium text-moss-700 underline decoration-moss-200 decoration-2 underline-offset-[3px] transition-opacity duration-200 ease-soft hover:opacity-75 active:opacity-60 disabled:opacity-45"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
        {config.useMockApi && (
          <p className="mt-5 text-center text-xs text-balance text-ink-muted">
            Demo mode: any email and password signs you in (except “wrong”).
          </p>
        )}
      </section>
    </main>
  )
}
