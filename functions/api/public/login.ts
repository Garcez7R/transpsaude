import { badRequest, loginCitizen, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; password?: string }
  const cpf = body.cpf?.trim()
  const password = body.password?.trim()

  if (!cpf || !password) {
    return badRequest('Informe CPF e senha/PIN.')
  }

  const record = await loginCitizen(env, cpf, password)

  if (!record) {
    return notFound('Acesso do cidadão não encontrado.')
  }

  return ok(record)
}
