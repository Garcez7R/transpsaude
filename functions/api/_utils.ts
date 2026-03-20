import { statusLabels } from './_data'

export interface Env {
  DB?: D1Database
}

function requireDb(env: Env) {
  if (!env.DB) {
    throw new Error('DB binding nao configurado.')
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

export async function listRequests(env: Env, status?: string) {
  const db = requireDb(env)

  let query = `
    select
      id,
      protocol,
      patient_name as patientName,
      cpf_masked as cpfMasked,
      access_cpf_masked as accessCpfMasked,
      destination_city as destinationCity,
      destination_state as destinationState,
      treatment_unit as treatmentUnit,
      specialty,
      travel_date as travelDate,
      requested_at as requestedAt,
      status,
      companion_required as companionRequired,
      companion_name as companionName,
      companion_cpf_masked as companionCpfMasked,
      companion_phone as companionPhone,
      companion_is_whatsapp as companionIsWhatsapp,
      companion_address_line as companionAddressLine,
      assigned_driver_id as assignedDriverId,
      assigned_driver_name as assignedDriverName,
      departure_time as departureTime,
      manager_notes as managerNotes,
      scheduled_at as scheduledAt,
      notes
    from travel_requests
  `

  const params: string[] = []

  if (status) {
    query += ' where status = ?1'
    params.push(status)
  }

  query += ' order by created_at desc'

  const prepared = db.prepare(query)
  const statement = params.length > 0 ? prepared.bind(...params) : prepared
  const result = await statement.all()

  return (result.results ?? []).map((item) => ({
    ...item,
    companionRequired: toBoolean(item.companionRequired),
    companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
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
        id,
        protocol,
        patient_name as patientName,
        cpf_masked as cpfMasked,
        destination_city as destinationCity,
        destination_state as destinationState,
        treatment_unit as treatmentUnit,
        specialty,
        travel_date as travelDate,
        requested_at as requestedAt,
        status,
        companion_required as companionRequired,
        notes
      from travel_requests
      where patient_id = ?1
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
      statusLabel: statusLabels[status as keyof typeof statusLabels] ?? status,
      loginHint:
        typeof requestResult.notes === 'string'
          ? requestResult.notes
          : 'Guarde seu CPF e seu PIN para futuras consultas.',
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
        id,
        name,
        cpf,
        phone,
        is_whatsapp as isWhatsapp,
        vehicle_name as vehicleName,
        active
      from drivers
      where active = 1
      order by name asc
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
        id,
        name,
        cpf,
        password,
        vehicle_name as vehicleName
      from drivers
      where cpf = ?1
        and active = 1
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

export async function listDriverTrips(env: Env, driverId: number) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        id,
        protocol,
        patient_name as patientName,
        cpf_masked as cpfMasked,
        access_cpf_masked as accessCpfMasked,
        destination_city as destinationCity,
        destination_state as destinationState,
        treatment_unit as treatmentUnit,
        specialty,
        travel_date as travelDate,
        requested_at as requestedAt,
        status,
        companion_required as companionRequired,
        companion_name as companionName,
        companion_cpf_masked as companionCpfMasked,
        companion_phone as companionPhone,
        companion_is_whatsapp as companionIsWhatsapp,
        companion_address_line as companionAddressLine,
        assigned_driver_id as assignedDriverId,
        assigned_driver_name as assignedDriverName,
        departure_time as departureTime,
        manager_notes as managerNotes,
        scheduled_at as scheduledAt,
        notes
      from travel_requests
      where assigned_driver_id = ?1
      order by travel_date asc, departure_time asc, created_at desc
    `,
  )
    .bind(driverId)
    .all()

  return (result.results ?? []).map((item) => ({
    ...item,
    companionRequired: toBoolean(item.companionRequired),
    companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
  }))
}
