import { badRequest, getRequestDetails, notFound, ok, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const requestId = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return badRequest('Informe uma solicitação válida.')
  }

  const record = await getRequestDetails(env, requestId)

  if (!record) {
    return notFound('Solicitação não encontrada.')
  }

  return ok(record)
}
