import { badRequest, forbidden, listDrivers, notFound, ok, requireInternalRole, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

function maskCpf(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem consultar motoristas.')
  }

  const drivers = await listDrivers(env)
  return ok(drivers)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem cadastrar motoristas.')
  }

  const body = (await request.json()) as {
    name?: string
    cpf?: string
    phone?: string
    isWhatsapp?: boolean
    vehicleId?: number
    password?: string
  }

  if (!body.name || !body.cpf || !body.phone || !body.vehicleId || !body.password) {
    return badRequest('Preencha nome, CPF, telefone, veículo e senha do motorista.')
  }

  const cpf = normalizeCpf(body.cpf)
  const vehicle = await env.DB.prepare(
    `
      select id, name
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.vehicleId)
    .first<Record<string, unknown>>()

  if (!vehicle) {
    return badRequest('Veículo não encontrado.')
  }

  await env.DB.prepare(
    `
      insert into drivers (
        name,
        cpf,
        phone,
        is_whatsapp,
        vehicle_id,
        vehicle_name,
        password,
        active
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
    `,
  )
    .bind(body.name, cpf, body.phone, body.isWhatsapp ? 1 : 0, vehicle.id, vehicle.name, body.password)
    .run()

  const created = await env.DB.prepare(
    `
      select
        d.id,
        d.name,
        d.cpf,
        d.phone,
        d.is_whatsapp as isWhatsapp,
        d.vehicle_id as vehicleId,
        coalesce(v.name, d.vehicle_name) as vehicleName,
        d.active
      from drivers d
      left join vehicles v on v.id = d.vehicle_id
      where d.cpf = ?1
      limit 1
    `,
  )
    .bind(cpf)
    .first<Record<string, unknown>>()

  return ok({
    ...created,
    cpfMasked: maskCpf(cpf),
    isWhatsapp: Boolean(created?.isWhatsapp),
    active: Boolean(created?.active),
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem editar motoristas.')
  }

  const body = (await request.json()) as {
    id?: number
    name?: string
    cpf?: string
    phone?: string
    isWhatsapp?: boolean
    vehicleId?: number
    password?: string
  }

  if (!body.id || !body.name || !body.cpf || !body.phone || !body.vehicleId) {
    return badRequest('Informe id, nome, CPF, telefone e veículo do motorista.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from drivers
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.id)
    .first()

  if (!existing) {
    return notFound('Motorista não encontrado.')
  }

  const vehicle = await env.DB.prepare(
    `
      select id, name
      from vehicles
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.vehicleId)
    .first<Record<string, unknown>>()

  if (!vehicle) {
    return badRequest('Veículo não encontrado.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      update drivers
      set name = ?1,
          cpf = ?2,
          phone = ?3,
          is_whatsapp = ?4,
          vehicle_id = ?5,
          vehicle_name = ?6,
          password = case when ?7 != '' then ?7 else password end,
          updated_at = current_timestamp
      where id = ?8
    `,
  )
    .bind(body.name, cpf, body.phone, body.isWhatsapp ? 1 : 0, vehicle.id, vehicle.name, body.password ?? '', body.id)
    .run()

  return ok({ message: `Motorista ${body.name} atualizado com sucesso.` })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem excluir motoristas.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um motorista válido.')
  }

  const existing = await env.DB.prepare(
    `
      select id, name
      from drivers
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Motorista não encontrado.')
  }

  await env.DB.prepare(
    `
      update drivers
      set active = 0,
          updated_at = current_timestamp
      where id = ?1
    `,
  )
    .bind(id)
    .run()

  return ok({ message: `Motorista ${String(existing.name)} desativado com sucesso.` })
}
