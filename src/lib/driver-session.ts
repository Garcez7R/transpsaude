import type { DriverSession } from '../types'

const SESSION_KEY = 'transpsaude-driver-session'

export function getDriverSession() {
  const stored = window.localStorage.getItem(SESSION_KEY)

  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as DriverSession
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveDriverSession(session: DriverSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearDriverSession() {
  window.localStorage.removeItem(SESSION_KEY)
}
