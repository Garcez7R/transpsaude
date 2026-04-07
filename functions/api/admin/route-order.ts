import { badRequest, forbidden, ok, requireInternalRole, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem consultar a ordem da rota.')
  }

  const url = new URL(request.url)
  const driverId = Number(url.searchParams.get('driverId') ?? '')
  const travelDate = url.searchParams.get('travelDate')?.trim() ?? ''

  if (!Number.isFinite(driverId) || driverId <= 0 || !travelDate) {
    return badRequest('Informe motorista e data para consultar a rota.')
  }

  const rows = await env.DB.prepare(
    `
      select request_id as requestId
      from route_orders
      where driver_id = ?1
        and travel_date = ?2
      order by position asc
    `,
  )
    .bind(driverId, travelDate)
    .all<Record<string, unknown>>()

  return ok({
    requestIds: (rows.results ?? []).map((row) => Number(row.requestId)),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem salvar a rota.')
  }

  const body = (await request.json()) as {
    driverId?: number
    travelDate?: string
    requestIds?: number[]
  }

  const driverId = Number(body.driverId ?? '')
  const travelDate = String(body.travelDate ?? '').trim()
  const requestIds = Array.isArray(body.requestIds) ? body.requestIds : []

  if (!Number.isFinite(driverId) || driverId <= 0 || !travelDate) {
    return badRequest('Informe motorista e data para salvar a rota.')
  }

  await env.DB.prepare(
    `
      delete from route_orders
      where driver_id = ?1
        and travel_date = ?2
    `,
  )
    .bind(driverId, travelDate)
    .run()

  for (let index = 0; index < requestIds.length; index += 1) {
    const requestId = Number(requestIds[index])
    if (!Number.isFinite(requestId) || requestId <= 0) {
      continue
    }
    await env.DB.prepare(
      `
        insert into route_orders (
          driver_id,
          travel_date,
          request_id,
          position,
          updated_at
        )
        values (?1, ?2, ?3, ?4, current_timestamp)
      `,
    )
      .bind(driverId, travelDate, requestId, index + 1)
      .run()
  }

  return ok({ message: 'Ordem da rota salva.' })
}
