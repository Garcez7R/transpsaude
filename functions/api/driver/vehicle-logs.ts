import { badRequest, ok, readDriverSession, type Env, writeAuditLog } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await readDriverSession(env, request)

  if (!session) {
    return badRequest('Sessão do motorista inválida.')
  }

  const body = (await request.json()) as {
    odometerKm?: number
    liters?: number
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

  const vehicleId = Number(driver?.vehicleId ?? '')

  if (!driver || !Number.isFinite(vehicleId) || vehicleId <= 0) {
    return badRequest('Veículo não definido para este motorista.')
  }

  await env.DB.prepare(
    `
      insert into vehicle_logs (
        vehicle_id,
        driver_id,
        entry_type,
        odometer_km,
        liters,
        fuel_type,
        notes,
        recorded_at
      )
      values (?1, ?2, 'fuel', ?3, ?4, ?5, ?6, coalesce(?7, current_timestamp))
    `,
  )
    .bind(
      vehicleId,
      session.driverId,
      Math.round(Number(body.odometerKm)),
      Number(body.liters),
      body.fuelType ?? null,
      body.notes ?? null,
      body.recordedAt ?? null,
    )
    .run()

  await writeAuditLog(env, null, 'driver_fuel_log', 'vehicle', String(vehicleId), {
    driverId: session.driverId,
    odometerKm: body.odometerKm,
    liters: body.liters,
    fuelType: body.fuelType,
    notes: body.notes,
  })

  return ok({ message: 'Abastecimento registrado com sucesso.' })
}
