import { badRequest, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    requestId?: number
    driverId?: number
    departureTime?: string
    managerNotes?: string
  }

  if (!body.requestId || !body.driverId || !body.departureTime) {
    return badRequest('Informe a solicitacao, o motorista e o horario de saida.')
  }

  const driver = await env.DB.prepare(
    `
      select
        id,
        name
      from drivers
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.driverId)
    .first<Record<string, unknown>>()

  if (!driver) {
    return notFound('Motorista nao encontrado.')
  }

  const travelRequest = await env.DB.prepare(
    `
      select
        id,
        protocol
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(body.requestId)
    .first<Record<string, unknown>>()

  if (!travelRequest) {
    return notFound('Solicitacao nao encontrada.')
  }

  await env.DB.prepare(
    `
      update travel_requests
      set assigned_driver_id = ?1,
          assigned_driver_name = ?2,
          departure_time = ?3,
          manager_notes = ?4,
          scheduled_at = current_timestamp,
          status = 'agendada',
          updated_at = current_timestamp
      where id = ?5
    `,
  )
    .bind(body.driverId, driver.name, body.departureTime, body.managerNotes ?? '', body.requestId)
    .run()

  await env.DB.prepare(
    `
      insert into request_status_history (
        travel_request_id,
        protocol,
        status,
        label,
        note,
        updated_by_operator_id,
        updated_at,
        sort_order
      )
      values (?1, ?2, 'agendada', 'Agendada', ?3, 2, datetime('now'), 99)
    `,
  )
    .bind(
      travelRequest.id,
      travelRequest.protocol,
      `Viagem direcionada para ${String(driver.name)} com saida prevista as ${body.departureTime}. ${body.managerNotes ?? ''}`.trim(),
    )
    .run()

  return ok({
    message: `Viagem atribuida para ${String(driver.name)} com sucesso.`,
  })
}
