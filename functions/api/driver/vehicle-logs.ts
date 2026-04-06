import { badRequest, ok, readDriverSession, type Env, writeAuditLog } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await readDriverSession(env, request)

  if (!session) {
    return badRequest('Sessão do motorista inválida.')
  }

  const body = (await request.json()) as {
    odometerKm?: number
    liters?: number
    vehicleId?: number
    travelRequestId?: number
    fuelType?: string
    notes?: string
    recordedAt?: string
  }

  if (!Number.isFinite(body.odometerKm ?? NaN) || !Number.isFinite(body.liters ?? NaN)) {
    return badRequest('Informe quilometragem e litros abastecidos.')
  }

  const driver = await env.DB.prepare(
    `
      select id, vehicle_id as vehicleId
      from drivers
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(session.driverId)
    .first<Record<string, unknown>>()

  if (!driver) {
    return badRequest('Motorista não encontrado.')
  }

  let resolvedVehicleId = Number(body.vehicleId ?? '')
  const travelRequestId = Number(body.travelRequestId ?? '')

  if (Number.isFinite(travelRequestId) && travelRequestId > 0) {
    const trip = await env.DB.prepare(
      `
        select assigned_driver_id as driverId, assigned_vehicle_id as vehicleId
        from travel_requests
        where id = ?1
        limit 1
      `,
    )
      .bind(travelRequestId)
      .first<Record<string, unknown>>()

    const tripDriverId = Number(trip?.driverId ?? '')
    const tripVehicleId = Number(trip?.vehicleId ?? '')

    if (!trip || tripDriverId !== session.driverId) {
      return badRequest('Esta viagem não pertence ao motorista.')
    }

    if (Number.isFinite(tripVehicleId) && tripVehicleId > 0) {
      if (resolvedVehicleId && resolvedVehicleId !== tripVehicleId) {
        return badRequest('Veículo não corresponde ao registro da viagem.')
      }
      resolvedVehicleId = tripVehicleId
    }
  }

  if (!Number.isFinite(resolvedVehicleId) || resolvedVehicleId <= 0) {
    resolvedVehicleId = Number(driver.vehicleId ?? '')
  }

  if (!Number.isFinite(resolvedVehicleId) || resolvedVehicleId <= 0) {
    return badRequest('Veículo não definido para este motorista.')
  }

  if (Number.isFinite(resolvedVehicleId) && resolvedVehicleId > 0) {
    const exists = await env.DB.prepare(
      `
        select id
        from vehicles
        where id = ?1
          and active = 1
        limit 1
      `,
    )
      .bind(resolvedVehicleId)
      .first()

    if (!exists) {
      return badRequest('Veículo não encontrado.')
    }

    if (travelRequestId <= 0) {
      const hasTrip = await env.DB.prepare(
        `
          select count(*) as total
          from travel_requests
          where assigned_driver_id = ?1
            and assigned_vehicle_id = ?2
        `,
      )
        .bind(session.driverId, resolvedVehicleId)
        .first<Record<string, unknown>>()

      const driverVehicleId = Number(driver.vehicleId ?? '')
      if (Number(hasTrip?.total ?? 0) === 0 && driverVehicleId !== resolvedVehicleId) {
        return badRequest('Veículo não vinculado a viagens do motorista.')
      }
    }
  }

  await env.DB.prepare(
    `
      insert into vehicle_logs (
        vehicle_id,
        driver_id,
        travel_request_id,
        entry_type,
        odometer_km,
        liters,
        fuel_type,
        notes,
        recorded_at
      )
      values (?1, ?2, ?3, 'fuel', ?4, ?5, ?6, ?7, coalesce(?8, current_timestamp))
    `,
  )
    .bind(
      resolvedVehicleId,
      session.driverId,
      Number.isFinite(travelRequestId) && travelRequestId > 0 ? travelRequestId : null,
      Math.round(Number(body.odometerKm)),
      Number(body.liters),
      body.fuelType ?? null,
      body.notes ?? null,
      body.recordedAt ?? null,
    )
    .run()

  await writeAuditLog(env, null, 'driver_fuel_log', 'vehicle', String(resolvedVehicleId), {
    driverId: session.driverId,
    travelRequestId: Number.isFinite(travelRequestId) && travelRequestId > 0 ? travelRequestId : null,
    odometerKm: body.odometerKm,
    liters: body.liters,
    fuelType: body.fuelType,
    notes: body.notes,
  })

  return ok({ message: 'Abastecimento registrado com sucesso.' })
}
