import { useApiHealth } from '../hooks/useApiHealth'
import { useAuth } from '../hooks/useAuth'
import { ApiStatusDot } from './ApiStatusDot'
import { BrandMark } from './BrandMark'
import { Button } from './Button'
import { Icon } from './Icon'

export function Header() {
  const { session, signOut } = useAuth()
  const health = useApiHealth()
  const email = session?.email ?? 'Signed in'

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2 sm:gap-3">
          <ApiStatusDot status={health} />
          <span className="hidden max-w-[16rem] truncate text-sm text-ink-soft md:inline" title={email}>
            {email}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} leadingIcon={<Icon name="logout" className="size-4" />}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
