import { createContext } from 'react'

export interface AuthSession {
  token: string
  email: string | null
  expiresAt: number | null
}

export interface AuthContextValue {
  session: AuthSession | null
  /** Why the user was signed out automatically (shown on the sign-in page). */
  notice: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
