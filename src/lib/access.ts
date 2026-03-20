import type { AdminSession, InternalRole } from '../types'

export function canAccessOperator(session: AdminSession | null) {
  return Boolean(session && ['operator', 'manager', 'admin'].includes(session.role))
}

export function canAccessManager(session: AdminSession | null) {
  return Boolean(session && ['manager', 'admin'].includes(session.role))
}

export function canAccessEverything(session: AdminSession | null) {
  return canAccessManager(session)
}

export function canAccessAdmin(session: AdminSession | null) {
  return Boolean(session && session.role === 'admin')
}

export function getInternalRoleLabel(role: InternalRole) {
  if (role === 'admin') {
    return 'administrador'
  }

  if (role === 'manager') {
    return 'gerente'
  }

  return 'operador'
}

export function isValidInternalRole(role: string): role is InternalRole {
  return role === 'operator' || role === 'manager' || role === 'admin'
}
