import {
  badRequest,
  forbidden,
  notFound,
  ok,
  requireInternalRole,
  updateRequestSchedule,
  type Env,
  writeAuditLog,
} from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem reagendar viagens.')
  }

  const body = (await request.json()) as {
    requestId?: number
    travelDate?: string
    departureTime?: string
    appointmentTime?: string
    note?: string
  }

  if (!body.requestId || !body.travelDate || !body.departureTime || !body.appointmentTime) {
    return badRequest('Informe a solicitação, a nova data, o horário da consulta e o horário de saída.')
  }

  const requestRecord = await env.DB.prepare(
    `
      select status
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

  const status = String(requestRecord.status ?? '')
  if (['cancelada', 'concluida'].includes(status)) {
    return badRequest('Solicitações canceladas ou concluídas não podem ser reagendadas.')
  }

  const result = await updateRequestSchedule(
    env,
    body.requestId,
    body.travelDate,
    body.departureTime,
    body.appointmentTime,
    body.note ?? '',
    session.operatorId,
  )

  if (!result) {
    return notFound('Solicitação não encontrada.')
  }

  await writeAuditLog(env, session.operatorId, 'reschedule', 'travel_request', String(body.requestId), {
    travelDate: body.travelDate,
    appointmentTime: body.appointmentTime,
    departureTime: body.departureTime,
    note: body.note ?? '',
  })

  return ok(result)
}
