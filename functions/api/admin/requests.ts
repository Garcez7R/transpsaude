import {
  badRequest,
  createSecretHash,
  forbidden,
  ok,
  requireInternalRole,
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
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Acesso interno obrigatório para cadastrar solicitações.')
  }

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
    appointmentTime?: string
    companionRequired?: boolean
    notes?: string
  }

  if (!body.patientName || !body.cpf || !body.phone || !body.addressLine || !body.accessCpf || !body.destinationCity || !body.destinationState || !body.treatmentUnit || !body.specialty || !body.travelDate || !body.appointmentTime) {
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
  const temporaryPasswordHash = await createSecretHash('0000')
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
        and active = 1
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
          temporary_password_hash,
          citizen_pin,
          citizen_pin_hash,
          must_change_pin
        )
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Capao do Leao', 'RS', ?10, ?11, ?12, ?13, '', ?14, '', null, 1)
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
        temporaryPasswordHash,
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
            temporary_password = '',
            temporary_password_hash = ?13,
            citizen_pin = '',
            citizen_pin_hash = null,
            must_change_pin = 1,
            active = 1,
            updated_at = current_timestamp
        where id = ?14
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
        temporaryPasswordHash,
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
        appointment_time,
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
        ?16,
        'agendada',
        ?17,
        ?18,
        ?19
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
      body.appointmentTime,
      body.companionRequired ? 1 : 0,
      body.notes ?? '',
      session.operatorId,
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

  await writeAuditLog(env, session.operatorId, 'create', 'travel_request', protocol, {
    requestId: createdRequest?.id ?? null,
    patientName: body.patientName,
    destinationCity: body.destinationCity,
    treatmentUnit: body.treatmentUnit,
    travelDate: body.travelDate,
    appointmentTime: body.appointmentTime,
  })

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
        values (?1, ?2, 'agendada', 'Agendada', 'Solicitação cadastrada e confirmada pelo painel interno.', ?3, datetime('now'), 1)
      `,
    )
      .bind(createdRequest.id, protocol, session.operatorId)
      .run()
  }

  return ok({
    protocol,
    temporaryPassword: '0000',
    status: 'agendada',
    message: `Solicitação salva. O acesso inicial fica no CPF ${accessCpfMasked} com senha 0000.`,
  })
}
