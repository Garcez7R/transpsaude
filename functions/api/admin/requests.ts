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
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0')

  return `TS-${date}-${time}-${suffix}`
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const body = (await request.json()) as {
    patientName?: string
    cpf?: string
    cns?: string
    phone?: string
    isWhatsapp?: boolean
    addressLine?: string
    accessCpf?: string
    useResponsibleCpfForAccess?: boolean
    responsibleName?: string
    responsibleCpf?: string
    companionName?: string
    companionCpf?: string
    companionPhone?: string
    companionIsWhatsapp?: boolean
    usePatientAddressForCompanion?: boolean
    companionAddressLine?: string
    destinationCity?: string
    destinationState?: string
    treatmentUnit?: string
    specialty?: string
    travelDate?: string
    companionRequired?: boolean
    notes?: string
  }

  if (!body.patientName || !body.cpf || !body.phone || !body.addressLine || !body.accessCpf || !body.destinationCity || !body.destinationState || !body.treatmentUnit || !body.specialty || !body.travelDate) {
    return badRequest('Preencha os campos obrigatórios da solicitação.')
  }

  if (body.useResponsibleCpfForAccess && (!body.responsibleName || !body.responsibleCpf)) {
    return badRequest('Informe nome e CPF do responsável quando esse CPF for usado para acesso.')
  }

  if (
    body.companionRequired &&
    (!body.companionName ||
      !body.companionCpf ||
      !body.companionPhone ||
      (!body.usePatientAddressForCompanion && !body.companionAddressLine))
  ) {
    return badRequest('Informe nome, CPF, telefone e endereço do acompanhante quando houver acompanhante.')
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
    throw new Error('Binding do banco D1 não configurado.')
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
          is_whatsapp,
          address_line,
          city,
          state,
          responsible_name,
          responsible_cpf,
          responsible_cpf_masked,
          use_responsible_cpf_for_access,
          temporary_password,
          citizen_pin,
          must_change_pin
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Capao do Leao', 'RS', ?10, ?11, ?12, ?13, '0000', null, 1)
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
        body.phone,
        body.isWhatsapp ? 1 : 0,
        body.addressLine,
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
            is_whatsapp = ?7,
            address_line = ?8,
            responsible_name = ?9,
            responsible_cpf = ?10,
            responsible_cpf_masked = ?11,
            use_responsible_cpf_for_access = ?12,
            temporary_password = '0000',
            citizen_pin = null,
            must_change_pin = 1,
            updated_at = current_timestamp
        where id = ?13
      `,
    )
      .bind(
        body.patientName,
        patientCpfMasked,
        accessCpf,
        accessCpfMasked,
        body.cns ?? '',
        body.phone,
        body.isWhatsapp ? 1 : 0,
        body.addressLine,
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
        companion_phone,
        companion_is_whatsapp,
        companion_address_line,
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
      values (
        ?1,
        '0000',
        ?2,
        ?3,
        ?4,
        ?5,
        ?6,
        ?7,
        ?8,
        ?9,
        ?10,
        ?11,
        ?12,
        ?13,
        ?14,
        date('now'),
        ?15,
        'recebida',
        ?16,
        ?17,
        2
      )
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
      body.companionPhone ?? '',
      body.companionIsWhatsapp ? 1 : 0,
      body.usePatientAddressForCompanion ? body.addressLine : body.companionAddressLine ?? '',
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
        values (?1, ?2, 'recebida', 'Recebida', 'Solicitação cadastrada pelo painel interno.', 2, datetime('now'), 1)
      `,
    )
      .bind(createdRequest.id, protocol)
      .run()
  }

  return ok({
    protocol,
    temporaryPassword: '0000',
    status: 'recebida',
    message: `Solicitação salva. O acesso inicial fica no CPF ${accessCpfMasked} com senha 0000.`,
  })
}
