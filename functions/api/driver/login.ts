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

  return ok({
    session: record,
  })
}
