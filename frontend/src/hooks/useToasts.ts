import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from '../context/toast-context'

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>')
  return ctx
}
