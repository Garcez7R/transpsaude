import { statusLabels } from './_data'

export interface Env {
  DB?: D1Database
}

type InternalRole = 'operator' | 'manager' | 'admin'
type SessionType = 'internal' | 'driver'

export interface RequestFilters {
  status?: string
  search?: string
  travelDate?: string
  dateFrom?: string
  dateTo?: string
  driverId?: number
  destination?: string
}

const textEncoder = new TextEncoder()
const INTERNAL_SESSION_DURATION_MS = 12 * 60 * 60 * 1000
const DRIVER_SESSION_DURATION_MS = 24 * 60 * 60 * 1000
export const DEFAULT_FIRST_ACCESS_PASSWORD = '0000'

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

export function serverError(message: string) {
  return json({ message }, 500)
}

export function ok(data: unknown) {
  return json(data)
}

function toSqliteDate(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export function maskCpf(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function hasMissingBoardingColumns(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('no such column: tr.use_custom_boarding_location') ||
    message.includes('no such column: tr.boarding_location_name')
  )
}

function hasMissingAssignmentColumns(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('no such column: tr.assigned_driver_phone') ||
    message.includes('no such column: tr.show_driver_phone_to_patient') ||
    message.includes('no such column: tr.assigned_vehicle_id') ||
    message.includes('no such column: tr.assigned_vehicle_name')
  )
}

function hasMissingPatientConfirmationColumn(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message.includes('no such column: tr.patient_confirmed_at') || message.includes('no such column: patient_confirmed_at')
}

function hasMissingPatientViewColumns(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('no such column: tr.patient_last_viewed_at') ||
    message.includes('no such column: tr.patient_last_message_seen_at') ||
    message.includes('no such column: patient_last_viewed_at') ||
    message.includes('no such column: patient_last_message_seen_at')
  )
}

function hasMissingOperatorPatientMessageSeenColumn(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return (
    message.includes('no such column: tr.operator_last_patient_message_seen_at') ||
    message.includes('no such column: operator_last_patient_message_seen_at')
  )
}

function hasMissingAppointmentTimeColumn(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message.includes('no such column: tr.appointment_time') || message.includes('no such column: appointment_time')
}

function hasMissingMessageRoleColumn(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message.includes('no such column: rm.created_by_role') || message.includes('no such column: created_by_role')
}

export async function listRequestMessages(env: Env, requestId: number, visibleToCitizenOnly = false) {
  const db = requireDb(env)
  let query = `
    select
      id,
      message_type as messageType,
      title,
      body,
      visible_to_citizen as visibleToCitizen,
      created_by_name as createdByName,
      created_by_role as createdByRole,
      created_at as createdAt
    from request_messages
    where travel_request_id = ?1
  `

  if (visibleToCitizenOnly) {
    query += ` and visible_to_citizen = 1`
  }

  query += ' order by created_at desc, id desc'

  try {
    const result = await db.prepare(query).bind(requestId).all()

    return (result.results ?? []).map((item) => ({
      ...item,
      visibleToCitizen: toBoolean(item.visibleToCitizen),
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (message.includes('no such table: request_messages')) {
      return []
    }

    if (!message.includes('no such column: created_by_role')) {
      throw error
    }

    const legacyResult = await db.prepare(
      `
        select
          id,
          message_type as messageType,
          title,
          body,
          visible_to_citizen as visibleToCitizen,
          created_by_name as createdByName,
          'operator' as createdByRole,
          created_at as createdAt
        from request_messages
        where travel_request_id = ?1
        ${visibleToCitizenOnly ? 'and visible_to_citizen = 1' : ''}
        order by created_at desc, id desc
      `,
    )
      .bind(requestId)
      .all()

    return (legacyResult.results ?? []).map((item) => ({
      ...item,
      visibleToCitizen: toBoolean(item.visibleToCitizen),
    }))
  }
}

function isInternalRole(value: string): value is InternalRole {
  return value === 'operator' || value === 'manager' || value === 'admin'
}

function toBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let result = 0

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return result === 0
}

async function deriveSecretHash(secret: string, saltBase64: string, iterations: number) {
  const salt = fromBase64(saltBase64)
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  )

  return toBase64(new Uint8Array(bits))
}

async function deriveFastSecretHash(secret: string, saltBase64: string) {
  const payload = textEncoder.encode(`${saltBase64}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', payload)
  return toBase64(new Uint8Array(digest))
}

export async function createSecretHash(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltBase64 = toBase64(salt)
  const digest = await deriveFastSecretHash(secret, saltBase64)

  return `sha256$${saltBase64}$${digest}`
}

export async function verifySecretHash(secret: string, storedHash: string) {
  const [algorithm, part2, part3, part4] = storedHash.split('$')

  if (algorithm === 'sha256') {
    if (!part2 || !part3) {
      return false
    }

    const calculated = await deriveFastSecretHash(secret, part2)
    return timingSafeEqual(calculated, part3)
  }

  if (algorithm === 'pbkdf2') {
    if (!part2 || !part3 || !part4) {
      return false
    }

    const iterations = Number(part2)

    if (!Number.isFinite(iterations) || iterations <= 0) {
      return false
    }

    const calculated = await deriveSecretHash(secret, part3, iterations)
    return timingSafeEqual(calculated, part4)
  }

  return false
}

async function verifySecretWithFallback(options: {
  secret: string
  storedHash?: string | null
  legacySecret?: string | null
}) {
  if (options.storedHash) {
    const matchesHash = await verifySecretHash(options.secret, options.storedHash)
    const shouldUpgrade = matchesHash && options.storedHash.startsWith('pbkdf2$')
    return { matches: matchesHash, shouldUpgrade }
  }

  const legacySecret = String(options.legacySecret ?? '')
  const matchesLegacy = legacySecret !== '' && timingSafeEqual(options.secret, legacySecret)

  return {
    matches: matchesLegacy,
    shouldUpgrade: matchesLegacy,
  }
}

async function touchSession(db: D1Database, token: string, sessionType: SessionType) {
  const expiresAt = toSqliteDate(
    new Date(Date.now() + (sessionType === 'internal' ? INTERNAL_SESSION_DURATION_MS : DRIVER_SESSION_DURATION_MS)),
  )

  await db.prepare(
    `
      update auth_sessions
      set last_used_at = current_timestamp,
          expires_at = ?2
      where token = ?1
    `,
  )
    .bind(token, expiresAt)
    .run()

  return expiresAt
}

export async function closeSession(env: Env, token: string) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      update auth_sessions
      set active = 0,
          last_used_at = current_timestamp
      where token = ?1
        and active = 1
    `,
  )
    .bind(token)
    .run()

  return Number(result.meta.changes ?? 0) > 0
}

export async function createSession(
  env: Env,
  params:
    | { sessionType: 'internal'; operatorId: number; role: InternalRole; name: string }
    | { sessionType: 'driver'; driverId: number; name: string },
) {
  const db = requireDb(env)
  const token = crypto.randomUUID()
  const expiresAt = toSqliteDate(
    new Date(Date.now() + (params.sessionType === 'internal' ? INTERNAL_SESSION_DURATION_MS : DRIVER_SESSION_DURATION_MS)),
  )

  if (params.sessionType === 'internal') {
    await db.prepare(
      `
        insert into auth_sessions (
          token,
          session_type,
          operator_id,
          role,
          name,
          active,
          expires_at,
          last_used_at
        )
        values (?1, 'internal', ?2, ?3, ?4, 1, ?5, current_timestamp)
      `,
    )
      .bind(token, params.operatorId, params.role, params.name, expiresAt)
      .run()

    return { token, expiresAt }
  }

  await db.prepare(
    `
      insert into auth_sessions (
        token,
        session_type,
        driver_id,
        name,
        active,
        expires_at,
        last_used_at
      )
      values (?1, 'driver', ?2, ?3, 1, ?4, current_timestamp)
    `,
  )
    .bind(token, params.driverId, params.name, expiresAt)
    .run()

  return { token, expiresAt }
}

export async function writeAuditLog(
  env: Env,
  operatorId: number | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  const db = requireDb(env)
  const serializedMetadata = metadata ? JSON.stringify(metadata) : null

  try {
    await db.prepare(
      `
        insert into audit_logs (
          operator_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        values (?1, ?2, ?3, ?4, ?5)
      `,
    )
      .bind(operatorId, action, entityType, entityId, serializedMetadata)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (
      message.includes('no such table: audit_logs') ||
      message.includes('no such column:') ||
      message.includes('NOT NULL constraint failed') ||
      message.includes('CHECK constraint failed')
    ) {
      return
    }

    throw error
  }
}

export async function requireInternalRole(
  env: Env,
  request: Request,
  allowedRoles: InternalRole[],
) {
  const token = request.headers.get('x-session-token')?.trim() ?? ''

  if (!token) {
    return null
  }

  const db = requireDb(env)
  const session = await db.prepare(
    `
      select
        token,
        operator_id as operatorId,
        role,
        name
      from auth_sessions
      where token = ?1
        and session_type = 'internal'
        and active = 1
        and (expires_at is null or expires_at > current_timestamp)
      limit 1
    `,
  )
    .bind(token)
    .first<Record<string, unknown>>()

  if (!session || !isInternalRole(String(session.role ?? ''))) {
    return null
  }

  const role = String(session.role) as InternalRole
  const operatorId = Number(session.operatorId ?? '')

  if (!allowedRoles.includes(role) || !Number.isFinite(operatorId) || operatorId <= 0) {
    return null
  }

  const expiresAt = await touchSession(db, token, 'internal')

  return {
    token,
    operatorId,
    role,
    name: String(session.name ?? ''),
    expiresAt,
  }
}

export async function readDriverSession(env: Env, request: Request) {
  const token = request.headers.get('x-session-token')?.trim() ?? ''

  if (!token) {
    return null
  }

  const db = requireDb(env)
  const session = await db.prepare(
    `
      select
        token,
        driver_id as driverId,
        name
      from auth_sessions
      where token = ?1
        and session_type = 'driver'
        and active = 1
        and (expires_at is null or expires_at > current_timestamp)
      limit 1
    `,
  )
    .bind(token)
    .first<Record<string, unknown>>()

  const driverId = Number(session?.driverId ?? '')

  if (!session || !Number.isFinite(driverId) || driverId <= 0) {
    return null
  }

  const expiresAt = await touchSession(db, token, 'driver')

  return {
    token,
    driverId,
    name: String(session.name ?? ''),
    expiresAt,
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

export async function listRequests(env: Env, filters: RequestFilters = {}) {
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
      tr.appointment_time as appointmentTime,
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
      tr.assigned_driver_phone as assignedDriverPhone,
      tr.show_driver_phone_to_patient as showDriverPhoneToPatient,
      tr.assigned_vehicle_id as assignedVehicleId,
      tr.assigned_vehicle_name as assignedVehicleName,
      tr.patient_confirmed_at as patientConfirmedAt,
      tr.patient_last_viewed_at as patientLastViewedAt,
      tr.patient_last_message_seen_at as patientLastMessageSeenAt,
      tr.operator_last_patient_message_seen_at as operatorLastPatientMessageSeenAt,
      (
        select count(*)
        from request_messages rm
        where rm.travel_request_id = tr.id
          and rm.created_by_role = 'patient'
      ) as patientMessageCount,
      (
        select max(rm.created_at)
        from request_messages rm
        where rm.travel_request_id = tr.id
          and rm.created_by_role = 'patient'
      ) as latestPatientMessageAt,
      tr.departure_time as departureTime,
      tr.manager_notes as managerNotes,
      tr.scheduled_at as scheduledAt,
      tr.notes
    from travel_requests tr
    inner join patients p on p.id = tr.patient_id
  `

  const legacyQuery = `
    select
      tr.id,
      tr.protocol,
      tr.patient_name as patientName,
      tr.cpf_masked as cpfMasked,
      p.phone,
      p.address_line as addressLine,
      0 as useCustomBoardingLocation,
      '' as boardingLocationName,
      p.address_line as boardingLocationLabel,
      tr.access_cpf_masked as accessCpfMasked,
      tr.destination_city as destinationCity,
      tr.destination_state as destinationState,
      tr.treatment_unit as treatmentUnit,
      tr.specialty,
      tr.travel_date as travelDate,
      '' as appointmentTime,
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
      '' as assignedDriverPhone,
      1 as showDriverPhoneToPatient,
      null as assignedVehicleId,
      '' as assignedVehicleName,
      null as patientConfirmedAt,
      null as patientLastViewedAt,
      null as patientLastMessageSeenAt,
      null as operatorLastPatientMessageSeenAt,
      0 as patientMessageCount,
      null as latestPatientMessageAt,
      tr.departure_time as departureTime,
      tr.manager_notes as managerNotes,
      tr.scheduled_at as scheduledAt,
      tr.notes
    from travel_requests tr
    inner join patients p on p.id = tr.patient_id
  `

  const whereClauses: string[] = []
  const params: Array<string | number> = []

  if (filters.status) {
    whereClauses.push(`tr.status = ?${params.length + 1}`)
    params.push(filters.status)
  }

  if (filters.travelDate) {
    whereClauses.push(`tr.travel_date = ?${params.length + 1}`)
    params.push(filters.travelDate)
  }

  if (filters.dateFrom) {
    whereClauses.push(`tr.travel_date >= ?${params.length + 1}`)
    params.push(filters.dateFrom)
  }

  if (filters.dateTo) {
    whereClauses.push(`tr.travel_date <= ?${params.length + 1}`)
    params.push(filters.dateTo)
  }

  if (filters.driverId && Number.isFinite(filters.driverId) && filters.driverId > 0) {
    whereClauses.push(`tr.assigned_driver_id = ?${params.length + 1}`)
    params.push(filters.driverId)
  }

  if (filters.destination?.trim()) {
    whereClauses.push(`lower(tr.destination_city) like ?${params.length + 1}`)
    params.push(`%${filters.destination.trim().toLowerCase()}%`)
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim()
    const normalizedDigits = search.replace(/\D/g, '')

    if (normalizedDigits.length >= 3) {
      whereClauses.push(
        `(replace(replace(replace(tr.cpf_masked, '.', ''), '-', ''), ' ', '') like ?${params.length + 1}
          or replace(replace(replace(tr.access_cpf_masked, '.', ''), '-', ''), ' ', '') like ?${params.length + 2}
          or replace(replace(replace(p.cpf_masked, '.', ''), '-', ''), ' ', '') like ?${params.length + 3}
          or replace(replace(replace(p.access_cpf_masked, '.', ''), '-', ''), ' ', '') like ?${params.length + 4})`,
      )
      const digitsPattern = `%${normalizedDigits}%`
      params.push(digitsPattern, digitsPattern, digitsPattern, digitsPattern)
    } else {
      const likeValue = `%${search.toLowerCase()}%`
      whereClauses.push(
        `(lower(tr.protocol) like ?${params.length + 1}
          or lower(tr.patient_name) like ?${params.length + 2}
          or lower(tr.destination_city) like ?${params.length + 3}
          or lower(tr.treatment_unit) like ?${params.length + 4}
          or lower(coalesce(tr.assigned_driver_name, '')) like ?${params.length + 5})`,
      )
      params.push(likeValue, likeValue, likeValue, likeValue, likeValue)
    }
  }

  if (whereClauses.length > 0) {
    query += ` where ${whereClauses.join(' and ')}`
  }

  query += ' order by tr.created_at desc'

  let result: D1Result<Record<string, unknown>>

  try {
    const prepared = db.prepare(query)
    const statement = params.length > 0 ? prepared.bind(...params) : prepared
    result = await statement.all()
  } catch (error) {
    if (!(hasMissingBoardingColumns(error) || hasMissingAssignmentColumns(error) || hasMissingPatientConfirmationColumn(error) || hasMissingPatientViewColumns(error) || hasMissingAppointmentTimeColumn(error) || hasMissingMessageRoleColumn(error) || hasMissingOperatorPatientMessageSeenColumn(error))) {
      throw error
    }

    let fallback = legacyQuery

    if (whereClauses.length > 0) {
      fallback += ` where ${whereClauses.join(' and ')}`
    }

    fallback += ' order by tr.created_at desc'

    const prepared = db.prepare(fallback)
    const statement = params.length > 0 ? prepared.bind(...params) : prepared
    result = await statement.all()
  }

  return (result.results ?? []).map((item) => ({
    ...item,
    companionRequired: toBoolean(item.companionRequired),
    companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
    useCustomBoardingLocation: toBoolean(item.useCustomBoardingLocation),
    showDriverPhoneToPatient: toBoolean(item.showDriverPhoneToPatient),
    hasUnreadPatientMessage:
      Number(item.patientMessageCount ?? 0) > 0 &&
      (!item.operatorLastPatientMessageSeenAt ||
        (String(item.latestPatientMessageAt ?? '') !== '' &&
          String(item.latestPatientMessageAt ?? '') > String(item.operatorLastPatientMessageSeenAt ?? ''))),
  })) as Array<Record<string, unknown>>
}

export async function getSummary(env: Env) {
  const requests = await listRequests(env)
  const totalRequests = requests.length
  const today = new Date().toISOString().slice(0, 10)
  const scheduledToday = requests.filter((item) => item.status === 'agendada' && item.travelDate === today).length
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

  const patientAccessRows = await db.prepare(
    `
      select
        id,
        full_name as patientName,
        access_cpf_masked as cpfMasked,
        temporary_password as temporaryPassword,
        temporary_password_hash as temporaryPasswordHash,
        citizen_pin as citizenPin,
        citizen_pin_hash as citizenPinHash,
        must_change_pin as mustChangePin
      from patients
      where access_cpf = ?1
        and active = 1
      order by coalesce(updated_at, created_at) desc, id desc
    `,
  )
    .bind(normalizedCpf)
    .all<Record<string, unknown>>()

  const patientAccessList = patientAccessRows.results ?? []

  if (patientAccessList.length === 0) {
    return null
  }

  let patientAccess: Record<string, unknown> | null = null
  let temporaryMatch = { matches: false, shouldUpgrade: false }
  let pinMatch = { matches: false, shouldUpgrade: false }
  let mustChangePin = false

  for (const candidate of patientAccessList) {
    const candidateMustChangePin = toBoolean(candidate.mustChangePin)
    const candidateTemporaryPassword = String(candidate.temporaryPassword ?? '')
    const candidateTemporaryPasswordHash = String(candidate.temporaryPasswordHash ?? '')
    const candidateCitizenPin = String(candidate.citizenPin ?? '')
    const candidateCitizenPinHash = String(candidate.citizenPinHash ?? '')
    const candidateTemporaryMatch = candidateMustChangePin
      ? await verifySecretWithFallback({
          secret: password,
          storedHash: candidateTemporaryPasswordHash,
          legacySecret: candidateTemporaryPassword,
        })
      : { matches: false, shouldUpgrade: false }
    const candidatePinMatch = await verifySecretWithFallback({
      secret: password,
      storedHash: candidateCitizenPinHash,
      legacySecret: candidateCitizenPin,
    })

    if (candidateTemporaryMatch.matches || candidatePinMatch.matches) {
      patientAccess = candidate
      temporaryMatch = candidateTemporaryMatch
      pinMatch = candidatePinMatch
      mustChangePin = candidateMustChangePin
      break
    }
  }

  if (!patientAccess) {
    return null
  }

  const patientIds = patientAccessList
    .map((item) => Number(item.id ?? ''))
    .filter((value, index, array) => Number.isFinite(value) && value > 0 && array.indexOf(value) === index)

  const requestPlaceholders = patientIds.map((_, index) => `?${index + 1}`).join(', ')

  if (temporaryMatch.shouldUpgrade) {
    await db.prepare(
      `
        update patients
        set temporary_password_hash = ?1,
            temporary_password = '',
            updated_at = current_timestamp
        where access_cpf = ?2
          and active = 1
      `,
    )
      .bind(await createSecretHash(password), normalizedCpf)
      .run()
  }

  if (pinMatch.shouldUpgrade) {
    await db.prepare(
      `
        update patients
        set citizen_pin_hash = ?1,
            citizen_pin = '',
            updated_at = current_timestamp
        where access_cpf = ?2
          and active = 1
      `,
    )
      .bind(await createSecretHash(password), normalizedCpf)
      .run()
  }

  let requestRows: D1Result<Record<string, unknown>>

  try {
    requestRows = await db.prepare(
      `
      select
        tr.id,
        tr.protocol,
        tr.patient_id as patientId,
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
        tr.appointment_time as appointmentTime,
        tr.requested_at as requestedAt,
        tr.status,
        tr.companion_required as companionRequired,
        tr.companion_name as companionName,
        tr.assigned_driver_name as assignedDriverName,
        tr.assigned_driver_phone as assignedDriverPhone,
        tr.show_driver_phone_to_patient as showDriverPhoneToPatient,
        tr.assigned_vehicle_id as assignedVehicleId,
        tr.assigned_vehicle_name as assignedVehicleName,
        tr.patient_confirmed_at as patientConfirmedAt,
        tr.patient_last_viewed_at as patientLastViewedAt,
        tr.patient_last_message_seen_at as patientLastMessageSeenAt,
        tr.departure_time as departureTime,
        tr.notes
      from travel_requests tr
      inner join patients p on p.id = tr.patient_id
      where tr.patient_id in (${requestPlaceholders})
      order by tr.travel_date desc, tr.created_at desc, tr.id desc
    `,
    )
      .bind(...patientIds)
      .all<Record<string, unknown>>()
  } catch (error) {
    if (!(hasMissingBoardingColumns(error) || hasMissingAssignmentColumns(error) || hasMissingPatientConfirmationColumn(error) || hasMissingPatientViewColumns(error) || hasMissingAppointmentTimeColumn(error))) {
      throw error
    }

    requestRows = await db.prepare(
      `
        select
          tr.id,
          tr.protocol,
          tr.patient_id as patientId,
          tr.patient_name as patientName,
          tr.cpf_masked as cpfMasked,
          tr.access_cpf_masked as accessCpfMasked,
          p.address_line as addressLine,
          0 as useCustomBoardingLocation,
          '' as boardingLocationName,
          p.address_line as boardingLocationLabel,
          tr.destination_city as destinationCity,
          tr.destination_state as destinationState,
          tr.treatment_unit as treatmentUnit,
          tr.specialty,
          tr.travel_date as travelDate,
          '' as appointmentTime,
          tr.requested_at as requestedAt,
          tr.status,
          tr.companion_required as companionRequired,
          tr.companion_name as companionName,
          tr.assigned_driver_name as assignedDriverName,
          '' as assignedDriverPhone,
          1 as showDriverPhoneToPatient,
          null as assignedVehicleId,
          '' as assignedVehicleName,
          null as patientConfirmedAt,
          null as patientLastViewedAt,
          null as patientLastMessageSeenAt,
          tr.departure_time as departureTime,
          tr.notes
        from travel_requests tr
        inner join patients p on p.id = tr.patient_id
        where tr.patient_id in (${requestPlaceholders})
        order by tr.travel_date desc, tr.created_at desc, tr.id desc
      `,
    )
      .bind(...patientIds)
      .all<Record<string, unknown>>()
  }

  const requestResults = requestRows.results ?? []

  if (requestResults.length === 0) {
    return {
      mustChangePin: mustChangePin && temporaryMatch.matches,
      patientName: String(patientAccess.patientName ?? ''),
      cpfMasked: String(patientAccess.cpfMasked ?? ''),
      temporaryPasswordLabel: DEFAULT_FIRST_ACCESS_PASSWORD,
      request: null,
      requests: [],
    }
  }

  const requests = await Promise.all(
    requestResults.map(async (requestResult) => {
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

      const requestMessages = await listRequestMessages(env, Number(requestResult.id), true)
      const status = String(requestResult.status)

      return {
        ...requestResult,
        companionRequired: toBoolean(requestResult.companionRequired),
        useCustomBoardingLocation: toBoolean(requestResult.useCustomBoardingLocation),
        showDriverPhoneToPatient: toBoolean(requestResult.showDriverPhoneToPatient),
        statusLabel: statusLabels[status as keyof typeof statusLabels] ?? status,
        loginHint:
          typeof requestResult.notes === 'string'
            ? requestResult.notes
            : 'Guarde seu CPF e seu PIN para consultas futuras.',
        history: historyResult.results ?? [],
        messages: requestMessages,
      }
    }),
  )

  await db.prepare(
    `
      update patients
      set last_login_at = current_timestamp,
          updated_at = current_timestamp
      where access_cpf = ?1
        and active = 1
    `,
  )
    .bind(normalizedCpf)
    .run()

  return {
    mustChangePin: mustChangePin && temporaryMatch.matches,
    patientName: String(patientAccess.patientName ?? ''),
    cpfMasked: String(patientAccess.cpfMasked ?? ''),
    temporaryPasswordLabel: DEFAULT_FIRST_ACCESS_PASSWORD,
    request: requests[0] ?? null,
    requests,
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
        and active = 1
      order by coalesce(updated_at, created_at) desc, id desc
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
      set citizen_pin = '',
          citizen_pin_hash = ?1,
          temporary_password = '',
          temporary_password_hash = null,
          must_change_pin = 0,
          access_activated_at = coalesce(access_activated_at, current_timestamp),
          last_login_at = current_timestamp,
          updated_at = current_timestamp
      where access_cpf = ?2
        and active = 1
    `,
  )
    .bind(await createSecretHash(newPin), normalizedCpf)
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

export async function listOperators(env: Env) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        id,
        name,
        cpf,
        email,
        role,
        active
      from operators
      where role = 'operator'
        and active = 1
      order by name asc
    `,
  ).all()

  return (result.results ?? []).map((operator) => ({
    ...operator,
    cpfMasked: typeof operator.cpf === 'string' ? maskCpf(operator.cpf) : '',
    active: toBoolean(operator.active),
  }))
}

export async function listManagers(env: Env) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        id,
        name,
        cpf,
        email,
        role,
        active
      from operators
      where role = 'manager'
        and active = 1
      order by name asc
    `,
  ).all()

  return (result.results ?? []).map((manager) => ({
    ...manager,
    cpfMasked: typeof manager.cpf === 'string' ? maskCpf(manager.cpf) : '',
    active: toBoolean(manager.active),
  }))
}

export async function listPatients(env: Env) {
  const db = requireDb(env)
  const result = await db.prepare(
    `
      select
        id,
        full_name as fullName,
        cpf,
        cpf_masked as cpfMasked,
        access_cpf as accessCpf,
        access_cpf_masked as accessCpfMasked,
        phone,
        is_whatsapp as isWhatsapp,
        address_line as addressLine,
        cns,
        responsible_name as responsibleName,
        responsible_cpf as responsibleCpf,
        responsible_cpf_masked as responsibleCpfMasked,
        use_responsible_cpf_for_access as useResponsibleCpfForAccess,
        active
      from patients
      where active = 1
      order by full_name asc
    `,
  ).all()

  return (result.results ?? []).map((patient) => ({
    ...patient,
    isWhatsapp: toBoolean(patient.isWhatsapp),
    useResponsibleCpfForAccess: toBoolean(patient.useResponsibleCpfForAccess),
    active: toBoolean(patient.active),
  }))
}

export async function loginDriver(env: Env, cpf: string, password: string) {
  const normalizedCpf = normalizeCpf(cpf)
  const db = requireDb(env)

  let driver: Record<string, unknown> | null = null

  try {
    driver = await db.prepare(
      `
        select
          d.id,
          d.name,
          d.cpf,
          d.password,
          d.password_hash as passwordHash,
          d.must_change_password as mustChangePassword,
          coalesce(v.name, d.vehicle_name) as vehicleName
        from drivers d
        left join vehicles v on v.id = d.vehicle_id
        where d.cpf = ?1
          and d.active = 1
        order by d.id desc
        limit 1
      `,
    )
      .bind(normalizedCpf)
      .first<Record<string, unknown>>()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (!message.includes('no such column: d.must_change_password')) {
      throw error
    }

    driver = await db.prepare(
      `
        select
          d.id,
          d.name,
          d.cpf,
          d.password,
          d.password_hash as passwordHash,
          0 as mustChangePassword,
          coalesce(v.name, d.vehicle_name) as vehicleName
        from drivers d
        left join vehicles v on v.id = d.vehicle_id
        where d.cpf = ?1
          and d.active = 1
        order by d.id desc
        limit 1
      `,
    )
      .bind(normalizedCpf)
      .first<Record<string, unknown>>()
  }

  if (!driver) {
    return null
  }

  const passwordMatch = await verifySecretWithFallback({
    secret: password,
    storedHash: String(driver.passwordHash ?? ''),
    legacySecret: String(driver.password ?? ''),
  })

  if (!passwordMatch.matches) {
    return null
  }

  if (passwordMatch.shouldUpgrade) {
    await db.prepare(
      `
        update drivers
        set password_hash = ?1,
            password = '',
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(await createSecretHash(password), driver.id)
      .run()
  }

  return {
    driverId: driver.id,
    name: String(driver.name ?? ''),
    cpf: maskCpf(String(driver.cpf ?? '')),
    vehicleName: String(driver.vehicleName ?? ''),
    mustChangePassword: toBoolean(driver.mustChangePassword),
    temporaryPasswordLabel: DEFAULT_FIRST_ACCESS_PASSWORD,
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
  let result: D1Result<Record<string, unknown>>

  try {
    result = await db.prepare(
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
        tr.appointment_time as appointmentTime,
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
        tr.assigned_driver_phone as assignedDriverPhone,
        tr.show_driver_phone_to_patient as showDriverPhoneToPatient,
        tr.assigned_vehicle_id as assignedVehicleId,
        tr.assigned_vehicle_name as assignedVehicleName,
        tr.patient_confirmed_at as patientConfirmedAt,
        tr.patient_last_viewed_at as patientLastViewedAt,
        tr.patient_last_message_seen_at as patientLastMessageSeenAt,
        tr.departure_time as departureTime,
        tr.manager_notes as managerNotes,
        tr.scheduled_at as scheduledAt,
        tr.notes
      from travel_requests tr
      inner join patients p on p.id = tr.patient_id
      where tr.assigned_driver_id = ?1
      order by tr.travel_date asc, tr.appointment_time asc, tr.departure_time asc, tr.created_at desc
    `,
    )
      .bind(driverId)
      .all()
  } catch (error) {
    if (!(hasMissingBoardingColumns(error) || hasMissingAssignmentColumns(error) || hasMissingPatientConfirmationColumn(error) || hasMissingPatientViewColumns(error) || hasMissingAppointmentTimeColumn(error))) {
      throw error
    }

    try {
      result = await db.prepare(
        `
          select
            tr.id,
            tr.protocol,
            tr.patient_name as patientName,
            tr.cpf_masked as cpfMasked,
            p.phone,
            p.address_line as addressLine,
            0 as useCustomBoardingLocation,
            '' as boardingLocationName,
            p.address_line as boardingLocationLabel,
            tr.access_cpf_masked as accessCpfMasked,
            tr.destination_city as destinationCity,
            tr.destination_state as destinationState,
            tr.treatment_unit as treatmentUnit,
            tr.specialty,
            tr.travel_date as travelDate,
            '' as appointmentTime,
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
            '' as assignedDriverPhone,
            1 as showDriverPhoneToPatient,
            null as assignedVehicleId,
            '' as assignedVehicleName,
            null as patientConfirmedAt,
            null as patientLastViewedAt,
            null as patientLastMessageSeenAt,
            tr.departure_time as departureTime,
            tr.manager_notes as managerNotes,
            tr.scheduled_at as scheduledAt,
            tr.notes
          from travel_requests tr
          inner join patients p on p.id = tr.patient_id
          where tr.assigned_driver_id = ?1
          order by tr.travel_date asc, tr.departure_time asc, tr.created_at desc
        `,
      )
        .bind(driverId)
        .all()
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : ''

      if (!message.includes('no such column:')) {
        throw fallbackError
      }

      result = await db.prepare(
        `
          select
            tr.id,
            tr.protocol,
            tr.patient_name as patientName,
            tr.cpf_masked as cpfMasked,
            '' as phone,
            '' as addressLine,
            0 as useCustomBoardingLocation,
            '' as boardingLocationName,
            '' as boardingLocationLabel,
            '' as accessCpfMasked,
            tr.destination_city as destinationCity,
            tr.destination_state as destinationState,
            tr.treatment_unit as treatmentUnit,
            tr.specialty,
            tr.travel_date as travelDate,
            '' as appointmentTime,
            tr.requested_at as requestedAt,
            tr.status,
            0 as companionRequired,
            '' as companionName,
            '' as companionCpfMasked,
            '' as companionPhone,
            0 as companionIsWhatsapp,
            '' as companionAddressLine,
            tr.assigned_driver_id as assignedDriverId,
            tr.assigned_driver_name as assignedDriverName,
            '' as assignedDriverPhone,
            1 as showDriverPhoneToPatient,
            null as assignedVehicleId,
            '' as assignedVehicleName,
            null as patientConfirmedAt,
            null as patientLastViewedAt,
            null as patientLastMessageSeenAt,
            '' as departureTime,
            '' as managerNotes,
            '' as scheduledAt,
            tr.notes
          from travel_requests tr
          where tr.assigned_driver_id = ?1
          order by travel_date asc, requested_at desc
        `,
      )
        .bind(driverId)
        .all()
    }
  }

  return Promise.all(
    (result.results ?? []).map(async (item) => ({
      ...item,
      companionRequired: toBoolean(item.companionRequired),
      companionIsWhatsapp: toBoolean(item.companionIsWhatsapp),
      useCustomBoardingLocation: toBoolean(item.useCustomBoardingLocation),
      showDriverPhoneToPatient: toBoolean(item.showDriverPhoneToPatient),
      messages: await listRequestMessages(env, Number(item.id)),
    })),
  )
}

export async function getRequestDetails(env: Env, requestId: number) {
  const db = requireDb(env)
  let request: Record<string, unknown> | null

  try {
    request = await db.prepare(
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
        tr.appointment_time as appointmentTime,
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
        tr.assigned_driver_phone as assignedDriverPhone,
        tr.show_driver_phone_to_patient as showDriverPhoneToPatient,
        tr.assigned_vehicle_id as assignedVehicleId,
        tr.assigned_vehicle_name as assignedVehicleName,
        tr.patient_confirmed_at as patientConfirmedAt,
        tr.operator_last_patient_message_seen_at as operatorLastPatientMessageSeenAt,
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
  } catch (error) {
    if (!(hasMissingBoardingColumns(error) || hasMissingAssignmentColumns(error) || hasMissingPatientConfirmationColumn(error) || hasMissingPatientViewColumns(error) || hasMissingAppointmentTimeColumn(error) || hasMissingOperatorPatientMessageSeenColumn(error))) {
      throw error
    }

    request = await db.prepare(
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
          0 as useCustomBoardingLocation,
          '' as boardingLocationName,
          p.address_line as boardingLocationLabel,
          p.cns,
          p.responsible_name as responsibleName,
          p.responsible_cpf_masked as responsibleCpfMasked,
          p.use_responsible_cpf_for_access as useResponsibleCpfForAccess,
          tr.destination_city as destinationCity,
          tr.destination_state as destinationState,
          tr.treatment_unit as treatmentUnit,
          tr.specialty,
          tr.travel_date as travelDate,
          '' as appointmentTime,
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
          '' as assignedDriverPhone,
          1 as showDriverPhoneToPatient,
          null as assignedVehicleId,
          '' as assignedVehicleName,
          null as patientConfirmedAt,
          null as operatorLastPatientMessageSeenAt,
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
  }

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

  const messages = await listRequestMessages(env, requestId)

  return {
    ...request,
    isWhatsapp: toBoolean(request.isWhatsapp),
    useResponsibleCpfForAccess: toBoolean(request.useResponsibleCpfForAccess),
    companionRequired: toBoolean(request.companionRequired),
    companionIsWhatsapp: toBoolean(request.companionIsWhatsapp),
    useCustomBoardingLocation: toBoolean(request.useCustomBoardingLocation),
    showDriverPhoneToPatient: toBoolean(request.showDriverPhoneToPatient),
    history: historyResult.results ?? [],
    messages,
  }
}

export async function confirmCitizenRequest(env: Env, cpf: string, password: string, requestId: number) {
  const db = requireDb(env)
  const access = await loginCitizen(env, cpf, password)

  if (!access) {
    return null
  }

  const targetRequest = access.requests.find((item) => item.id === requestId)

  if (!targetRequest) {
    return false
  }

  let requestRecord: Record<string, unknown> | null

  try {
    requestRecord = await db.prepare(
      `
        select
          id,
          patient_id as patientId,
          protocol,
          status,
          patient_confirmed_at as patientConfirmedAt
        from travel_requests
        where id = ?1
        limit 1
      `,
    )
      .bind(requestId)
      .first<Record<string, unknown>>()
  } catch (error) {
    if (!hasMissingPatientConfirmationColumn(error)) {
      throw error
    }

    requestRecord = await db.prepare(
      `
        select
          id,
          patient_id as patientId,
          protocol,
          status,
          null as patientConfirmedAt
        from travel_requests
        where id = ?1
        limit 1
      `,
    )
      .bind(requestId)
      .first<Record<string, unknown>>()
  }

  if (!requestRecord) {
    return false
  }

  const status = String(requestRecord.status ?? '')
  if (!['aprovada', 'agendada'].includes(status)) {
    return {
      ...access,
      message: 'Esta solicitação não está disponível para confirmação no momento.',
      confirmedAt: String(requestRecord.patientConfirmedAt ?? ''),
    }
  }

  const existingConfirmation = String(requestRecord.patientConfirmedAt ?? '').trim()

  if (!existingConfirmation) {
    try {
      await db.prepare(
        `
          update travel_requests
          set patient_confirmed_at = current_timestamp,
              updated_at = current_timestamp
          where id = ?1
        `,
      )
        .bind(requestId)
        .run()
    } catch (error) {
      if (!hasMissingPatientConfirmationColumn(error)) {
        throw error
      }

      return {
        ...access,
        message: 'A confirmação da agenda ainda não foi habilitada no banco remoto.',
        confirmedAt: '',
      }
    }

    const nextOrder = await getNextHistoryOrder(db, requestId)
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
        values (?1, ?2, ?3, 'Confirmada pelo paciente', ?4, null, datetime('now'), ?5)
      `,
    )
      .bind(
        requestId,
        requestRecord.protocol,
        requestRecord.status,
        'Agenda confirmada pelo paciente na consulta pública.',
        nextOrder,
      )
      .run()
  }

  const refreshedAccess = await loginCitizen(env, cpf, password)

  if (!refreshedAccess) {
    return null
  }

  const confirmedRequest = refreshedAccess.requests.find((item) => item.id === requestId)

  return {
    ...refreshedAccess,
    message: existingConfirmation
      ? 'Esta agenda já havia sido confirmada anteriormente.'
      : 'Agenda confirmada com sucesso.',
    confirmedAt: String(confirmedRequest?.patientConfirmedAt ?? requestRecord.patientConfirmedAt ?? ''),
  }
}

export async function markCitizenRequestViewed(env: Env, cpf: string, password: string, requestId: number) {
  const db = requireDb(env)
  const access = await loginCitizen(env, cpf, password)

  if (!access) {
    return null
  }

  const targetRequest = access.requests.find((item) => item.id === requestId)

  if (!targetRequest) {
    return false
  }

  try {
    await db.prepare(
      `
        update travel_requests
        set patient_last_viewed_at = current_timestamp,
            patient_last_message_seen_at = case
              when exists (
                select 1
                from request_messages rm
                where rm.travel_request_id = ?1
                  and rm.visible_to_citizen = 1
              )
                then current_timestamp
              else patient_last_message_seen_at
            end,
            updated_at = current_timestamp
        where id = ?1
      `,
    )
      .bind(requestId)
      .run()
  } catch (error) {
    if (!hasMissingPatientViewColumns(error)) {
      throw error
    }

    return {
      requestId,
      viewedAt: '',
      messageSeenAt: '',
    }
  }

  const refreshed = await db.prepare(
    `
      select
        patient_last_viewed_at as viewedAt,
        patient_last_message_seen_at as messageSeenAt
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  return {
    requestId,
    viewedAt: String(refreshed?.viewedAt ?? ''),
    messageSeenAt: String(refreshed?.messageSeenAt ?? ''),
  }
}

export async function markOperatorPatientMessagesSeen(env: Env, requestId: number) {
  const db = requireDb(env)

  try {
    await db.prepare(
      `
        update travel_requests
        set operator_last_patient_message_seen_at = case
              when exists (
                select 1
                from request_messages rm
                where rm.travel_request_id = ?1
                  and rm.created_by_role = 'patient'
              )
                then current_timestamp
              else operator_last_patient_message_seen_at
            end,
            updated_at = current_timestamp
        where id = ?1
      `,
    )
      .bind(requestId)
      .run()
  } catch (error) {
    if (hasMissingOperatorPatientMessageSeenColumn(error) || hasMissingMessageRoleColumn(error)) {
      return {
        requestId,
        operatorLastPatientMessageSeenAt: '',
      }
    }

    throw error
  }

  const refreshed = await db.prepare(
    `
      select
        operator_last_patient_message_seen_at as operatorLastPatientMessageSeenAt
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(requestId)
    .first<Record<string, unknown>>()

  return {
    requestId,
    operatorLastPatientMessageSeenAt: String(refreshed?.operatorLastPatientMessageSeenAt ?? ''),
  }
}

export async function createCitizenRequestMessage(
  env: Env,
  cpf: string,
  password: string,
  input: {
    requestId: number
    title: string
    body: string
  },
) {
  const access = await loginCitizen(env, cpf, password)

  if (!access) {
    return null
  }

  const targetRequest = access.requests.find((item) => item.id === input.requestId)

  if (!targetRequest) {
    return false
  }

  const result = await createRequestMessage(env, input.requestId, {
    messageType: 'patient',
    title: input.title,
    body: input.body,
    visibleToCitizen: true,
    createdByOperatorId: null,
    createdByName: access.patientName,
    createdByRole: 'patient',
  })

  if (!result) {
    return false
  }

  return {
    message: 'Mensagem enviada para a equipe responsável.',
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
  appointmentTime: string,
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
          appointment_time = ?3,
          updated_at = current_timestamp
      where id = ?4
    `,
  )
    .bind(travelDate, departureTime, appointmentTime, requestId)
    .run()

  const nextOrder = await getNextHistoryOrder(db, requestId)
  const noteText = note?.trim()
    ? `Viagem reagendada para ${travelDate} com consulta às ${appointmentTime || 'a definir'} e saída às ${departureTime}. ${note.trim()}`
    : `Viagem reagendada para ${travelDate} com consulta às ${appointmentTime || 'a definir'} e saída às ${departureTime}.`

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
    message: `Viagem reagendada para ${travelDate} com consulta às ${appointmentTime || 'a definir'} e saída às ${departureTime}.`,
  }
}

export async function createRequestMessage(
  env: Env,
  requestId: number,
  input: {
    messageType: string
    title: string
    body: string
    visibleToCitizen: boolean
    createdByOperatorId?: number | null
    createdByName: string
    createdByRole?: string
  },
) {
  const db = requireDb(env)
  const request = await db.prepare(
    `
      select id
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

  try {
    await db.prepare(
      `
        insert into request_messages (
          travel_request_id,
          message_type,
          title,
          body,
          visible_to_citizen,
          created_by_operator_id,
          created_by_name,
          created_by_role
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
      .bind(
        requestId,
        input.messageType || 'general',
        input.title.trim() || null,
        input.body.trim(),
        input.visibleToCitizen ? 1 : 0,
        input.createdByOperatorId ?? null,
        input.createdByName,
        input.createdByRole ?? 'operator',
      )
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (!message.includes('no such column: created_by_role')) {
      throw error
    }

    await db.prepare(
      `
        insert into request_messages (
          travel_request_id,
          message_type,
          title,
          body,
          visible_to_citizen,
          created_by_operator_id,
          created_by_name
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
      .bind(
        requestId,
        input.messageType || 'general',
        input.title.trim() || null,
        input.body.trim(),
        input.visibleToCitizen ? 1 : 0,
        input.createdByOperatorId ?? null,
        input.createdByName,
      )
      .run()
  }

  return {
    message: input.visibleToCitizen
      ? 'Aviso registrado e liberado para a consulta do paciente.'
      : 'Mensagem interna registrada com sucesso.',
  }
}
