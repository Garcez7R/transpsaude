import { forbidden, getSummary, ok, requireInternalRole, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = requireInternalRole(request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para consultar o painel.')
  }

  const summary = await getSummary(env)
  return ok(summary)
}
