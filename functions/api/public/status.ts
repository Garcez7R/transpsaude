import { badRequest, findPublicRequest, notFound, ok, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const protocol = url.searchParams.get('protocol')?.trim()
  const pin = url.searchParams.get('pin')?.trim()

  if (!protocol || !pin) {
    return badRequest('Informe protocolo e PIN.')
  }

  const record = await findPublicRequest(env, protocol, pin)

  if (!record) {
    return notFound('Solicitacao nao encontrada.')
  }

  return ok(record)
}
