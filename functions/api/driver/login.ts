import { badRequest, loginDriver, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; password?: string }
  const cpf = body.cpf?.trim()
  const password = body.password?.trim()

  if (!cpf || !password) {
    return badRequest('Informe CPF e PIN do motorista.')
  }

  const record = await loginDriver(env, cpf, password)

  if (!record) {
    return notFound('Motorista não encontrado.')
  }

  const token = crypto.randomUUID()

  await env.DB.prepare(
    `
      insert into auth_sessions (
        token,
        session_type,
        driver_id,
        name,
        active,
        expires_at,
        last_used_at
      )
      values (?1, 'driver', ?2, ?3, 1, datetime('now', '+7 days'), current_timestamp)
    `,
  )
    .bind(token, record.driverId, record.name)
    .run()

  return ok({
    session: {
      ...record,
      token,
    },
  })
}
