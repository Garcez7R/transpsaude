import { badRequest, listDriverTrips, ok, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const driverId = Number(url.searchParams.get('driverId') ?? '')

  if (!Number.isFinite(driverId) || driverId <= 0) {
    return badRequest('Informe um motorista valido.')
  }

  const trips = await listDriverTrips(env, driverId)
  return ok(trips)
}
