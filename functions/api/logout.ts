import { badRequest, closeSession, ok, type Env } from './_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const token = request.headers.get('x-session-token')?.trim() ?? ''

  if (!token) {
    return badRequest('Sessão não informada.')
  }

  await closeSession(env, token)

  return ok({
    message: 'Sessão encerrada com sucesso.',
  })
}
