import { statusLabels } from './_data'

export interface Env {
  DB?: D1Database
}

type InternalRole = 'operator' | 'manager' | 'admin'

function requireDb(env: Env) {
  if (!env.DB) {
    throw new Error('Binding do banco D1 não configurado.')
  }

  return env.DB
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function notFound(message: string) {
  return json({ message }, 404)
}

export function badRequest(message: string) {
  return json({ message }, 400)
}

export function forbidden(message: string) {
  return json({ message }, 403)
}

export function ok(data: unknown) {
  return json(data)
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

function maskCpf(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function isInternalRole(value: string): value is InternalRole {
  return value === 'operator' || value === 'manager' || value === 'admin'
}

export function readInternalSession(request: Request) {
  const role = request.headers.get('x-operator-role')?.trim() ?? ''
  const operatorId = Number(request.headers.get('x-operator-id') ?? '')
  const name = request.headers.get('x-operator-name')?.trim() ?? ''

  if (!isInternalRole(role) || !Number.isFinite(operatorId) || operatorId <= 0) {
    return null
  }

  return {
    operatorId,
    role,
    name,
  }
}

export function requireInternalRole(
  request: Request,
  allowedRoles: InternalRole[],
) {
  const session = readInternalSession(request)

  if (!session) {
    return null
  }

  if (!allowedRoles.includes(session.role)) {
    return null
  }

  return session
}

export function readDriverSession(request: Request) {
  const driverId = Number(request.headers.get('x-driver-id') ?? '')
  const name = request.headers.get('x-driver-name')?.trim() ?? ''

  if (!Number.isFinite(driverId) || driverId <= 0) {
    return null
  }

  return {
    driverId,
    name,
  }
}

async function getNextHistoryOrder(db: D1Database, requestId: number) {
  const orderResult = await db.prepare(
    `
      select coalesce(max(sort_order), 0) as maxSortOrder
      from request_status_history
      where travel_request_id = ?1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  return Number(orderResult?.maxSortOrder ?? 0) + 1
}

export async function listRequests(env: Env, status?: string) {
  const db = requireDb(env)

  let query = `
    select
      tr.id,
      tr.protocol,
      tr.patient_name as patientName,
      tr.cpf_masked as cpfMasked,
      p.phone,
      p.address_line as addressLine,
      tr.use_custom_boarding_location as useCustomBoardingLocation,
      tr.boarding_location_name as boardingLocationName,
      case
        when tr.use_custom_boarding_location = 1 and tr.boarding_location_name is not null and tr.boarding_location_name != ''
          then tr.boarding_location_name
        else p.address_line
      end as boardingLocationLabel,
      tr.access_cpf_masked as accessCpfMasked,
      tr.destination_city as destinationCity,
      tr.destination_state as destinationState,
      tr.treatment_unit as treatmentUnit,
      tr.specialty,
      tr.travel_date as travelDate,
      tr.requested_at as requestedAt,
      tr.status,
      tr.companion_required as companionRequired,
      tr.companion_name as companionName,
      tr.companion_cpf_masked as companionCpfMasked,
      tr.companion_phone as companionPhone,
      tr.companion_is_whatsapp as companionIsWhatsapp,
      tr.companion_address_line as companionAddressLine,
      tr.assigned_driver_id as assignedDriverId,
      tr.assigned_driver_name as assignedDriverName,
      tr.departure_time as departureTime,
      tr.manager_notes as managerNotes,
      tr.scheduled_at as scheduledAt,
      tr.notes
    from travel_requests tr
    inner join patients p on p.id = tr.patient_id
  `

  const params: string[] = []

  if (status) {
    query += ' where tr.status = ?1'
    params.push(status)
  }

  query += ' order by tr.created_at desc'

  const prepared = db.prepare(query)
  const statement = params.length > 0 ? prepared.bind(...params) : prepared
  const result = await statement.all()

  return (result.results ?? []).map((item) => ({
    ...item,
    companionRequired: toBoolean(item.companionRequired),
    companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
    useCustomBoardingLocation: toBoolean(item.useCustomBoardingLocation),
  })) as Array<Record<string, unknown>>
}

export async function getSummary(env: Env) {
  const requests = await listRequests(env)
  const totalRequests = requests.length
  const scheduledToday = requests.filter((item) => item.status === 'agendada').length
  const pendingDocuments = requests.filter((item) => item.status === 'aguardando_documentos').length
  const approvedRequests = requests.filter((item) =>
    item.status === 'aprovada' || item.status === 'agendada' || item.status === 'concluida'
  ).length

  return {
    totalRequests,
    scheduledToday,
    pendingDocuments,
    approvedRequests,
  }
}

export async function loginCitizen(env: Env, cpf: string, password: string) {
  const normalizedCpf = normalizeCpf(cpf)
  const db = requireDb(env)

  const patientAccess = await db.prepare(
    `
      select
        id,
        full_name as patientName,
        access_cpf_masked as cpfMasked,
        temporary_password as temporaryPassword,
        citizen_pin as citizenPin,
        must_change_pin as mustChangePin
      from patients
      where access_cpf = ?1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!patientAccess) {
    return null
  }

  const mustChangePin = toBoolean(patientAccess.mustChangePin)
  const temporaryPassword = String(patientAccess.temporaryPassword ?? '')
  const citizenPin = String(patientAccess.citizenPin ?? '')
  const passwordMatches = (mustChangePin && password === temporaryPassword) || password === citizenPin

  if (!passwordMatches) {
    return null
  }

  const requestResult = await db.prepare(
    `
      select
        tr.id,
        tr.protocol,
        tr.patient_name as patientName,
        tr.cpf_masked as cpfMasked,
        tr.access_cpf_masked as accessCpfMasked,
        p.address_line as addressLine,
        tr.use_custom_boarding_location as useCustomBoardingLocation,
        tr.boarding_location_name as boardingLocationName,
        case
          when tr.use_custom_boarding_location = 1 and tr.boarding_location_name is not null and tr.boarding_location_name != ''
            then tr.boarding_location_name
          else p.address_line
        end as boardingLocationLabel,
        tr.destination_city as destinationCity,
        tr.destination_state as destinationState,
        tr.treatment_unit as treatmentUnit,
        tr.specialty,
        tr.travel_date as travelDate,
        tr.requested_at as requestedAt,
        tr.status,
        tr.companion_required as companionRequired,
        tr.companion_name as companionName,
        tr.assigned_driver_name as assignedDriverName,
        tr.departure_time as departureTime,
        tr.notes
      from travel_requests tr
      inner join patients p on p.id = tr.patient_id
      where tr.patient_id = ?1
      order by created_at desc
      limit 1
    `,
  )
    .bind(patientAccess.id)
    .first<Record<string, unknown>>()

  if (!requestResult) {
    return {
      mustChangePin: mustChangePin && password === temporaryPassword,
      patientName: String(patientAccess.patientName ?? ''),
      cpfMasked: String(patientAccess.cpfMasked ?? ''),
      temporaryPasswordLabel: temporaryPassword,
      request: null,
    }
  }

  const historyResult = await db.prepare(
    `
      select
        status,
        label,
        updated_at as updatedAt,
        note
      from request_status_history
      where protocol = ?1
      order by sort_order asc, updated_at asc
    `,
  )
    .bind(requestResult.protocol)
    .all()

  const status = String(requestResult.status)

  await db.prepare(
    `
      update patients
      set last_login_at = current_timestamp,
          updated_at = current_timestamp
      where id = ?1
    `,
  )
    .bind(patientAccess.id)
    .run()

  return {
    mustChangePin: mustChangePin && password === temporaryPassword,
    patientName: String(patientAccess.patientName ?? ''),
    cpfMasked: String(patientAccess.cpfMasked ?? ''),
    temporaryPasswordLabel: temporaryPassword,
    request: {
      ...requestResult,
      companionRequired: toBoolean(requestResult.companionRequired),
      useCustomBoardingLocation: toBoolean(requestResult.useCustomBoardingLocation),
      statusLabel: statusLabels[status as keyof typeof statusLabels] ?? status,
      loginHint:
        typeof requestResult.notes === 'string'
          ? requestResult.notes
          : 'Guarde seu CPF e seu PIN para consultas futuras.',
      history: historyResult.results ?? [],
    },
  }
}

export async function activateCitizenPin(env: Env, cpf: string, newPin: string) {
  if (!/^\d{4}$/.test(newPin)) {
    return null
  }

  const normalizedCpf = normalizeCpf(cpf)
  const db = requireDb(env)

  const patient = await db.prepare(
    `
      select id
      from patients
      where access_cpf = ?1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!patient) {
    return null
  }

  await db.prepare(
    `
      update patients
      set citizen_pin = ?1,
          must_change_pin = 0,
          access_activated_at = coalesce(access_activated_at, current_timestamp),
          last_login_at = current_timestamp,
          updated_at = current_timestamp
      where id = ?2
    `,
  )
    .bind(newPin, patient.id)
    .run()

  return loginCitizen(env, cpf, newPin)
}

export async function listDrivers(env: Env) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        d.id,
        d.name,
        d.cpf,
        d.phone,
        d.is_whatsapp as isWhatsapp,
        d.vehicle_id as vehicleId,
        coalesce(v.name, d.vehicle_name) as vehicleName,
        d.active
      from drivers d
      left join vehicles v on v.id = d.vehicle_id
      where d.active = 1
      order by d.name asc
    `,
  ).all()

  return (result.results ?? []).map((driver) => ({
    ...driver,
    cpfMasked: typeof driver.cpf === 'string' ? maskCpf(driver.cpf) : '',
    isWhatsapp: toBoolean(driver.isWhatsapp),
    active: toBoolean(driver.active),
  }))
}

export async function loginDriver(env: Env, cpf: string, password: string) {
  const normalizedCpf = normalizeCpf(cpf)
  const db = requireDb(env)

  const driver = await db.prepare(
    `
      select
        d.id,
        d.name,
        d.cpf,
        d.password,
        coalesce(v.name, d.vehicle_name) as vehicleName
      from drivers d
      left join vehicles v on v.id = d.vehicle_id
      where d.cpf = ?1
        and d.active = 1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!driver || String(driver.password ?? '') !== password) {
    return null
  }

  return {
    driverId: driver.id,
    name: String(driver.name ?? ''),
    cpf: maskCpf(String(driver.cpf ?? '')),
    vehicleName: String(driver.vehicleName ?? ''),
  }
}

export async function listVehicles(env: Env) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        id,
        name,
        plate,
        category,
        active
      from vehicles
      where active = 1
      order by name asc
    `,
  ).all()

  return (result.results ?? []).map((vehicle) => ({
    ...vehicle,
    active: toBoolean(vehicle.active),
  }))
}

export async function listDriverTrips(env: Env, driverId: number) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        tr.id,
        tr.protocol,
        tr.patient_name as patientName,
        tr.cpf_masked as cpfMasked,
        p.phone,
        p.address_line as addressLine,
        tr.use_custom_boarding_location as useCustomBoardingLocation,
        tr.boarding_location_name as boardingLocationName,
        case
          when tr.use_custom_boarding_location = 1 and tr.boarding_location_name is not null and tr.boarding_location_name != ''
            then tr.boarding_location_name
          else p.address_line
        end as boardingLocationLabel,
        tr.access_cpf_masked as accessCpfMasked,
        tr.destination_city as destinationCity,
        tr.destination_state as destinationState,
        tr.treatment_unit as treatmentUnit,
        tr.specialty,
        tr.travel_date as travelDate,
        tr.requested_at as requestedAt,
        tr.status,
        tr.companion_required as companionRequired,
        tr.companion_name as companionName,
        tr.companion_cpf_masked as companionCpfMasked,
        tr.companion_phone as companionPhone,
        tr.companion_is_whatsapp as companionIsWhatsapp,
        tr.companion_address_line as companionAddressLine,
        tr.assigned_driver_id as assignedDriverId,
        tr.assigned_driver_name as assignedDriverName,
        tr.departure_time as departureTime,
        tr.manager_notes as managerNotes,
        tr.scheduled_at as scheduledAt,
        tr.notes
      from travel_requests tr
      inner join patients p on p.id = tr.patient_id
      where tr.assigned_driver_id = ?1
      order by travel_date asc, departure_time asc, created_at desc
    `,
  )
    .bind(driverId)
    .all()

  return (result.results ?? []).map((item) => ({
    ...item,
    companionRequired: toBoolean(item.companionRequired),
    companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
    useCustomBoardingLocation: toBoolean(item.useCustomBoardingLocation),
  }))
}

export async function getRequestDetails(env: Env, requestId: number) {
  const db = requireDb(env)
  const request = await db.prepare(
    `
      select
        tr.id,
        tr.protocol,
        tr.patient_name as patientName,
        tr.cpf_masked as cpfMasked,
        tr.access_cpf_masked as accessCpfMasked,
        p.cpf_masked as patientCpf,
        p.phone,
        p.is_whatsapp as isWhatsapp,
        p.address_line as addressLine,
        tr.use_custom_boarding_location as useCustomBoardingLocation,
        tr.boarding_location_name as boardingLocationName,
        case
          when tr.use_custom_boarding_location = 1 and tr.boarding_location_name is not null and tr.boarding_location_name != ''
            then tr.boarding_location_name
          else p.address_line
        end as boardingLocationLabel,
        p.cns,
        p.responsible_name as responsibleName,
        p.responsible_cpf_masked as responsibleCpfMasked,
        p.use_responsible_cpf_for_access as useResponsibleCpfForAccess,
        tr.destination_city as destinationCity,
        tr.destination_state as destinationState,
        tr.treatment_unit as treatmentUnit,
        tr.specialty,
        tr.travel_date as travelDate,
        tr.requested_at as requestedAt,
        tr.status,
        tr.companion_required as companionRequired,
        tr.companion_name as companionName,
        tr.companion_cpf_masked as companionCpfMasked,
        tr.companion_phone as companionPhone,
        tr.companion_is_whatsapp as companionIsWhatsapp,
        tr.companion_address_line as companionAddressLine,
        tr.assigned_driver_id as assignedDriverId,
        tr.assigned_driver_name as assignedDriverName,
        tr.departure_time as departureTime,
        tr.manager_notes as managerNotes,
        tr.scheduled_at as scheduledAt,
        tr.notes
      from travel_requests tr
      inner join patients p on p.id = tr.patient_id
      where tr.id = ?1
      limit 1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  if (!request) {
    return null
  }

  const historyResult = await db.prepare(
    `
      select
        status,
        label,
        updated_at as updatedAt,
        note
      from request_status_history
      where travel_request_id = ?1
      order by sort_order asc, updated_at asc
    `,
  )
    .bind(requestId)
    .all()

  return {
    ...request,
    isWhatsapp: toBoolean(request.isWhatsapp),
    useResponsibleCpfForAccess: toBoolean(request.useResponsibleCpfForAccess),
    companionRequired: toBoolean(request.companionRequired),
    companionIsWhatsapp: toBoolean(request.companionIsWhatsapp),
    useCustomBoardingLocation: toBoolean(request.useCustomBoardingLocation),
    history: historyResult.results ?? [],
  }
}

export async function updateRequestStatus(
  env: Env,
  requestId: number,
  status: string,
  note: string,
  operatorId = 1,
) {
  const db = requireDb(env)
  const request = await db.prepare(
    `
      select
        id,
        protocol
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  if (!request) {
    return null
  }

  await db.prepare(
    `
      update travel_requests
      set status = ?1,
          updated_at = current_timestamp
      where id = ?2
    `,
  )
    .bind(status, requestId)
    .run()

  const nextOrder = await getNextHistoryOrder(db, requestId)
  const label = statusLabels[status as keyof typeof statusLabels] ?? status

  await db.prepare(
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
      values (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), ?7)
    `,
  )
    .bind(requestId, request.protocol, status, label, note, operatorId, nextOrder)
    .run()

  return {
    message: `Status atualizado para ${label}.`,
  }
}

export async function updateRequestSchedule(
  env: Env,
  requestId: number,
  travelDate: string,
  departureTime: string,
  note: string,
  operatorId = 1,
) {
  const db = requireDb(env)
  const request = await db.prepare(
    `
      select
        id,
        protocol
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  if (!request) {
    return null
  }

  await db.prepare(
    `
      update travel_requests
      set travel_date = ?1,
          departure_time = ?2,
          updated_at = current_timestamp
      where id = ?3
    `,
  )
    .bind(travelDate, departureTime, requestId)
    .run()

  const nextOrder = await getNextHistoryOrder(db, requestId)
  const noteText = note?.trim()
    ? `Viagem reagendada para ${travelDate} as ${departureTime}. ${note.trim()}`
    : `Viagem reagendada para ${travelDate} as ${departureTime}.`

  await db.prepare(
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
      values (?1, ?2, 'agendada', 'Agendada', ?3, ?4, datetime('now'), ?5)
    `,
  )
    .bind(requestId, request.protocol, noteText, operatorId, nextOrder)
    .run()

  return {
    message: `Viagem reagendada para ${travelDate} as ${departureTime}.`,
  }
}
