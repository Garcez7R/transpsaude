import { badRequest, forbidden, listVehicles, notFound, ok, requireInternalRole, type Env, writeAuditLog } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem consultar veículos.')
  }

  const vehicles = await listVehicles(env)
  return ok(vehicles)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem cadastrar veículos.')
  }

  const body = (await request.json()) as {
    name?: string
    plate?: string
    category?: string
  }

  if (!body.name || !body.plate || !body.category) {
    return badRequest('Preencha nome, placa e categoria do veículo.')
  }

  await env.DB.prepare(
    `
      insert into vehicles (
        name,
        plate,
        category,
        active
      )
      values (?1, ?2, ?3, 1)
    `,
  )
    .bind(body.name, body.plate.toUpperCase(), body.category)
    .run()

  const created = await env.DB.prepare(
    `
      select
        id,
        name,
        plate,
        category,
        active
      from vehicles
      where plate = ?1
      limit 1
    `,
  )
    .bind(body.plate.toUpperCase())
    .first<Record<string, unknown>>()

  await writeAuditLog(env, session.operatorId, 'create', 'vehicle', String(created?.id ?? body.plate.toUpperCase()), {
    name: body.name,
    plate: body.plate.toUpperCase(),
    category: body.category,
  })

  return ok({
    ...created,
    active: Boolean(created?.active),
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem editar veículos.')
  }

  const body = (await request.json()) as {
    id?: number
    name?: string
    plate?: string
    category?: string
  }

  if (!body.id || !body.name || !body.plate || !body.category) {
    return badRequest('Informe id, nome, placa e categoria do veículo.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.id)
    .first()

  if (!existing) {
    return notFound('Veículo não encontrado.')
  }

  await env.DB.prepare(
    `
      update vehicles
      set name = ?1,
          plate = ?2,
          category = ?3,
          updated_at = current_timestamp
      where id = ?4
    `,
  )
    .bind(body.name, body.plate.toUpperCase(), body.category, body.id)
    .run()

  await env.DB.prepare(
    `
      update drivers
      set vehicle_name = ?1,
          updated_at = current_timestamp
      where vehicle_id = ?2
    `,
  )
    .bind(body.name, body.id)
    .run()

  await writeAuditLog(env, session.operatorId, 'update', 'vehicle', String(body.id), {
    name: body.name,
    plate: body.plate.toUpperCase(),
    category: body.category,
  })

  return ok({ message: `Veículo ${body.name} atualizado com sucesso.` })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem excluir veículos.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um veículo válido.')
  }

  const existing = await env.DB.prepare(
    `
      select id, name
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Veículo não encontrado.')
  }

  const linkedDrivers = await env.DB.prepare(
    `
      select count(*) as total
      from drivers
      where vehicle_id = ?1
        and active = 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (Number(linkedDrivers?.total ?? 0) > 0) {
    return badRequest('Desvincule os motoristas antes de excluir este veículo.')
  }

  await env.DB.prepare(
    `
      update vehicles
      set active = 0,
          updated_at = current_timestamp
      where id = ?1
    `,
  )
    .bind(id)
    .run()

  await writeAuditLog(env, session.operatorId, 'delete', 'vehicle', String(id), {
    name: String(existing.name),
  })

  return ok({ message: `Veículo ${String(existing.name)} desativado com sucesso.` })
}
