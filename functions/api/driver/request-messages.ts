import {
  badRequest,
  createRequestMessage,
  forbidden,
  notFound,
  ok,
  readDriverSession,
  serverError,
  type Env,
  writeAuditLog,
} from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const session = await readDriverSession(env, request)

    if (!session) {
      return forbidden('Sessão do motorista obrigatória para registrar mensagens.')
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

    const trip = await env.DB?.prepare(
      `
        select id
        from travel_requests
        where id = ?1
          and assigned_driver_id = ?2
        limit 1
      `,
    )
      .bind(body.requestId, session.driverId)
      .first<Record<string, unknown>>()

    if (!trip) {
      return notFound('A solicitação informada não está atribuída a este motorista.')
    }

    const result = await createRequestMessage(env, body.requestId, {
      messageType: body.messageType ?? 'driver',
      title: body.title ?? '',
      body: body.body,
      visibleToCitizen: Boolean(body.visibleToCitizen),
      createdByOperatorId: null,
      createdByName: session.name,
      createdByRole: 'driver',
    })

    if (!result) {
      return notFound('Solicitação não encontrada.')
    }

    await writeAuditLog(env, null, 'driver_message', 'travel_request', String(body.requestId), {
      driverId: session.driverId,
      messageType: body.messageType ?? 'driver',
      title: body.title ?? '',
      visibleToCitizen: Boolean(body.visibleToCitizen),
    })

    return ok(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível registrar a mensagem do motorista.'
    return message.includes('no such table: request_messages')
      ? serverError('A migration de mensagens ainda não foi aplicada no banco D1.')
      : serverError(message)
  }
}
