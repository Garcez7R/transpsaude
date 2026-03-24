import { badRequest, confirmCitizenRequest, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    cpf?: string
    password?: string
    requestId?: number
  }

  if (!body.cpf || !body.password || !body.requestId) {
    return badRequest('Informe CPF, PIN e a solicitação que deve ser confirmada.')
  }

  const result = await confirmCitizenRequest(env, body.cpf, body.password, body.requestId)

  if (!result) {
    return notFound('Não foi possível localizar um acesso válido para confirmar esta agenda.')
  }

  if (result === false) {
    return notFound('A solicitação informada não está vinculada a este acesso.')
  }

  return ok(result)
}
