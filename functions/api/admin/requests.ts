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
    accessCpf?: string
    useResponsibleCpfForAccess?: boolean
    responsibleName?: string
    responsibleCpf?: string
    companionName?: string
    companionCpf?: string
    destinationCity?: string
    destinationState?: string
    treatmentUnit?: string
    specialty?: string
    travelDate?: string
    companionRequired?: boolean
    notes?: string
  }

  if (!body.patientName || !body.cpf || !body.accessCpf || !body.destinationCity || !body.destinationState || !body.treatmentUnit || !body.specialty || !body.travelDate) {
    return badRequest('Preencha os campos obrigatorios da solicitacao.')
  }

  if (body.useResponsibleCpfForAccess && (!body.responsibleName || !body.responsibleCpf)) {
    return badRequest('Informe nome e CPF do responsavel quando esse CPF for usado para acesso.')
  }

  if (body.companionRequired && (!body.companionName || !body.companionCpf)) {
    return badRequest('Informe nome e CPF do acompanhante quando houver acompanhante.')
  }

  const protocol = buildProtocol()
  const patientCpf = normalizeCpf(body.cpf)
  const patientCpfMasked = maskCpf(patientCpf)
  const accessCpf = normalizeCpf(body.accessCpf)
  const accessCpfMasked = maskCpf(accessCpf)
  const responsibleCpf = normalizeCpf(body.responsibleCpf ?? '')
  const responsibleCpfMasked = responsibleCpf ? maskCpf(responsibleCpf) : ''
  const companionCpf = normalizeCpf(body.companionCpf ?? '')
  const companionCpfMasked = companionCpf ? maskCpf(companionCpf) : ''

  if (!env.DB) {
    throw new Error('DB binding nao configurado.')
  }

  const patient = await env.DB.prepare(
    `
      select id
      from patients
      where cpf = ?1
      limit 1
    `,
  )
    .bind(patientCpf)
    .first<Record<string, unknown>>()

  let patientId = patient?.id

  if (!patientId) {
    const createdPatient = await env.DB.prepare(
      `
        insert into patients (
          full_name,
          cpf,
          cpf_masked,
          access_cpf,
          access_cpf_masked,
          cns,
          phone,
          city,
          state,
          responsible_name,
          responsible_cpf,
          responsible_cpf_masked,
          use_responsible_cpf_for_access,
          temporary_password,
          must_change_pin
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'Capao do Leao', 'RS', ?8, ?9, ?10, ?11, '0000', 1)
        returning id
      `,
    )
      .bind(
        body.patientName,
        patientCpf,
        patientCpfMasked,
        accessCpf,
        accessCpfMasked,
        body.cns ?? '',
        body.phone ?? '',
        body.responsibleName ?? '',
        responsibleCpf,
        responsibleCpfMasked,
        body.useResponsibleCpfForAccess ? 1 : 0,
      )
      .first<Record<string, unknown>>()

    patientId = createdPatient?.id
  } else {
    await env.DB.prepare(
      `
        update patients
        set full_name = ?1,
            cpf_masked = ?2,
            access_cpf = ?3,
            access_cpf_masked = ?4,
            cns = ?5,
            phone = ?6,
            responsible_name = ?7,
            responsible_cpf = ?8,
            responsible_cpf_masked = ?9,
            use_responsible_cpf_for_access = ?10,
            updated_at = current_timestamp
        where id = ?11
      `,
    )
      .bind(
        body.patientName,
        patientCpfMasked,
        accessCpf,
        accessCpfMasked,
        body.cns ?? '',
        body.phone ?? '',
        body.responsibleName ?? '',
        responsibleCpf,
        responsibleCpfMasked,
        body.useResponsibleCpfForAccess ? 1 : 0,
        patientId,
      )
      .run()
  }

  await env.DB.prepare(
    `
      insert into travel_requests (
        protocol,
        protocol_pin,
        patient_id,
        patient_name,
        cpf_masked,
        access_cpf_masked,
        companion_name,
        companion_cpf_masked,
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
      values (?1, '0000', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, date('now'), ?12, 'recebida', ?13, ?14, 2)
    `,
  )
    .bind(
      protocol,
      patientId,
      body.patientName,
      patientCpfMasked,
      accessCpfMasked,
      body.companionName ?? '',
      companionCpfMasked,
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
    message: `Solicitacao salva. O acesso inicial fica no CPF ${accessCpfMasked} com senha 0000.`,
  })
}
