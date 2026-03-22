import {
  DEFAULT_FIRST_ACCESS_PASSWORD,
  badRequest,
  createSecretHash,
  forbidden,
  listManagers,
  notFound,
  ok,
  requireInternalRole,
  serverError,
  type Env,
  writeAuditLog,
} from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const session = await requireInternalRole(env, request, ['admin'])

    if (!session) {
      return forbidden('Somente o administrador pode cadastrar gerentes.')
    }

    const body = (await request.json()) as {
      name?: string
      cpf?: string
      email?: string
    }

    if (!body.name || !body.cpf || !body.email) {
      return badRequest('Preencha nome, CPF e e-mail do gerente.')
    }

    const cpf = normalizeCpf(body.cpf)

    const secretHash = await createSecretHash(DEFAULT_FIRST_ACCESS_PASSWORD)

    try {
      await env.DB.prepare(
        `
          insert into operators (
            name,
            cpf,
            email,
            password,
            password_hash,
            must_change_password,
            role,
            active,
            created_by_operator_id,
            updated_at
          )
          values (?1, ?2, ?3, '', ?4, 1, 'manager', 1, ?5, current_timestamp)
        `,
      )
        .bind(body.name, cpf, body.email, secretHash, session.operatorId)
        .run()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''

      if (!message.includes('no such column: must_change_password')) {
        throw error
      }

      await env.DB.prepare(
        `
          insert into operators (
            name,
            cpf,
            email,
            password,
            password_hash,
            role,
            active,
            created_by_operator_id,
            updated_at
          )
          values (?1, ?2, ?3, '', ?4, 'manager', 1, ?5, current_timestamp)
        `,
      )
        .bind(body.name, cpf, body.email, secretHash, session.operatorId)
        .run()
    }

    await writeAuditLog(env, session.operatorId, 'create', 'manager', cpf, {
      name: body.name,
      email: body.email,
      temporaryPassword: DEFAULT_FIRST_ACCESS_PASSWORD,
    })

    return ok({
      message: `Gerente ${body.name} cadastrado com senha temporária 0000.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível cadastrar o gerente.'
    return message.includes('UNIQUE constraint failed')
      ? badRequest('Já existe um gerente ou outro acesso com esse CPF ou e-mail.')
      : serverError(message)
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['admin'])

  if (!session) {
    return forbidden('Somente o administrador pode consultar gerentes.')
  }

  return ok(await listManagers(env))
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['admin'])

  if (!session) {
    return forbidden('Somente o administrador pode editar gerentes.')
  }

  const body = (await request.json()) as {
    id?: number
    name?: string
    cpf?: string
    email?: string
    password?: string
  }

  if (!body.id || !body.name || !body.cpf || !body.email) {
    return badRequest('Informe id, nome, CPF e e-mail do gerente.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from operators
      where id = ?1
        and role = 'manager'
        and active = 1
      limit 1
    `,
  )
    .bind(body.id)
    .first()

  if (!existing) {
    return notFound('Gerente não encontrado.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      update operators
      set name = ?1,
          cpf = ?2,
          email = ?3,
          password = case when ?4 != '' then '' else password end,
          password_hash = case when ?4 != '' then ?5 else password_hash end,
          updated_at = current_timestamp
      where id = ?6
    `,
  )
    .bind(body.name, cpf, body.email, body.password ?? '', body.password ? await createSecretHash(body.password) : '', body.id)
    .run()

  await writeAuditLog(env, session.operatorId, 'update', 'manager', String(body.id), {
    name: body.name,
    email: body.email,
  })

  return ok({ message: `Gerente ${body.name} atualizado com sucesso.` })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['admin'])

  if (!session) {
    return forbidden('Somente o administrador pode excluir gerentes.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um gerente válido.')
  }

  const existing = await env.DB.prepare(
    `
      select id, name
      from operators
      where id = ?1
        and role = 'manager'
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Gerente não encontrado.')
  }

  await env.DB.prepare(
    `
      update operators
      set active = 0,
          updated_at = current_timestamp
      where id = ?1
    `,
  )
    .bind(id)
    .run()

  await writeAuditLog(env, session.operatorId, 'delete', 'manager', String(id), {
    name: String(existing.name),
  })

  return ok({ message: `Gerente ${String(existing.name)} desativado com sucesso.` })
}
