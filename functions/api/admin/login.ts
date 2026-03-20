import { badRequest, notFound, ok, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

function maskCpf(value: string) {
  return normalizeCpf(value)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as { cpf?: string; password?: string }
  const cpf = body.cpf?.trim()
  const password = body.password?.trim()

  if (!cpf || !password) {
    return badRequest('Informe CPF e senha do acesso administrativo.')
  }

  const normalizedCpf = normalizeCpf(cpf)

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
        and active = 1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!operator || String(operator.password ?? '') !== password) {
    return notFound('Acesso administrativo não encontrado.')
  }

  return ok({
    session: {
      operatorId: operator.id,
      name: operator.name,
      role: operator.role,
      cpf: maskCpf(String(operator.cpf ?? '')),
    },
  })
}
