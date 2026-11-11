import { createContext } from 'react'

export type ToastKind = 'success' | 'info' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

export interface ToastContextValue {
  toasts: ToastItem[]
  push: (kind: ToastKind, title: string, description?: string) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
