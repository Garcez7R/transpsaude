import { badRequest, createSecretHash, normalizeCpf, notFound, ok, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; newPassword?: string }
  const cpf = body.cpf?.trim()
  const newPassword = body.newPassword?.trim()

  if (!cpf || !newPassword) {
    return badRequest('Informe CPF e novo PIN do motorista.')
  }

  if (!/^\d{4}$/.test(newPassword)) {
    return badRequest('O novo PIN deve ter 4 dígitos numéricos.')
  }

  const normalizedCpf = normalizeCpf(cpf)

  const driver = await env.DB.prepare(
    `
      select id
      from drivers
      where cpf = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!driver) {
    return notFound('Motorista não encontrado.')
  }

  await env.DB.prepare(
    `
      update drivers
      set password = '',
          password_hash = ?1,
          must_change_password = 0,
          updated_at = current_timestamp
      where id = ?2
    `,
  )
    .bind(await createSecretHash(newPassword), driver.id)
    .run()

  return ok({ message: 'PIN do motorista redefinido com sucesso.' })
}
