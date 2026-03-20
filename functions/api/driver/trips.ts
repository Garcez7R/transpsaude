import { badRequest, forbidden, listDriverTrips, ok, readDriverSession, requireInternalRole, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const driverId = Number(url.searchParams.get('driverId') ?? '')

  if (!Number.isFinite(driverId) || driverId <= 0) {
    return badRequest('Informe um motorista válido.')
  }

  const internalSession = await requireInternalRole(env, request, ['manager', 'admin'])
  const driverSession = await readDriverSession(env, request)

  if (!internalSession && (!driverSession || driverSession.driverId !== driverId)) {
    return forbidden('Acesso não autorizado às viagens do motorista.')
  }

  const trips = await listDriverTrips(env, driverId)
  return ok(trips)
}
