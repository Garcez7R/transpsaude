import {
  badRequest,
  createRequestMessage,
  forbidden,
  notFound,
  ok,
  requireInternalRole,
  serverError,
  type Env,
  writeAuditLog,
} from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

    if (!session) {
      return forbidden('Acesso interno obrigatório para registrar mensagens.')
    }

    const body = (await request.json()) as {
      requestId?: number
      messageType?: string
      title?: string
      body?: string
      visibleToCitizen?: boolean
    }

    if (!body.requestId || !body.body?.trim()) {
      return badRequest('Informe a solicitação e o conteúdo da mensagem.')
    }

    const result = await createRequestMessage(env, body.requestId, {
      messageType: body.messageType ?? 'general',
      title: body.title ?? '',
      body: body.body,
      visibleToCitizen: Boolean(body.visibleToCitizen),
      createdByOperatorId: session.operatorId,
      createdByName: session.name,
    })

    if (!result) {
      return notFound('Solicitação não encontrada.')
    }

    await writeAuditLog(env, session.operatorId, 'message', 'travel_request', String(body.requestId), {
      messageType: body.messageType ?? 'general',
      title: body.title ?? '',
      visibleToCitizen: Boolean(body.visibleToCitizen),
    })

    return ok(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível registrar a mensagem.'
    return message.includes('no such table: request_messages')
      ? serverError('A migration de mensagens ainda não foi aplicada no banco D1.')
      : serverError(message)
  }
}
