import { badRequest, notFound, ok, updateRequestSchedule, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    requestId?: number
    travelDate?: string
    departureTime?: string
    note?: string
  }

  if (!body.requestId || !body.travelDate || !body.departureTime) {
    return badRequest('Informe a solicitacao, a nova data e o horario de saida.')
  }

  const result = await updateRequestSchedule(
    env,
    body.requestId,
    body.travelDate,
    body.departureTime,
    body.note ?? '',
    1,
  )

  if (!result) {
    return notFound('Solicitacao nao encontrada.')
  }

  return ok(result)
}
