import { badRequest, forbidden, listPatients, notFound, ok, requireInternalRole, type Env } from '../_utils'

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
    return forbidden('Somente gerente ou administrador podem consultar pacientes.')
  }

  return ok(await listPatients(env))
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem editar pacientes.')
  }

  const body = (await request.json()) as {
    id?: number
    fullName?: string
    cpf?: string
    accessCpf?: string
    phone?: string
    isWhatsapp?: boolean
    addressLine?: string
    cns?: string
    responsibleName?: string
    responsibleCpf?: string
    useResponsibleCpfForAccess?: boolean
  }

  if (!body.id || !body.fullName || !body.cpf || !body.accessCpf || !body.phone || !body.addressLine) {
    return badRequest('Informe os campos obrigatórios do paciente.')
  }

  const existing = await env.DB.prepare(
    `
      select id
      from patients
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(body.id)
    .first()

  if (!existing) {
    return notFound('Paciente não encontrado.')
  }

  const patientCpf = normalizeCpf(body.cpf)
  const accessCpf = normalizeCpf(body.accessCpf)
  const responsibleCpf = normalizeCpf(body.responsibleCpf ?? '')

  await env.DB.prepare(
    `
      update patients
      set full_name = ?1,
          cpf = ?2,
          cpf_masked = ?3,
          access_cpf = ?4,
          access_cpf_masked = ?5,
          phone = ?6,
          is_whatsapp = ?7,
          address_line = ?8,
          cns = ?9,
          responsible_name = ?10,
          responsible_cpf = ?11,
          responsible_cpf_masked = ?12,
          use_responsible_cpf_for_access = ?13,
          active = 1,
          updated_at = current_timestamp
      where id = ?14
    `,
  )
    .bind(
      body.fullName,
      patientCpf,
      maskCpf(patientCpf),
      accessCpf,
      maskCpf(accessCpf),
      body.phone,
      body.isWhatsapp ? 1 : 0,
      body.addressLine,
      body.cns ?? '',
      body.responsibleName ?? '',
      responsibleCpf,
      responsibleCpf ? maskCpf(responsibleCpf) : '',
      body.useResponsibleCpfForAccess ? 1 : 0,
      body.id,
    )
    .run()

  return ok({ message: `Paciente ${body.fullName} atualizado com sucesso.` })
}

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['manager', 'admin'])

  if (!session) {
    return forbidden('Somente gerente ou administrador podem excluir pacientes.')
  }

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id') ?? '')

  if (!Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um paciente válido.')
  }

  const existing = await env.DB.prepare(
    `
      select id, full_name as fullName
      from patients
      where id = ?1
        and active = 1
      limit 1
    `,
  )
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing) {
    return notFound('Paciente não encontrado.')
  }

  await env.DB.prepare(
    `
      update patients
      set active = 0,
          updated_at = current_timestamp
      where id = ?1
    `,
  )
    .bind(id)
    .run()

  return ok({ message: `Paciente ${String(existing.fullName)} desativado com sucesso.` })
}
