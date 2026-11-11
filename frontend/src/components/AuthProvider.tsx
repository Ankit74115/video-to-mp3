import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { TOKEN_KEY, UNAUTHORIZED_EVENT, clearToken, readToken, writeToken } from '../api/token'
import { ApiError } from '../api/types'
import { AuthContext, type AuthSession } from '../context/auth-context'
import { decodeJwt, isExpired } from '../lib/jwt'

const EXPIRED_NOTICE = 'Your session has expired. Please sign in again.'
const MAX_TIMEOUT_MS = 2_147_483_647

function sessionFromToken(token: string): AuthSession | null {
  const claims = decodeJwt(token)
  if (!claims || isExpired(claims)) return null
  return { token, email: claims.email, expiresAt: claims.expiresAt }
}

function restoreSession(): AuthSession | null {
  const token = readToken()
  if (!token) return null
  const session = sessionFromToken(token)
  if (!session) clearToken()
  return session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(restoreSession)
  const [notice, setNotice] = useState<string | null>(null)

  const signOut = useCallback((reason: string | null = null) => {
    clearToken()
    setSession(null)
    setNotice(reason)
  }, [])

  const adoptToken = useCallback((token: string) => {
    const next = sessionFromToken(token)
    if (!next) throw new ApiError(502, 'The server returned an unusable token.')
    writeToken(token)
    setNotice(null)
    setSession(next)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => adoptToken(await api.login(email, password)),
    [adoptToken],
  )

  const signUp = useCallback(
    async (email: string, password: string) => adoptToken(await api.register(email, password)),
    [adoptToken],
  )

  // The API layer reports 401/403; another tab clearing the token also signs this one out.
  useEffect(() => {
    const onUnauthorized = () => signOut(EXPIRED_NOTICE)
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && !e.newValue) signOut(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      window.removeEventListener('storage', onStorage)
    }
  }, [signOut])

  // Auto sign-out the moment `exp` passes.
  useEffect(() => {
    if (!session?.expiresAt) return
    const delay = Math.min(Math.max(session.expiresAt - Date.now(), 0), MAX_TIMEOUT_MS)
    const timer = setTimeout(() => signOut(EXPIRED_NOTICE), delay)
    return () => clearTimeout(timer)
  }, [session, signOut])

  const value = useMemo(
    () => ({ session, notice, signIn, signUp, signOut: () => signOut(null) }),
    [session, notice, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
