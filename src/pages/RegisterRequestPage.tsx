import { ArrowLeft, CheckCircle2, FilePlus2, Route, Search, ShieldCheck, UserRoundSearch, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AsyncActionButton } from '../components/AsyncActionButton'
import { InternalSidebar } from '../components/InternalSidebar'
import { createTravelRequest, fetchPatients, logoutSession } from '../lib/api'
import { canAccessOperator } from '../lib/access'
import { clearOperatorSession, getOperatorSession } from '../lib/operator-session'
import { toInstitutionalText, toTitleCase } from '../lib/text-format'
import { useToastOnChange } from '../lib/use-toast-on-change'
import type { CreateTravelRequestInput, PatientRecord } from '../types'

const initialForm: CreateTravelRequestInput = {
  patientName: '',
  cpf: '',
  cns: '',
  phone: '',
  isWhatsapp: false,
  addressLine: '',
  accessCpf: '',
  useResponsibleCpfForAccess: false,
  responsibleName: '',
  responsibleCpf: '',
  companionName: '',
  companionCpf: '',
  companionPhone: '',
  companionIsWhatsapp: false,
  usePatientAddressForCompanion: true,
  companionAddressLine: '',
  destinationCity: '',
  destinationState: 'RS',
  treatmentUnit: '',
  specialty: '',
  travelDate: '',
  appointmentTime: '',
  companionRequired: false,
  notes: '',
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }

  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function RegisterRequestPage() {
  const [session, setSession] = useState(() => (typeof window !== 'undefined' ? getOperatorSession() : null))
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [success, setSuccess] = useState<{ protocol: string; message: string } | null>(null)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [lookupMessage, setLookupMessage] = useState('')
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle')
  const [step, setStep] = useState(0)

  useToastOnChange(error, 'error')
  useToastOnChange(copyMessage, 'success')
  useToastOnChange(success?.message, 'success')

  function updateField<K extends keyof CreateTravelRequestInput>(key: K, value: CreateTravelRequestInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const steps = [
    { id: 'paciente', label: 'Paciente' },
    { id: 'acesso', label: 'Acesso' },
    { id: 'acompanhante', label: 'Acompanhante' },
    { id: 'destino', label: 'Destino' },
    { id: 'observacoes', label: 'Observações' },
  ]
  const lastStep = steps.length - 1

  function canAdvanceStep(currentStep: number) {
    const cpfLength = form.cpf.replace(/\D/g, '').length
    const phoneLength = form.phone.replace(/\D/g, '').length
    const responsibleCpfLength = form.responsibleCpf.replace(/\D/g, '').length
    const accessCpfLength = form.accessCpf.replace(/\D/g, '').length
    const companionCpfLength = form.companionCpf.replace(/\D/g, '').length
    const companionPhoneLength = form.companionPhone.replace(/\D/g, '').length

    if (currentStep === 0) {
      return Boolean(form.patientName.trim())
        && cpfLength === 11
        && phoneLength >= 10
        && Boolean(form.addressLine.trim())
    }

    if (currentStep === 1) {
      if (form.useResponsibleCpfForAccess) {
        return Boolean(form.responsibleName.trim()) && responsibleCpfLength === 11
      }
      return accessCpfLength === 11
    }

    if (currentStep === 2) {
      if (!form.companionRequired) {
        return true
      }
      return Boolean(form.companionName.trim())
        && companionCpfLength === 11
        && companionPhoneLength >= 10
    }

    if (currentStep === 3) {
      return Boolean(form.destinationCity.trim())
        && Boolean(form.destinationState.trim())
        && Boolean(form.treatmentUnit.trim())
        && Boolean(form.specialty.trim())
        && Boolean(form.travelDate)
        && Boolean(form.appointmentTime)
    }

    return true
  }

  function handleStepAdvance() {
    if (!canAdvanceStep(step)) {
      return
    }
    setStep((current) => Math.min(current + 1, lastStep))
  }

  function handleStepBack() {
    setStep((current) => Math.max(current - 1, 0))
  }

  function handleWizardSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step < lastStep) {
      event.preventDefault()
      handleStepAdvance()
      return
    }
    void handleSubmit(event)
  }

  useEffect(() => {
    setForm((current) => ({
      ...current,
      accessCpf: current.useResponsibleCpfForAccess ? current.responsibleCpf : current.cpf,
      companionAddressLine: current.usePatientAddressForCompanion ? current.addressLine : current.companionAddressLine,
    }))
  }, [form.cpf, form.responsibleCpf, form.useResponsibleCpfForAccess, form.addressLine, form.usePatientAddressForCompanion])

  useEffect(() => {
    if (!session || !canAccessOperator(session)) {
      return
    }

    let active = true

    async function loadPatients() {
      try {
        const data = await fetchPatients()
        if (active) {
          setPatients(data)
        }
      } catch {
        if (active) {
          setPatients([])
        }
      }
    }

    void loadPatients()

    return () => {
      active = false
    }
  }, [session])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const result = await createTravelRequest(form, 'operator')
      setSuccess({ protocol: result.protocol, message: result.message })
      setForm(initialForm)
      setStep(0)
      setLookupMessage('')
      setLookupStatus('idle')
    } catch {
      setError('Não foi possível cadastrar a solicitação no momento.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePatientLookup() {
    const normalizedCpf = form.cpf.replace(/\D/g, '')

    if (normalizedCpf.length !== 11) {
      setLookupMessage('Informe o CPF completo para pesquisar um cadastro existente.')
      setLookupStatus('warning')
      return
    }

    setLookupLoading(true)
    setLookupMessage('')
    setLookupStatus('idle')

    try {
      const base = patients.length > 0 ? patients : await fetchPatients()
      const existing = base.find((patient) => patient.cpf.replace(/\D/g, '') === normalizedCpf)

      if (!existing) {
        setLookupMessage('Nenhum cadastro anterior foi encontrado para esse CPF.')
        setLookupStatus('warning')
        return
      }

      setPatients(base)
      setForm((current) => ({
        ...current,
        patientName: existing.fullName || current.patientName,
        cpf: existing.cpfMasked || current.cpf,
        cns: existing.cns || current.cns,
        phone: existing.phone || current.phone,
        isWhatsapp: existing.isWhatsapp,
        addressLine: existing.addressLine || current.addressLine,
        accessCpf: existing.accessCpfMasked || current.accessCpf,
        useResponsibleCpfForAccess: existing.useResponsibleCpfForAccess,
        responsibleName: existing.responsibleName || '',
        responsibleCpf: existing.responsibleCpfMasked || '',
      }))
      setLookupMessage('Paciente localizado. Confira os dados preenchidos e ajuste apenas o que for necessário.')
      setLookupStatus('success')
    } catch {
      setLookupMessage('Não foi possível pesquisar o cadastro do paciente agora.')
      setLookupStatus('error')
    } finally {
      setLookupLoading(false)
    }
  }

  const validationHints = [
    form.cpf.replace(/\D/g, '').length !== 11 ? 'Preencha o CPF do paciente com 11 dígitos.' : null,
    form.phone.replace(/\D/g, '').length < 10 ? 'Informe um telefone válido do paciente.' : null,
    !form.addressLine.trim() ? 'Informe o endereço completo do paciente.' : null,
    !form.appointmentTime ? 'Informe o horário da consulta para organizar a ordem dos pacientes.' : null,
    form.useResponsibleCpfForAccess && form.responsibleCpf.replace(/\D/g, '').length !== 11
      ? 'Quando o acesso usa o responsável, o CPF do responsável deve estar completo.'
      : null,
    form.companionRequired && form.companionCpf.replace(/\D/g, '').length !== 11
      ? 'Se houver acompanhante, o CPF dele deve estar completo.'
      : null,
    form.companionRequired && form.companionPhone.replace(/\D/g, '').length < 10
      ? 'Se houver acompanhante, o telefone dele deve estar válido.'
      : null,
  ].filter(Boolean) as string[]

  async function handleCopyProtocol() {
    if (!success?.protocol || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(success.protocol)
    setCopyMessage('Protocolo copiado.')
  }

  async function handleLogout() {
    if (session?.token) {
      try {
        await logoutSession(session.token)
      } catch {
        // A limpeza local continua mesmo se a API não responder.
      }
    }

    clearOperatorSession()
    setSession(null)
  }

  if (!session || !canAccessOperator(session)) {
    return (
      <div className="dashboard-shell internal-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Cadastro interno da Prefeitura Municipal de Capão do Leão</strong>
            <span>Entre primeiro no painel administrativo</span>
          </div>
        </section>

        <article className="content-card">
          <h2>Sessão de operador necessária</h2>
          <p>Para cadastrar uma nova solicitação, entre com um perfil liberado para a área do operador.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/operador">
              Ir para login do painel
            </Link>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="dashboard-shell internal-shell">
      <div className="saas-app-shell">
        <InternalSidebar
          actions={
            <>
              <Link className="action-button secondary" to="/operador">
                <ArrowLeft size={16} />
                Voltar ao painel
              </Link>
              <button className="action-button primary" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          }
          items={[
            { to: '/operador', label: 'Operador', icon: ArrowLeft },
            { to: '/operador/cadastro', label: 'Nova solicitação', icon: FilePlus2, exact: true },
            { to: '/operador/pacientes', label: 'Base de pacientes', icon: UserRoundSearch },
            ...(session.role === 'manager' || session.role === 'admin'
              ? [{ to: '/gerente', label: 'Gerência', icon: Route }]
              : []),
            ...(session.role === 'manager' || session.role === 'admin'
              ? [{ to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users }]
              : []),
            ...(session.role === 'admin'
              ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }]
              : []),
          ]}
          sessionName={session.name}
          sessionRole="Operador"
          subtitle="Nova solicitação de transporte para tratamento"
          title="Cadastro interno"
        />

        <main className="saas-main saas-main--admin">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <FilePlus2 size={16} />
                Nova solicitação
              </div>
              <h1>Cadastrar viagem de paciente</h1>
              <p>Registre o atendimento, reaproveite o cadastro por CPF e organize a agenda com mais segurança.</p>
            </div>

            <div className="page-actions">
              <Link className="action-button secondary" to="/operador/pacientes">
                Base de pacientes
              </Link>
              <Link className="action-button secondary" to="/operador">
                <ArrowLeft size={16} />
                Voltar ao painel
              </Link>
            </div>
          </header>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Cadastro da viagem</h2>
          <form onSubmit={handleWizardSubmit}>
            <div className="wizard-steps" role="tablist" aria-label="Etapas do cadastro">
              {steps.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  className={`wizard-step${step === index ? ' is-active' : ''}${step > index ? ' is-complete' : ''}`}
                  aria-selected={step === index}
                  onClick={() => {
                    if (index <= step) {
                      setStep(index)
                    }
                  }}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              {step === 0 ? (
                <>
                  <div className="field full form-section-heading">
                    <h3>Paciente</h3>
                    <p>Localize o cadastro pelo CPF ou preencha os dados do atendimento.</p>
                  </div>
                  <div className="field">
                    <label htmlFor="patient-name">Nome do paciente</label>
                    <input id="patient-name" value={form.patientName} onChange={(event) => updateField('patientName', toTitleCase(event.target.value))} placeholder="Nome completo" required />
                  </div>
                  <div className="field">
                    <label htmlFor="cpf-register">CPF do paciente</label>
                    <div className="operator-search-inline">
                      <input id="cpf-register" value={form.cpf} onChange={(event) => updateField('cpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required />
                      <AsyncActionButton
                        className="lookup-button"
                        icon={Search}
                        loading={lookupLoading}
                        loadingLabel="Buscando..."
                        onClick={() => void handlePatientLookup()}
                        type="button"
                        variant="secondary"
                      >
                        Buscar CPF
                      </AsyncActionButton>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="cns-register">CNS</label>
                    <input id="cns-register" value={form.cns} onChange={(event) => updateField('cns', event.target.value)} placeholder="Número do cartão SUS" />
                  </div>
                  <div className="field">
                    <label htmlFor="phone-register">Telefone</label>
                    <input id="phone-register" value={form.phone} onChange={(event) => updateField('phone', formatPhone(event.target.value))} inputMode="tel" placeholder="(53) 99999-9999" required />
                  </div>
                  <div className="field checkbox-field checkbox-field-inline">
                    <label className="checkbox-row" htmlFor="patient-whatsapp">
                      <input id="patient-whatsapp" type="checkbox" checked={form.isWhatsapp} onChange={(event) => updateField('isWhatsapp', event.target.checked)} />
                      <span>WhatsApp</span>
                    </label>
                  </div>
                  <div className="field full">
                    <label htmlFor="address-line">Endereço do paciente</label>
                    <input id="address-line" value={form.addressLine} onChange={(event) => updateField('addressLine', toInstitutionalText(event.target.value))} placeholder="Rua, numero, bairro e referencia" required />
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="field full form-section-heading">
                    <h3>Acesso</h3>
                    <p>Defina qual CPF será usado pelo cidadão ou responsável para acompanhar a agenda.</p>
                  </div>
                  <div className="field checkbox-field checkbox-field-inline">
                    <label className="checkbox-row" htmlFor="use-responsible-access">
                      <input id="use-responsible-access" type="checkbox" checked={form.useResponsibleCpfForAccess} onChange={(event) => updateField('useResponsibleCpfForAccess', event.target.checked)} />
                      <span>Usar CPF do responsável como acesso ao acompanhamento</span>
                    </label>
                  </div>
                  <div className="field">
                    <label htmlFor="responsible-name">Nome do responsável</label>
                    <input id="responsible-name" value={form.responsibleName} onChange={(event) => updateField('responsibleName', toTitleCase(event.target.value))} placeholder="Preencher quando houver responsável" required={form.useResponsibleCpfForAccess} />
                  </div>
                  <div className="field">
                    <label htmlFor="responsible-cpf">CPF do responsável</label>
                    <input id="responsible-cpf" value={form.responsibleCpf} onChange={(event) => updateField('responsibleCpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required={form.useResponsibleCpfForAccess} />
                  </div>
                  <div className="field">
                    <label htmlFor="access-cpf">CPF de acesso ao agendamento</label>
                    <input id="access-cpf" value={form.accessCpf} onChange={(event) => updateField('accessCpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required readOnly={form.useResponsibleCpfForAccess} />
                  </div>
                  <div className="field">
                    <label htmlFor="companion-required">Acompanhante</label>
                    <select id="companion-required" value={form.companionRequired ? 'sim' : 'nao'} onChange={(event) => updateField('companionRequired', event.target.value === 'sim')}>
                      <option value="nao">Não necessário</option>
                      <option value="sim">Necessário</option>
                    </select>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                form.companionRequired ? (
                  <>
                    <div className="field full form-section-heading">
                      <h3>Acompanhante</h3>
                      <p>Preencha esta etapa apenas quando o paciente precisar viajar acompanhado.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="companion-name">Nome do acompanhante</label>
                      <input id="companion-name" value={form.companionName} onChange={(event) => updateField('companionName', toTitleCase(event.target.value))} placeholder="Nome completo do acompanhante" required />
                    </div>
                    <div className="field">
                      <label htmlFor="companion-cpf">CPF do acompanhante</label>
                      <input id="companion-cpf" value={form.companionCpf} onChange={(event) => updateField('companionCpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required />
                    </div>
                    <div className="field">
                      <label htmlFor="companion-phone">Telefone do acompanhante</label>
                      <input id="companion-phone" value={form.companionPhone} onChange={(event) => updateField('companionPhone', formatPhone(event.target.value))} inputMode="tel" placeholder="(53) 99999-9999" required />
                    </div>
                    <div className="field checkbox-field checkbox-field-inline">
                      <label className="checkbox-row" htmlFor="companion-whatsapp">
                        <input id="companion-whatsapp" type="checkbox" checked={form.companionIsWhatsapp} onChange={(event) => updateField('companionIsWhatsapp', event.target.checked)} />
                        <span>WhatsApp</span>
                      </label>
                    </div>
                    <div className="field full checkbox-field">
                      <label className="checkbox-row" htmlFor="use-patient-address">
                        <input id="use-patient-address" type="checkbox" checked={form.usePatientAddressForCompanion} onChange={(event) => updateField('usePatientAddressForCompanion', event.target.checked)} />
                        <span>Usar o mesmo endereço do paciente para o acompanhante</span>
                      </label>
                    </div>
                    <div className="field full">
                      <label htmlFor="companion-address">Endereço do acompanhante</label>
                      <input
                        id="companion-address"
                        value={form.usePatientAddressForCompanion ? form.addressLine : form.companionAddressLine}
                        onChange={(event) => updateField('companionAddressLine', toInstitutionalText(event.target.value))}
                        placeholder="Rua, numero, bairro e referencia"
                        required
                        readOnly={form.usePatientAddressForCompanion}
                      />
                    </div>
                  </>
                ) : (
                  <div className="field full form-section-heading">
                    <h3>Acompanhante</h3>
                    <p>Nenhum acompanhante é necessário para esta solicitação.</p>
                  </div>
                )
              ) : null}

              {step === 3 ? (
                <>
                  <div className="field full form-section-heading">
                    <h3>Destino e consulta</h3>
                    <p>Esses dados ajudam a organizar a ordem dos pacientes e o planejamento da rota.</p>
                  </div>
                  <div className="field">
                    <label htmlFor="destination-city">Cidade de destino</label>
                    <input id="destination-city" value={form.destinationCity} onChange={(event) => updateField('destinationCity', toTitleCase(event.target.value))} placeholder="Pelotas, Porto Alegre..." required />
                  </div>
                  <div className="field">
                    <label htmlFor="destination-state">UF</label>
                    <input id="destination-state" value={form.destinationState} onChange={(event) => updateField('destinationState', event.target.value.toUpperCase().slice(0, 2))} placeholder="RS" required />
                  </div>
                  <div className="field">
                    <label htmlFor="treatment-unit">Unidade de tratamento</label>
                    <input id="treatment-unit" value={form.treatmentUnit} onChange={(event) => updateField('treatmentUnit', toInstitutionalText(event.target.value))} placeholder="Hospital, clínica ou centro" required />
                  </div>
                  <div className="field">
                    <label htmlFor="specialty">Especialidade</label>
                    <input id="specialty" value={form.specialty} onChange={(event) => updateField('specialty', toTitleCase(event.target.value))} placeholder="Oncologia, nefrologia..." required />
                  </div>
                  <div className="field">
                    <label htmlFor="travel-date">Data da viagem</label>
                    <input id="travel-date" type="date" value={form.travelDate} onChange={(event) => updateField('travelDate', event.target.value)} required />
                  </div>
                  <div className="field">
                    <label htmlFor="appointment-time">Horário da consulta</label>
                    <input
                      id="appointment-time"
                      type="time"
                      value={form.appointmentTime}
                      onChange={(event) => updateField('appointmentTime', event.target.value)}
                      required
                    />
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="field full form-section-heading">
                    <h3>Observações</h3>
                    <p>Registre documentos apresentados, combinações do atendimento e observações internas.</p>
                  </div>
                  <div className="field full">
                    <label htmlFor="notes-register">Observações</label>
                    <textarea id="notes-register" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Documentos apresentados, orientações ou observações internas" rows={5} />
                  </div>
                </>
              ) : null}
            </div>

            <div className="form-actions">
              {step > 0 ? (
                <button className="action-button secondary" type="button" onClick={handleStepBack}>
                  Voltar etapa
                </button>
              ) : null}
              {step < lastStep ? (
                <button
                  className="action-button primary"
                  type="button"
                  onClick={handleStepAdvance}
                  disabled={!canAdvanceStep(step)}
                >
                  Continuar
                </button>
              ) : (
                <AsyncActionButton loading={loading} loadingLabel="Salvando..." type="submit">
                  Salvar solicitação
                </AsyncActionButton>
              )}
            </div>
          </form>
          {lookupMessage ? <p className={`table-note lookup-feedback ${lookupStatus}`}>{lookupMessage}</p> : null}
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Validação do cadastro</h2>
            {validationHints.length > 0 ? (
              <ul className="check-list">
                {validationHints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : (
              <p className="table-note">Os principais campos obrigatórios já estão preenchidos.</p>
            )}
          </article>

          {success ? (
            <article className="content-card success-card">
              <div className="eyebrow">
                <CheckCircle2 size={16} />
                Cadastro concluído
              </div>
              <div className="form-actions">
                <Link className="action-button primary" to="/operador">
                  Voltar ao painel
                </Link>
                <Link className="action-button secondary" to="/operador/cadastro">
                  Nova solicitação
                </Link>
              </div>
              <h2>Solicitação registrada</h2>
              <p><strong>Protocolo:</strong> {success.protocol}</p>
              <p>{success.message}</p>
              <div className="form-actions">
                <Link className="action-button primary" to="/operador">
                  Voltar ao painel
                </Link>
                <Link className="action-button secondary" to="/operador/cadastro">
                  Nova solicitação
                </Link>
                <button className="action-button secondary" type="button" onClick={() => void handleCopyProtocol()}>
                  Copiar protocolo
                </button>
              </div>
              {copyMessage ? <p className="table-note">{copyMessage}</p> : null}
            </article>
          ) : null}
        </aside>
      </section>
        </main>
      </div>
    </div>
  )
}
