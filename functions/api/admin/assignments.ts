import { badRequest, forbidden, notFound, ok, requireInternalRole, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem atribuir motoristas.')
  }

  const body = (await request.json()) as {
    requestId?: number
    driverId?: number
    departureTime?: string
    managerNotes?: string
    useCustomBoardingLocation?: boolean
    boardingLocationName?: string
  }

  if (!body.requestId || !body.driverId || !body.departureTime) {
    return badRequest('Informe a solicitação, o motorista e o horário de saída.')
  }

  if (body.useCustomBoardingLocation && !body.boardingLocationName) {
    return badRequest('Selecione um ponto oficial de embarque.')
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
    return notFound('Motorista não encontrado.')
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
    return notFound('Solicitação não encontrada.')
  }

  await env.DB.prepare(
    `
      update travel_requests
      set assigned_driver_id = ?1,
          assigned_driver_name = ?2,
          departure_time = ?3,
          manager_notes = ?4,
          use_custom_boarding_location = ?5,
          boarding_location_name = ?6,
          scheduled_at = current_timestamp,
          status = 'agendada',
          updated_at = current_timestamp
      where id = ?7
    `,
  )
    .bind(
      body.driverId,
      driver.name,
      body.departureTime,
      body.managerNotes ?? '',
      body.useCustomBoardingLocation ? 1 : 0,
      body.useCustomBoardingLocation ? body.boardingLocationName ?? '' : '',
      body.requestId,
    )
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
      values (?1, ?2, 'agendada', 'Agendada', ?3, ?4, datetime('now'), 99)
    `,
  )
    .bind(
      travelRequest.id,
      travelRequest.protocol,
      `Viagem direcionada para ${String(driver.name)} com saída prevista às ${body.departureTime}. ${body.managerNotes ?? ''}`.trim(),
      session.operatorId,
    )
    .run()

  return ok({
    message: `Viagem atribuida para ${String(driver.name)} com sucesso.`,
  })
}
