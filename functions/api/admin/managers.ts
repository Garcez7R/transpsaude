import { badRequest, ok, type Env } from '../_utils'

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    name?: string
    cpf?: string
    email?: string
    password?: string
  }

  if (!body.name || !body.cpf || !body.email || !body.password) {
    return badRequest('Preencha nome, CPF, email e senha do gerente.')
  }

  const cpf = normalizeCpf(body.cpf)

  await env.DB.prepare(
    `
      insert into operators (
        name,
        cpf,
        email,
        password,
        role
      )
      values (?1, ?2, ?3, ?4, 'manager')
    `,
  )
    .bind(body.name, cpf, body.email, body.password)
    .run()

  return ok({
    message: `Gerente ${body.name} cadastrado com sucesso.`,
  })
}
