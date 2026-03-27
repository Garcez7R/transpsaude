import { useEffect, useRef } from 'react'
import { useAppToast, type AppToastType } from './app-toast'

export function useToastOnChange(message: string | null | undefined, type: AppToastType) {
  const { showToast } = useAppToast()
  const previousMessage = useRef<string | null>(null)

  useEffect(() => {
    const normalized = message?.trim() ?? ''

    if (!normalized) {
      previousMessage.current = null
      return
    }

    if (previousMessage.current === normalized) {
      return
    }

    previousMessage.current = normalized
    showToast({ type, message: normalized })
  }, [message, showToast, type])
}
