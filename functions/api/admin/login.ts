import { badRequest, notFound, ok, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; password?: string }
  const cpf = body.cpf?.trim()
  const password = body.password?.trim()

  if (!cpf || !password) {
    return badRequest('Informe CPF e senha do administrador.')
  }

  const normalizedCpf = normalizeCpf(cpf)

  if (!env.DB) {
    if (normalizedCpf === '96820373015' && password === '1978') {
      return ok({
        session: {
          operatorId: 1,
          name: 'Administrador Geral',
          role: 'admin',
          cpf: '968.203.730-15',
        },
      })
    }

    return notFound('Administrador não encontrado.')
  }

  const operator = await env.DB.prepare(
    `
      select
        id,
        name,
        role,
        cpf,
        password
      from operators
      where cpf = ?1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!operator || String(operator.password ?? '') !== password) {
    return notFound('Administrador não encontrado.')
  }

  return ok({
    session: {
      operatorId: operator.id,
      name: operator.name,
      role: operator.role,
      cpf: '968.203.730-15',
    },
  })
}
