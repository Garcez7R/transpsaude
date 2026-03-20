import { badRequest, forbidden, ok, requireInternalRole, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = requireInternalRole(request, ['manager', 'admin'])

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
