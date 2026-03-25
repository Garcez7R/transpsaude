import { badRequest, forbidden, markOperatorPatientMessagesSeen, ok, requireInternalRole, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para registrar a leitura das mensagens do paciente.')
  }

  const body = (await request.json()) as { requestId?: number }
  const requestId = Number(body.requestId ?? '')

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return badRequest('Informe uma solicitação válida para registrar a leitura.')
  }

  const result = await markOperatorPatientMessagesSeen(env, requestId)
  return ok(result)
}
