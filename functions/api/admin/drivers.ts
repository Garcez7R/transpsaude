import { badRequest, forbidden, listDrivers, ok, requireInternalRole, type Env } from '../_utils'

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
  const session = requireInternalRole(request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem consultar motoristas.')
  }

  const drivers = await listDrivers(env)
  return ok(drivers)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = requireInternalRole(request, ['manager', 'admin'])

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
