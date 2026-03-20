import { badRequest, listVehicles, ok, type Env } from '../_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const vehicles = await listVehicles(env)
  return ok(vehicles)
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    name?: string
    plate?: string
    category?: string
  }

  if (!body.name || !body.plate || !body.category) {
    return badRequest('Preencha nome, placa e categoria do veiculo.')
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

  return ok({
    ...created,
    active: Boolean(created?.active),
  })
}
