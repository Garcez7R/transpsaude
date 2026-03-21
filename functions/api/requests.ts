import { forbidden, listRequests, ok, requireInternalRole, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para consultar solicitações.')
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? undefined
  const search = url.searchParams.get('search') ?? undefined
  const travelDate = url.searchParams.get('travelDate') ?? undefined
  const destination = url.searchParams.get('destination') ?? undefined
  const driverIdValue = Number(url.searchParams.get('driverId') ?? '')
  const requests = await listRequests(env, {
    status,
    search,
    travelDate,
    destination,
    driverId: Number.isFinite(driverIdValue) && driverIdValue > 0 ? driverIdValue : undefined,
  })
  return ok(requests)
}
