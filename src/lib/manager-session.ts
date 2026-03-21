import type { AdminSession } from '../types'

const SESSION_KEY = 'transpsaude-manager-session'

export function getManagerSession() {
  const stored = window.localStorage.getItem(SESSION_KEY)

  if (!stored) {
    return null
  }

  try {
    const session = JSON.parse(stored) as AdminSession

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

export function saveManagerSession(session: AdminSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearManagerSession() {
  window.localStorage.removeItem(SESSION_KEY)
}
