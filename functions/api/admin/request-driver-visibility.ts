import { badRequest, forbidden, notFound, ok, requireInternalRole, type Env, writeAuditLog } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para ajustar a visibilidade do telefone do motorista.')
  }

  const body = (await request.json()) as {
    requestId?: number
    showDriverPhoneToPatient?: boolean
  }

  if (!body.requestId || typeof body.showDriverPhoneToPatient !== 'boolean') {
    return badRequest('Informe a solicitação e a opção de visibilidade do telefone do motorista.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from travel_requests
      where id = ?1
      limit 1
    `,
  )
    .bind(body.requestId)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Solicitação não encontrada.')
  }

  try {
    await env.DB.prepare(
      `
        update travel_requests
        set show_driver_phone_to_patient = ?1,
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(body.showDriverPhoneToPatient ? 1 : 0, body.requestId)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (!message.includes('no such column: show_driver_phone_to_patient')) {
      throw error
    }

    return ok({
      message: 'A coluna de visibilidade do telefone do motorista ainda não foi aplicada no banco remoto.',
    })
  }

  await writeAuditLog(env, session.operatorId, 'driver_phone_visibility', 'travel_request', String(body.requestId), {
    showDriverPhoneToPatient: body.showDriverPhoneToPatient ? 1 : 0,
  })

  return ok({
    message: body.showDriverPhoneToPatient
      ? 'Telefone do motorista liberado para a consulta do paciente.'
      : 'Telefone do motorista ocultado da consulta do paciente.',
  })
}
