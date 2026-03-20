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

export async function findPublicRequest(env: Env, protocol: string, pin: string) {
  if (!env.DB) {
    const request = mockRequests.find((item) => item.protocol === protocol && item.protocolPin === pin)

    if (!request) {
      return null
    }

    return {
      ...request,
      statusLabel: statusLabels[request.status],
      protocolPinHint: request.notes ?? 'Guarde o protocolo para futuras consultas.',
      history: historyByProtocol[protocol] ?? [],
    }
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
      where protocol = ?1 and protocol_pin = ?2
      limit 1
    `,
  )
    .bind(protocol, pin)
    .first<Record<string, unknown>>()

  if (!requestResult) {
    return null
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
    .bind(protocol)
    .all()

  const status = String(requestResult.status)

  return {
    ...requestResult,
    statusLabel: statusLabels[status as keyof typeof statusLabels] ?? status,
    protocolPinHint:
      typeof requestResult.notes === 'string'
        ? requestResult.notes
        : 'Guarde o protocolo para futuras consultas.',
    history: historyResult.results ?? [],
  }
}
