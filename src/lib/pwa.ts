import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch((error) => {
        console.error('Falha ao registrar service worker', error)
      })
  })
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const syncInstalledState = () => {
      setIsInstalled(mediaQuery.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallEvent(event)
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallEvent(null)
    }

    syncInstalledState()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    mediaQuery.addEventListener('change', syncInstalledState)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener('change', syncInstalledState)
    }
  }, [])

  async function promptInstall() {
    if (!installEvent) {
      return false
    }

    await installEvent.prompt()
    const choice = await installEvent.userChoice

    if (choice.outcome === 'accepted') {
      setInstallEvent(null)
      return true
    }

    return false
  }

  return {
    canInstall: Boolean(installEvent) && !isInstalled,
    isInstalled,
    promptInstall,
  }
}
