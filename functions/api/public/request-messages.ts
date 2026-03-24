import { badRequest, createCitizenRequestMessage, notFound, ok, serverError, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = (await request.json()) as {
      cpf?: string
      password?: string
      requestId?: number
      title?: string
      body?: string
    }

    if (!body.cpf || !body.password || !body.requestId || !body.body?.trim()) {
      return badRequest('Informe CPF, PIN, a solicitação e a mensagem que deve ser enviada.')
    }

    const result = await createCitizenRequestMessage(env, body.cpf, body.password, {
      requestId: body.requestId,
      title: body.title ?? '',
      body: body.body,
    })

    if (!result) {
      return notFound('Não foi possível localizar um acesso válido para enviar esta mensagem.')
    }

    if (result === false) {
      return notFound('A solicitação informada não está vinculada a este acesso.')
    }

    return ok(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.'
    return message.includes('no such table: request_messages')
      ? serverError('A migration de mensagens ainda não foi aplicada no banco D1.')
      : serverError(message)
  }
}
