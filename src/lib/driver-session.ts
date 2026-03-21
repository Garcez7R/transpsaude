import type { DriverSession } from '../types'

const SESSION_KEY = 'transpsaude-driver-session'

export function getDriverSession() {
  const stored = window.localStorage.getItem(SESSION_KEY)

  if (!stored) {
    return null
  }

  try {
    const session = JSON.parse(stored) as DriverSession

    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY)
      return null
    }

    return session
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
