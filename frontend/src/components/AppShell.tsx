import { useAuth } from '../hooks/useAuth'
import { Dashboard } from './Dashboard'
import { SignInPage } from './SignInPage'

export function AppShell() {
  const { session } = useAuth()
  return session ? <Dashboard key={session.token} /> : <SignInPage />
}
