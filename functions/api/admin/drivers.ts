import {
  DEFAULT_FIRST_ACCESS_PASSWORD,
  badRequest,
  createSecretHash,
  forbidden,
  listDrivers,
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
  try {
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
    }

    if (!body.name || !body.cpf || !body.phone || !body.vehicleId) {
      return badRequest('Preencha nome, CPF, telefone e veículo do motorista.')
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
          password_hash,
          must_change_password,
          active
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, '', ?7, 1, 1)
      `,
    )
      .bind(
        body.name,
        cpf,
        body.phone,
        body.isWhatsapp ? 1 : 0,
        vehicle.id,
        vehicle.name,
        await createSecretHash(DEFAULT_FIRST_ACCESS_PASSWORD),
      )
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

    await writeAuditLog(env, session.operatorId, 'create', 'driver', cpf, {
      name: body.name,
      vehicleName: String(vehicle.name),
      temporaryPassword: DEFAULT_FIRST_ACCESS_PASSWORD,
    })

    return ok({
      ...created,
      cpfMasked: maskCpf(cpf),
      isWhatsapp: Boolean(created?.isWhatsapp),
      active: Boolean(created?.active),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível cadastrar o motorista.'
    return message.includes('UNIQUE constraint failed')
      ? badRequest('Já existe um motorista com esse CPF.')
      : serverError(message)
  }
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
          password = case when ?7 != '' then '' else password end,
          password_hash = case when ?7 != '' then ?8 else password_hash end,
          updated_at = current_timestamp
      where id = ?9
    `,
  )
    .bind(
      body.name,
      cpf,
      body.phone,
      body.isWhatsapp ? 1 : 0,
      vehicle.id,
      vehicle.name,
      body.password ?? '',
      body.password ? await createSecretHash(body.password) : '',
      body.id,
    )
    .run()

  await writeAuditLog(env, session.operatorId, 'update', 'driver', String(body.id), {
    name: body.name,
    vehicleName: String(vehicle.name),
  })

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

  await writeAuditLog(env, session.operatorId, 'delete', 'driver', String(id), {
    name: String(existing.name),
  })

  return ok({ message: `Motorista ${String(existing.name)} desativado com sucesso.` })
}
