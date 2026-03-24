import { badRequest, markCitizenRequestViewed, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    cpf?: string
    password?: string
    requestId?: number
  }

  if (!body.cpf || !body.password || !body.requestId) {
    return badRequest('Informe CPF, PIN e a solicitação que foi visualizada.')
  }

  const result = await markCitizenRequestViewed(env, body.cpf, body.password, body.requestId)

  if (!result) {
    return notFound('Não foi possível localizar um acesso válido para registrar a visualização.')
  }

  if (result === false) {
    return notFound('A solicitação informada não está vinculada a este acesso.')
  }

  return ok(result)
}
