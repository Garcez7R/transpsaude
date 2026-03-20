import { badRequest, notFound, ok, updateRequestStatus, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    requestId?: number
    status?: string
    note?: string
  }

  if (!body.requestId || !body.status) {
    return badRequest('Informe a solicitacao e o novo status.')
  }

  const result = await updateRequestStatus(env, body.requestId, body.status, body.note ?? '', 1)

  if (!result) {
    return notFound('Solicitacao nao encontrada.')
  }

  return ok(result)
}
