import { badRequest, forbidden, notFound, ok, requireInternalRole, type Env, writeAuditLog } from '../_utils'
import { statusLabels } from '../_data'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem atribuir motoristas.')
  }

  const body = (await request.json()) as {
    requestId?: number
    driverId?: number
    vehicleId?: number
    departureTime?: string
    managerNotes?: string
    useCustomBoardingLocation?: boolean
    boardingLocationName?: string
    showDriverPhoneToPatient?: boolean
  }

  if (!body.requestId || !body.driverId || !body.vehicleId || !body.departureTime) {
    return badRequest('Informe a solicitação, o motorista, o veículo e o horário de saída.')
  }

  if (body.useCustomBoardingLocation && !body.boardingLocationName) {
    return badRequest('Selecione um ponto oficial de embarque.')
  }

  const driver = await env.DB.prepare(
    `
      select
        id,
        name,
        phone
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

  const vehicle = await env.DB.prepare(
    `
      select
        id,
        name
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.vehicleId)
    .first<Record<string, unknown>>()

  if (!vehicle) {
    return notFound('Veículo não encontrado.')
  }

  const travelRequest = await env.DB.prepare(
    `
      select
        id,
        protocol,
        status
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

  try {
    await env.DB.prepare(
      `
        update travel_requests
        set assigned_driver_id = ?1,
            assigned_driver_name = ?2,
            assigned_driver_phone = ?3,
            show_driver_phone_to_patient = ?4,
            assigned_vehicle_id = ?5,
            assigned_vehicle_name = ?6,
            departure_time = ?7,
            manager_notes = ?8,
            use_custom_boarding_location = ?9,
            boarding_location_name = ?10,
            scheduled_at = current_timestamp,
            updated_at = current_timestamp
        where id = ?11
      `,
    )
      .bind(
        body.driverId,
        driver.name,
        driver.phone ?? '',
        body.showDriverPhoneToPatient === false ? 0 : 1,
        vehicle.id,
        vehicle.name,
        body.departureTime,
        body.managerNotes ?? '',
        body.useCustomBoardingLocation ? 1 : 0,
        body.useCustomBoardingLocation ? body.boardingLocationName ?? '' : '',
        body.requestId,
      )
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (
      !message.includes('no such column: assigned_driver_phone') &&
      !message.includes('no such column: show_driver_phone_to_patient') &&
      !message.includes('no such column: assigned_vehicle_id') &&
      !message.includes('no such column: assigned_vehicle_name')
    ) {
      throw error
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
  }

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
      values (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), 99)
    `,
  )
    .bind(
      travelRequest.id,
      travelRequest.protocol,
      String(travelRequest.status),
      statusLabels[String(travelRequest.status) as keyof typeof statusLabels] ?? String(travelRequest.status),
      `Viagem direcionada para ${String(driver.name)} com o veículo ${String(vehicle.name)} e saída prevista às ${body.departureTime}. ${body.managerNotes ?? ''}`.trim(),
      session.operatorId,
    )
    .run()

  await writeAuditLog(env, session.operatorId, 'assign', 'travel_request', String(body.requestId), {
    protocol: String(travelRequest.protocol),
    driverName: String(driver.name),
    driverPhone: String(driver.phone ?? ''),
    vehicleName: String(vehicle.name),
    departureTime: body.departureTime,
    boardingLocationName: body.useCustomBoardingLocation ? body.boardingLocationName ?? '' : 'endereco_paciente',
    showDriverPhoneToPatient: body.showDriverPhoneToPatient === false ? 0 : 1,
  })

  return ok({
    message: `Viagem atribuída para ${String(driver.name)} com o veículo ${String(vehicle.name)}.`,
  })
}
