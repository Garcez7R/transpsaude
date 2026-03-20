import { badRequest, ok, type Env } from '../_utils'

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

function buildProtocol() {
  const timestamp = Date.now().toString().slice(-6)
  return `TS-2026-${timestamp}`
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    patientName?: string
    cpf?: string
    cns?: string
    phone?: string
    destinationCity?: string
    destinationState?: string
    treatmentUnit?: string
    specialty?: string
    travelDate?: string
    companionRequired?: boolean
    notes?: string
  }

  if (!body.patientName || !body.cpf || !body.destinationCity || !body.destinationState || !body.treatmentUnit || !body.specialty || !body.travelDate) {
    return badRequest('Preencha os campos obrigatorios da solicitacao.')
  }

  const protocol = buildProtocol()
  const cpf = normalizeCpf(body.cpf)
  const cpfMasked = maskCpf(cpf)

  if (!env.DB) {
    return ok({
      protocol,
      temporaryPassword: '0000',
      status: 'recebida',
      message: `Solicitacao simulada para ${body.patientName}. O cidadao acessa com CPF ${cpfMasked} e senha 0000 no primeiro login.`,
    })
  }

  const patient = await env.DB.prepare(
    `
      select id
      from patients
      where cpf = ?1
      limit 1
    `,
  )
    .bind(cpf)
    .first<Record<string, unknown>>()

  let patientId = patient?.id

  if (!patientId) {
    const createdPatient = await env.DB.prepare(
      `
        insert into patients (
          full_name,
          cpf,
          cpf_masked,
          cns,
          phone,
          city,
          state,
          temporary_password,
          must_change_pin
        )
        values (?1, ?2, ?3, ?4, ?5, 'Capao do Leao', 'RS', '0000', 1)
        returning id
      `,
    )
      .bind(body.patientName, cpf, cpfMasked, body.cns ?? '', body.phone ?? '')
      .first<Record<string, unknown>>()

    patientId = createdPatient?.id
  }

  await env.DB.prepare(
    `
      insert into travel_requests (
        protocol,
        protocol_pin,
        patient_id,
        patient_name,
        cpf_masked,
        destination_city,
        destination_state,
        treatment_unit,
        specialty,
        requested_at,
        travel_date,
        status,
        companion_required,
        notes,
        created_by_operator_id
      )
      values (?1, '0000', ?2, ?3, ?4, ?5, ?6, ?7, ?8, date('now'), ?9, 'recebida', ?10, ?11, 2)
    `,
  )
    .bind(
      protocol,
      patientId,
      body.patientName,
      cpfMasked,
      body.destinationCity,
      body.destinationState,
      body.treatmentUnit,
      body.specialty,
      body.travelDate,
      body.companionRequired ? 1 : 0,
      body.notes ?? '',
    )
    .run()

  const createdRequest = await env.DB.prepare(
    `
      select id
      from travel_requests
      where protocol = ?1
      limit 1
    `,
  )
    .bind(protocol)
    .first<Record<string, unknown>>()

  if (createdRequest?.id) {
    await env.DB.prepare(
      `
        insert into request_status_history (
          travel_request_id,
          protocol,
          status,
          label,
          note,
          updated_by_operator_id,
          updated_at,
          sort_order
        )
        values (?1, ?2, 'recebida', 'Recebida', 'Solicitacao cadastrada pelo painel interno.', 2, datetime('now'), 1)
      `,
    )
      .bind(createdRequest.id, protocol)
      .run()
  }

  return ok({
    protocol,
    temporaryPassword: '0000',
    status: 'recebida',
    message: `Solicitacao salva. O cidadao acessa com CPF ${cpfMasked} e senha 0000 no primeiro login.`,
  })
}
