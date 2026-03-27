import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type AppToastType } from '../lib/app-toast'

interface ToastItem {
  id: number
  type: AppToastType
  message: string
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback((input: { type?: AppToastType; message: string }) => {
    const message = input.message.trim()

    if (!message) {
      return
    }

    const id = nextIdRef.current
    nextIdRef.current += 1

    setToasts((current) => [...current, { id, type: input.type ?? 'info', message }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id)
      }, 3200),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`app-toast ${toast.type}`} key={toast.id} role="status">
            <span className="app-toast-icon" aria-hidden="true">
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
