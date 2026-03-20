import { historyByProtocol, mockRequests, statusLabels } from './_data'

export interface Env {
  DB?: D1Database
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

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

export async function listRequests(env: Env, status?: string) {
  if (!env.DB) {
    return mockRequests.filter((item) => (status ? item.status === status : true))
  }

  let query = `
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
  `

  const params: string[] = []

  if (status) {
    query += ' where status = ?1'
    params.push(status)
  }

  query += ' order by created_at desc'

  const prepared = env.DB.prepare(query)
  const statement = params.length > 0 ? prepared.bind(...params) : prepared
  const result = await statement.all()

  return (result.results ?? []) as Array<Record<string, unknown>>
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

  if (!env.DB) {
    const request = mockRequests.find((item) => item.accessCpf === normalizedCpf)

    if (!request) {
      return null
    }

    const passwordMatches =
      (request.mustChangePin && password === request.temporaryPassword) || password === request.citizenPin

    if (!passwordMatches) {
      return null
    }

    return {
      mustChangePin: request.mustChangePin && password === request.temporaryPassword,
      patientName: request.patientName,
      cpfMasked: request.cpfMasked,
      temporaryPasswordLabel: request.temporaryPassword,
      request: {
        ...request,
        statusLabel: statusLabels[request.status],
        loginHint: request.notes ?? 'Guarde seu CPF e seu PIN para futuras consultas.',
        history: historyByProtocol[request.protocol] ?? [],
      },
    }
  }

  const patientAccess = await env.DB.prepare(
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

  const requestResult = await env.DB.prepare(
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

  const historyResult = await env.DB.prepare(
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

  await env.DB.prepare(
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

  if (!env.DB) {
    const request = mockRequests.find((item) => item.accessCpf === normalizedCpf)

    if (!request) {
      return null
    }

    return {
      mustChangePin: false,
      patientName: request.patientName,
      cpfMasked: request.cpfMasked,
      temporaryPasswordLabel: request.temporaryPassword,
      request: {
        ...request,
        statusLabel: statusLabels[request.status],
        loginHint: request.notes ?? 'Guarde seu CPF e seu PIN para futuras consultas.',
        history: historyByProtocol[request.protocol] ?? [],
      },
    }
  }

  const patient = await env.DB.prepare(
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

  await env.DB.prepare(
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
