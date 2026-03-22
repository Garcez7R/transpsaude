import { badRequest, createSecretHash, normalizeCpf, notFound, ok, serverError, type Env } from '../_utils'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    if (!env.DB) {
      return badRequest('Banco D1 não configurado no deploy da área administrativa.')
    }

    const body = (await request.json()) as { cpf?: string; newPassword?: string }
    const cpf = body.cpf?.trim()
    const newPassword = body.newPassword?.trim()

    if (!cpf || !newPassword) {
      return badRequest('Informe CPF e novo PIN do acesso interno.')
    }

    if (!/^\d{4}$/.test(newPassword)) {
      return badRequest('O novo PIN deve ter 4 dígitos numéricos.')
    }

    const normalizedCpf = normalizeCpf(cpf)

    const operator = await env.DB.prepare(
      `
        select id
        from operators
        where cpf = ?1
          and active = 1
        limit 1
      `,
    )
      .bind(normalizedCpf)
      .first<Record<string, unknown>>()

    if (!operator) {
      return notFound('Acesso interno não encontrado.')
    }

    const secretHash = await createSecretHash(newPassword)

    const updateVariants = [
      `
        update operators
        set password = '',
            password_hash = ?1,
            must_change_password = 0,
            updated_at = current_timestamp
        where id = ?2
      `,
      `
        update operators
        set password = '',
            password_hash = ?1,
            updated_at = current_timestamp
        where id = ?2
      `,
      `
        update operators
        set password = '',
            password_hash = ?1,
            must_change_password = 0
        where id = ?2
      `,
      `
        update operators
        set password = '',
            password_hash = ?1
        where id = ?2
      `,
    ]

    for (const query of updateVariants) {
      try {
        await env.DB.prepare(query).bind(secretHash, operator.id).run()
        return ok({ message: 'PIN redefinido com sucesso.' })
      } catch (error) {
        const message = error instanceof Error ? error.message : ''

        if (
          message.includes('no such column: must_change_password')
          || message.includes('no such column: updated_at')
          || message.includes('no such column: password_hash')
        ) {
          continue
        }

        throw error
      }
    }

    await env.DB.prepare(
      `
        update operators
        set password = ?1
        where id = ?2
      `,
    )
      .bind(newPassword, operator.id)
      .run()

    return ok({ message: 'PIN redefinido com sucesso.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir o primeiro acesso administrativo.'
    return serverError(message)
  }
}
