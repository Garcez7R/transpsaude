import type { AdminSession } from '../types'

const SESSION_KEY = 'transpsaude-manager-session'

export function getManagerSession() {
  const stored = window.localStorage.getItem(SESSION_KEY)

  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as AdminSession
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
