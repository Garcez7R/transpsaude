import { badRequest, forbidden, notFound, ok, requireInternalRole, updateRequestSchedule, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem reagendar viagens.')
  }

  const body = (await request.json()) as {
    requestId?: number
    travelDate?: string
    departureTime?: string
    note?: string
  }

  if (!body.requestId || !body.travelDate || !body.departureTime) {
    return badRequest('Informe a solicitação, a nova data e o horário de saída.')
  }

  const result = await updateRequestSchedule(
    env,
    body.requestId,
    body.travelDate,
    body.departureTime,
    body.note ?? '',
    session.operatorId,
  )

  if (!result) {
    return notFound('Solicitação não encontrada.')
  }

  return ok(result)
}
