import type { AdminSession } from '../types'

const SESSION_KEY = 'transpsaude-admin-session'

export function getAdminSession() {
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

export function saveAdminSession(session: AdminSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession() {
  window.localStorage.removeItem(SESSION_KEY)
}
