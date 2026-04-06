import { badRequest, ok, requireInternalRole, type Env, writeAuditLog } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return badRequest('Sessão interna inválida.')
  }

  const body = (await request.json()) as {
    vehicleId?: number
    entryType?: 'maintenance' | 'odometer' | 'fuel'
    odometerKm?: number
    liters?: number
    fuelType?: string
    maintenanceType?: string
    nextDueKm?: number
    travelRequestId?: number
    notes?: string
    recordedAt?: string
  }

  if (!body.vehicleId || !body.entryType || !Number.isFinite(body.odometerKm ?? NaN)) {
    return badRequest('Informe veículo, tipo de registro e quilometragem.')
  }

  if (body.entryType === 'fuel' && !Number.isFinite(body.liters ?? NaN)) {
    return badRequest('Informe a quantidade de litros abastecidos.')
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
        maintenance_type,
        next_due_km,
        notes,
        recorded_at
      )
      values (?1, null, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, coalesce(?10, current_timestamp))
    `,
  )
    .bind(
      body.vehicleId,
      body.travelRequestId ?? null,
      body.entryType,
      Math.round(Number(body.odometerKm)),
      body.liters ?? null,
      body.fuelType ?? null,
      body.maintenanceType ?? null,
      body.nextDueKm ?? null,
      body.notes ?? null,
      body.recordedAt ?? null,
    )
    .run()

  await writeAuditLog(env, session.operatorId, 'create', 'vehicle_log', String(body.vehicleId), {
    entryType: body.entryType,
    travelRequestId: body.travelRequestId ?? null,
    odometerKm: body.odometerKm,
    liters: body.liters,
    fuelType: body.fuelType,
    maintenanceType: body.maintenanceType,
    nextDueKm: body.nextDueKm,
    notes: body.notes,
  })

  return ok({ message: 'Registro do veículo salvo com sucesso.' })
}
