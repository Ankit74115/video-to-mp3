import { AppShell } from './components/AppShell'
import { AuthProvider } from './components/AuthProvider'
import { Backdrop } from './components/Backdrop'
import { Toaster } from './components/Toaster'
import { ToastProvider } from './components/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Backdrop />
        <AppShell />
        <Toaster />
      </AuthProvider>
    </ToastProvider>
  )
}
