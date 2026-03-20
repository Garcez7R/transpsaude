import { badRequest, forbidden, listOperators, notFound, ok, requireInternalRole, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem cadastrar operadores.')
  }

  const body = (await request.json()) as {
    name?: string
    cpf?: string
    email?: string
    password?: string
  }

  if (!body.name || !body.cpf || !body.email || !body.password) {
    return badRequest('Preencha nome, CPF, email e senha do operador.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      insert into operators (
        name,
        cpf,
        email,
        password,
        role,
        active,
        created_by_operator_id,
        updated_at
      )
      values (?1, ?2, ?3, ?4, 'operator', 1, ?5, current_timestamp)
    `,
  )
    .bind(body.name, cpf, body.email, body.password, session.operatorId)
    .run()

  return ok({
    message: `Operador ${body.name} cadastrado com sucesso.`,
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem consultar operadores.')
  }

  return ok(await listOperators(env))
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem editar operadores.')
  }

  const body = (await request.json()) as {
    id?: number
    name?: string
    cpf?: string
    email?: string
    password?: string
  }

  if (!body.id || !body.name || !body.cpf || !body.email) {
    return badRequest('Informe id, nome, CPF e e-mail do operador.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from operators
      where id = ?1
        and role = 'operator'
        and active = 1
      limit 1
    `,
  )
    .bind(body.id)
    .first()

  if (!existing) {
    return notFound('Operador não encontrado.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      update operators
      set name = ?1,
          cpf = ?2,
          email = ?3,
          password = case when ?4 != '' then ?4 else password end,
          updated_at = current_timestamp
      where id = ?5
    `,
  )
    .bind(body.name, cpf, body.email, body.password ?? '', body.id)
    .run()

  return ok({ message: `Operador ${body.name} atualizado com sucesso.` })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem excluir operadores.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um operador válido.')
  }

  const existing = await env.DB.prepare(
    `
      select id, name
      from operators
      where id = ?1
        and role = 'operator'
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Operador não encontrado.')
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

  return ok({ message: `Operador ${String(existing.name)} desativado com sucesso.` })
}
