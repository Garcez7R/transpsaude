import { badRequest, forbidden, notFound, ok, requireInternalRole, updateRequestStatus, type Env } from '../_utils'

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

  const result = await updateRequestStatus(env, body.requestId, body.status, body.note ?? '', session.operatorId)

  if (!result) {
    return notFound('Solicitação não encontrada.')
  }

  return ok(result)
}
