import { badRequest, createSecretHash, createSession, notFound, ok, verifySecretHash, type Env } from '../_utils'

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
        password,
        password_hash as passwordHash
      from operators
      where cpf = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(normalizedCpf)
    .first<Record<string, unknown>>()

  if (!operator) {
    return notFound('Acesso administrativo não encontrado.')
  }

  const passwordHash = String(operator.passwordHash ?? '')
  const legacyPassword = String(operator.password ?? '')
  const matchesHash = passwordHash ? await verifySecretHash(password, passwordHash) : false
  const matchesLegacy = !passwordHash && legacyPassword !== '' && legacyPassword === password

  if (!matchesHash && !matchesLegacy) {
    return notFound('Acesso administrativo não encontrado.')
  }

  if (matchesLegacy) {
    await env.DB.prepare(
      `
        update operators
        set password_hash = ?1,
            password = '',
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(await createSecretHash(password), operator.id)
      .run()
  }

  const sessionRecord = await createSession(env, {
    sessionType: 'internal',
    operatorId: Number(operator.id),
    role: String(operator.role) as 'operator' | 'manager' | 'admin',
    name: String(operator.name),
  })

  return ok({
    session: {
      token: sessionRecord.token,
      operatorId: operator.id,
      name: operator.name,
      role: operator.role,
      cpf: maskCpf(String(operator.cpf ?? '')),
      expiresAt: sessionRecord.expiresAt,
    },
  })
}
