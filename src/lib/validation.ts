/**
 * Validações de formulário e utilitários de validação
 */

/**
 * Valida se uma data é válida e está no formato YYYY-MM-DD
 */
export function isValidDate(value: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(value + 'T00:00:00')
  return !isNaN(date.getTime())
}

/**
 * Valida se uma data é hoje ou futura (não permite datas passadas)
 */
export function isTodayOrFuture(value: string): boolean {
  if (!isValidDate(value)) {
    return false
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(value + 'T00:00:00')
  return date >= today
}

/**
 * Valida se uma data é passada (antes de hoje)
 */
export function isPastDate(value: string): boolean {
  if (!isValidDate(value)) {
    return false
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(value + 'T00:00:00')
  return date < today
}

/**
 * Valida um horário no formato HH:MM
 */
export function isValidTime(value: string): boolean {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return false
  }
  return true
}

/**
 * Valida se o horário de saída é anterior ao horário da consulta
 * (faz sentido lógico: sair antes para chegar na consulta)
 */
export function isDepartureBeforeAppointment(departureTime: string, appointmentTime: string): boolean {
  if (!isValidTime(departureTime) || !isValidTime(appointmentTime)) {
    return true // Se inválidos, não bloqueia (outra validação cuidará disso)
  }
  return departureTime <= appointmentTime
}

/**
 * Valida CPF (apenas dígitos e tamanho)
 */
export function isValidCpfLength(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11
}

/**
 * Valida telefone (mínimo 10 dígitos para fixo, 11 para celular)
 */
export function isValidPhoneLength(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

/**
 * Valida PIN de 4 dígitos
 */
export function isValidPin(value: string): boolean {
  return /^\d{4}$/.test(value)
}

/**
 * Mensagens de erro específicas para validações
 */
export const validationMessages = {
  dateRequired: 'Informe a data da viagem.',
  dateInvalid: 'Data inválida. Use o formato DD/MM/AAAA.',
  datePast: 'A data da viagem não pode ser uma data passada.',
  dateTodayOrFuture: 'A data deve ser hoje ou uma data futura.',
  timeRequired: 'Informe o horário.',
  timeInvalid: 'Horário inválido. Use o formato HH:MM.',
  departureAfterAppointment: 'O horário de saída deve ser anterior ao horário da consulta.',
  cpfRequired: 'Informe o CPF.',
  cpfInvalid: 'CPF inválido. Deve conter 11 dígitos.',
  phoneRequired: 'Informe o telefone.',
  phoneInvalid: 'Telefone inválido. Deve conter DDD + número.',
  pinRequired: 'Informe o PIN.',
  pinInvalid: 'PIN inválido. Deve conter 4 dígitos numéricos.',
  fieldRequired: 'Campo obrigatório.',
  emailInvalid: 'E-mail inválido.',
}

/**
 * Valida formulário de viagem completo
 */
export interface TravelRequestValidationErrors {
  travelDate?: string
  appointmentTime?: string
  departureTime?: string
  patientName?: string
  cpf?: string
  phone?: string
  addressLine?: string
  destinationCity?: string
  treatmentUnit?: string
  specialty?: string
}

export function validateTravelRequestForm(form: {
  travelDate: string
  appointmentTime: string
  departureTime: string
  patientName: string
  cpf: string
  phone: string
  addressLine: string
  destinationCity: string
  treatmentUnit: string
  specialty: string
}): TravelRequestValidationErrors {
  const errors: TravelRequestValidationErrors = {}

  // Data da viagem
  if (!form.travelDate) {
    errors.travelDate = validationMessages.dateRequired
  } else if (!isValidDate(form.travelDate)) {
    errors.travelDate = validationMessages.dateInvalid
  } else if (isPastDate(form.travelDate)) {
    errors.travelDate = validationMessages.datePast
  }

  // Horário da consulta
  if (!form.appointmentTime) {
    errors.appointmentTime = validationMessages.timeRequired
  } else if (!isValidTime(form.appointmentTime)) {
    errors.appointmentTime = validationMessages.timeInvalid
  }

  // Horário de saída (opcional, mas se preenchido deve ser antes da consulta)
  if (form.departureTime && form.appointmentTime) {
    if (!isValidTime(form.departureTime)) {
      errors.departureTime = validationMessages.timeInvalid
    } else if (!isDepartureBeforeAppointment(form.departureTime, form.appointmentTime)) {
      errors.departureTime = validationMessages.departureAfterAppointment
    }
  }

  // Nome do paciente
  if (!form.patientName.trim()) {
    errors.patientName = validationMessages.fieldRequired
  }

  // CPF
  if (!form.cpf) {
    errors.cpf = validationMessages.cpfRequired
  } else if (!isValidCpfLength(form.cpf)) {
    errors.cpf = validationMessages.cpfInvalid
  }

  // Telefone
  if (!form.phone) {
    errors.phone = validationMessages.phoneRequired
  } else if (!isValidPhoneLength(form.phone)) {
    errors.phone = validationMessages.phoneInvalid
  }

  // Endereço
  if (!form.addressLine.trim()) {
    errors.addressLine = validationMessages.fieldRequired
  }

  // Cidade de destino
  if (!form.destinationCity.trim()) {
    errors.destinationCity = validationMessages.fieldRequired
  }

  // Unidade de tratamento
  if (!form.treatmentUnit.trim()) {
    errors.treatmentUnit = validationMessages.fieldRequired
  }

  // Especialidade
  if (!form.specialty.trim()) {
    errors.specialty = validationMessages.fieldRequired
  }

  return errors
}

/**
 * Verifica se há erros no formulário
 */
export function hasValidationErrors(errors: TravelRequestValidationErrors): boolean {
  return Object.keys(errors).length > 0
}