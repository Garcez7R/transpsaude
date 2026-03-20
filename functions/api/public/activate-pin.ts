import { activateCitizenPin, badRequest, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; newPin?: string }
  const cpf = body.cpf?.trim()
  const newPin = body.newPin?.trim()

  if (!cpf || !newPin) {
    return badRequest('Informe CPF e novo PIN.')
  }

  const record = await activateCitizenPin(env, cpf, newPin)

  if (!record) {
    return notFound('Não foi possível ativar o novo PIN.')
  }

  return ok(record)
}
