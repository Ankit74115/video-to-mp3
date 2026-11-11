import type { ToastItem, ToastKind } from '../context/toast-context'
import { Icon, type IconName } from './Icon'

const STYLES: Record<ToastKind, { icon: IconName; iconClass: string; border: string }> = {
  success: { icon: 'check', iconClass: 'bg-moss-50 text-moss-700', border: 'border-moss-100' },
  info: { icon: 'download', iconClass: 'bg-butter-50 text-butter-700', border: 'border-butter-100' },
  error: { icon: 'alert', iconClass: 'bg-rose-50 text-rose-700', border: 'border-rose-100' },
}

export function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { icon, iconClass, border } = STYLES[toast.kind]
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`animate-rise pointer-events-auto flex items-start gap-3 rounded-2xl border bg-surface-raised p-4 shadow-float ${border}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        <Icon name={icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm break-words text-ink-muted">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-transform duration-300 ease-spring hover:scale-110 hover:text-ink active:scale-95"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  )
}
