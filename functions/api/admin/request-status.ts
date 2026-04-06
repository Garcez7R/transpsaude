import {
  badRequest,
  forbidden,
  notFound,
  ok,
  requireInternalRole,
  updateRequestStatus,
  type Env,
  writeAuditLog,
} from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para atualizar o status.')
  }

  const body = (await request.json()) as {
    requestId?: number
    status?: string
    note?: string
  }

  if (!body.requestId || !body.status) {
    return badRequest('Informe a solicitação e o novo status.')
  }

  const status = String(body.status)
  const requestRecord = await env.DB.prepare(
    `
      select
        id,
        status,
        assigned_driver_id as assignedDriverId,
        assigned_vehicle_id as assignedVehicleId,
        travel_date as travelDate,
        departure_time as departureTime,
        appointment_time as appointmentTime
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(body.requestId)
    .first<Record<string, unknown>>()

  if (!requestRecord) {
    return notFound('Solicitação não encontrada.')
  }

  const currentStatus = String(requestRecord.status ?? '')
  const allowedTransitions: Record<string, string[]> = {
    recebida: ['em_analise', 'cancelada'],
    em_analise: ['aguardando_documentos', 'aprovada', 'cancelada'],
    aguardando_documentos: ['em_analise', 'aprovada', 'cancelada'],
    aprovada: ['agendada', 'cancelada'],
    agendada: ['concluida', 'cancelada'],
    concluida: [],
    cancelada: [],
  }

  if (currentStatus && status !== currentStatus) {
    const allowed = allowedTransitions[currentStatus] ?? []
    if (!allowed.includes(status)) {
      return badRequest(`Status inválido. A transição de ${currentStatus} para ${status} não é permitida.`)
    }
  }

  if (status === 'agendada' || status === 'concluida') {
    if (!requestRecord.assignedDriverId || !requestRecord.assignedVehicleId) {
      return badRequest('Defina motorista e veículo antes de finalizar o agendamento.')
    }

    if (!requestRecord.travelDate || !requestRecord.departureTime || !requestRecord.appointmentTime) {
      return badRequest('Defina data, saída e horário da consulta antes de finalizar o agendamento.')
    }
  }

  const result = await updateRequestStatus(env, body.requestId, body.status, body.note ?? '', session.operatorId)

  if (!result) {
    return notFound('Solicitação não encontrada.')
  }

  await writeAuditLog(env, session.operatorId, 'status_change', 'travel_request', String(body.requestId), {
    status: body.status,
    note: body.note ?? '',
  })

  return ok(result)
}
