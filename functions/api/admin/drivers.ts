import { badRequest, listDrivers, ok, type Env } from '../_utils'

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

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const drivers = await listDrivers(env)
  return ok(drivers)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    name?: string
    cpf?: string
    phone?: string
    isWhatsapp?: boolean
    vehicleName?: string
    password?: string
  }

  if (!body.name || !body.cpf || !body.phone || !body.vehicleName || !body.password) {
    return badRequest('Preencha nome, CPF, telefone, veiculo e senha do motorista.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      insert into drivers (
        name,
        cpf,
        phone,
        is_whatsapp,
        vehicle_name,
        password,
        active
      )
      values (?1, ?2, ?3, ?4, ?5, ?6, 1)
    `,
  )
    .bind(body.name, cpf, body.phone, body.isWhatsapp ? 1 : 0, body.vehicleName, body.password)
    .run()

  const created = await env.DB.prepare(
    `
      select
        id,
        name,
        cpf,
        phone,
        is_whatsapp as isWhatsapp,
        vehicle_name as vehicleName,
        active
      from drivers
      where cpf = ?1
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
