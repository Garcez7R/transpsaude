import {
  DEFAULT_FIRST_ACCESS_PASSWORD,
  badRequest,
  createSecretHash,
  forbidden,
  notFound,
  ok,
  requireInternalRole,
  type Env,
  writeAuditLog,
} from '../_utils'

type ResetTarget = 'operator' | 'manager' | 'driver' | 'patient'

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const session = await requireInternalRole(env, request, ['operator', 'manager', 'admin'])

  if (!session) {
    return forbidden('Somente acessos internos autorizados podem redefinir senhas.')
  }

  const body = (await request.json()) as { targetType?: ResetTarget; id?: number }
  const targetType = body.targetType
  const id = Number(body.id ?? 0)

  if (!targetType || !Number.isFinite(id) || id <= 0) {
    return badRequest('Informe um alvo válido para redefinição.')
  }

  if (targetType === 'manager' && session.role !== 'admin') {
    return forbidden('Somente o administrador pode redefinir acessos de gerente.')
  }

  if ((targetType === 'operator' || targetType === 'driver') && !['manager', 'admin'].includes(session.role)) {
    return forbidden('Somente gerente ou administrador podem redefinir esse acesso.')
  }

  if (targetType === 'patient' && !['operator', 'manager', 'admin'].includes(session.role)) {
    return forbidden('Somente operador, gerente ou administrador podem redefinir o acesso do paciente.')
  }

  const defaultHash = await createSecretHash(DEFAULT_FIRST_ACCESS_PASSWORD)

  if (targetType === 'patient') {
    const patient = await env.DB.prepare(
      `
        select id, full_name as name
        from patients
        where id = ?1
          and active = 1
        limit 1
      `,
    )
      .bind(id)
      .first<Record<string, unknown>>()

    if (!patient) {
      return notFound('Paciente não encontrado.')
    }

    await env.DB.prepare(
      `
        update patients
        set temporary_password = '',
            temporary_password_hash = ?1,
            citizen_pin = '',
            citizen_pin_hash = null,
            must_change_pin = 1,
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(defaultHash, id)
      .run()

    await writeAuditLog(env, session.operatorId, 'reset', 'patient_access', String(id), {
      temporaryPassword: DEFAULT_FIRST_ACCESS_PASSWORD,
      name: String(patient.name),
    })

    return ok({ message: `Acesso do paciente ${String(patient.name)} redefinido para 0000.` })
  }

  if (targetType === 'driver') {
    const driver = await env.DB.prepare(
      `
        select id, name
        from drivers
        where id = ?1
          and active = 1
        limit 1
      `,
    )
      .bind(id)
      .first<Record<string, unknown>>()

    if (!driver) {
      return notFound('Motorista não encontrado.')
    }

    try {
      await env.DB.prepare(
        `
          update drivers
          set password = '',
              password_hash = ?1,
              must_change_password = 1,
              updated_at = current_timestamp
          where id = ?2
        `,
      )
        .bind(defaultHash, id)
        .run()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''

      if (!message.includes('no such column: must_change_password')) {
        throw error
      }

      await env.DB.prepare(
        `
          update drivers
          set password = '',
              password_hash = ?1,
              updated_at = current_timestamp
          where id = ?2
        `,
      )
        .bind(defaultHash, id)
        .run()
    }

    await writeAuditLog(env, session.operatorId, 'reset', 'driver_access', String(id), {
      temporaryPassword: DEFAULT_FIRST_ACCESS_PASSWORD,
      name: String(driver.name),
    })

    return ok({ message: `PIN do motorista ${String(driver.name)} redefinido para 0000.` })
  }

  const role = targetType === 'manager' ? 'manager' : 'operator'
  const record = await env.DB.prepare(
    `
      select id, name
      from operators
      where id = ?1
        and role = ?2
        and active = 1
      limit 1
    `,
  )
    .bind(id, role)
    .first<Record<string, unknown>>()

  if (!record) {
    return notFound(targetType === 'manager' ? 'Gerente não encontrado.' : 'Operador não encontrado.')
  }

  try {
    await env.DB.prepare(
      `
        update operators
        set password = '',
            password_hash = ?1,
            must_change_password = 1,
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(defaultHash, id)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    if (!message.includes('no such column: must_change_password')) {
      throw error
    }

    await env.DB.prepare(
      `
        update operators
        set password = '',
            password_hash = ?1,
            updated_at = current_timestamp
        where id = ?2
      `,
    )
      .bind(defaultHash, id)
      .run()
  }

  await writeAuditLog(env, session.operatorId, 'reset', `${targetType}_access`, String(id), {
    temporaryPassword: DEFAULT_FIRST_ACCESS_PASSWORD,
    name: String(record.name),
  })

  return ok({
    message: `${targetType === 'manager' ? 'Senha do gerente' : 'Senha do operador'} ${String(record.name)} redefinida para 0000.`,
  })
}
