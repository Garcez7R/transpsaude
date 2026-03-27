import { createContext, useContext } from 'react'

export type AppToastType = 'success' | 'error' | 'info'

export interface ToastContextValue {
  showToast: (input: { type?: AppToastType; message: string }) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useAppToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useAppToast deve ser usado dentro de AppToastProvider.')
  }

  return context
}
