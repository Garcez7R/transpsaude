import { badRequest, notFound, ok, requireInternalRole, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return badRequest('Sessão interna inválida.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um veículo válido.')
  }

  const vehicle = await env.DB.prepare(
    `
      select id, name, plate, category, active
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!vehicle) {
    return notFound('Veículo não encontrado.')
  }

  const fuelLogs = await env.DB.prepare(
    `
      select
        vl.id,
        vl.vehicle_id as vehicleId,
        vl.driver_id as driverId,
        d.name as driverName,
        vl.travel_request_id as travelRequestId,
        vl.entry_type as entryType,
        vl.odometer_km as odometerKm,
        vl.liters,
        vl.fuel_type as fuelType,
        vl.notes,
        vl.recorded_at as recordedAt
      from vehicle_logs vl
      left join drivers d on d.id = vl.driver_id
      where vl.vehicle_id = ?1
        and vl.entry_type = 'fuel'
      order by vl.recorded_at desc, vl.id desc
      limit 30
    `,
  )
    .bind(id)
    .all<Record<string, unknown>>()

  const maintenanceLogs = await env.DB.prepare(
    `
      select
        vl.id,
        vl.vehicle_id as vehicleId,
        vl.driver_id as driverId,
        d.name as driverName,
        vl.travel_request_id as travelRequestId,
        vl.entry_type as entryType,
        vl.odometer_km as odometerKm,
        vl.maintenance_type as maintenanceType,
        vl.next_due_km as nextDueKm,
        vl.notes,
        vl.recorded_at as recordedAt
      from vehicle_logs vl
      left join drivers d on d.id = vl.driver_id
      where vl.vehicle_id = ?1
        and vl.entry_type = 'maintenance'
      order by vl.recorded_at desc, vl.id desc
      limit 30
    `,
  )
    .bind(id)
    .all<Record<string, unknown>>()

  const odometerResult = await env.DB.prepare(
    `
      select max(odometer_km) as odometerKm
      from vehicle_logs
      where vehicle_id = ?1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  const lastFuelRows = await env.DB.prepare(
    `
      select odometer_km as odometerKm, liters, fuel_type as fuelType, recorded_at as recordedAt
      from vehicle_logs
      where vehicle_id = ?1
        and entry_type = 'fuel'
      order by recorded_at desc, id desc
      limit 2
    `,
  )
    .bind(id)
    .all<Record<string, unknown>>()

  const lastFuel = lastFuelRows.results?.[0] ?? null
  const previousFuel = lastFuelRows.results?.[1] ?? null

  let averageConsumptionKmPerLiter: number | null = null
  if (lastFuel && previousFuel && Number(lastFuel.liters) > 0) {
    const distance = Number(lastFuel.odometerKm ?? 0) - Number(previousFuel.odometerKm ?? 0)
    if (distance > 0) {
      averageConsumptionKmPerLiter = distance / Number(lastFuel.liters)
    }
  }

  const estimatedAutonomyKm =
    averageConsumptionKmPerLiter && lastFuel && Number(lastFuel.liters) > 0
      ? averageConsumptionKmPerLiter * Number(lastFuel.liters)
      : null

  const trips = await env.DB.prepare(
    `
      select
        tr.id,
        tr.travel_date as travelDate,
        tr.destination_city as destinationCity,
        tr.destination_state as destinationState,
        tr.assigned_driver_name as driverName
      from travel_requests tr
      where tr.assigned_vehicle_id = ?1
      order by tr.travel_date desc, tr.id desc
      limit 30
    `,
  )
    .bind(id)
    .all<Record<string, unknown>>()

  const driverTotals = await env.DB.prepare(
    `
      select
        coalesce(tr.assigned_driver_name, 'Não atribuído') as driverName,
        count(*) as totalTrips
      from travel_requests tr
      where tr.assigned_vehicle_id = ?1
      group by tr.assigned_driver_name
      order by totalTrips desc
    `,
  )
    .bind(id)
    .all<Record<string, unknown>>()

  return ok({
    vehicle: {
      ...vehicle,
      active: Boolean(vehicle.active),
    },
    summary: {
      lastOdometerKm: Number(odometerResult?.odometerKm ?? 0) || null,
      lastFuel,
      averageConsumptionKmPerLiter,
      estimatedAutonomyKm,
      lastMaintenance: maintenanceLogs.results?.[0] ?? null,
    },
    fuelLogs: fuelLogs.results ?? [],
    maintenanceLogs: maintenanceLogs.results ?? [],
    trips: trips.results ?? [],
    driverTotals: driverTotals.results ?? [],
  })
}
