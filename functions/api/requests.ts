import { forbidden, listRequests, ok, requireInternalRole, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para consultar solicitações.')
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? undefined
  const requests = await listRequests(env, status)
  return ok(requests)
}
