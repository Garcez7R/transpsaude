import { badRequest, createSession, loginDriver, notFound, ok, type Env } from '../_utils'

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

  const sessionRecord = await createSession(env, {
    sessionType: 'driver',
    driverId: Number(record.driverId),
    name: String(record.name),
  })

  return ok({
    session: {
      ...record,
      token: sessionRecord.token,
      expiresAt: sessionRecord.expiresAt,
    },
  })
}
