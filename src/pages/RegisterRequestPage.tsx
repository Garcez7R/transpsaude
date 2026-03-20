import { ArrowLeft, CheckCircle2, FilePlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createTravelRequest } from '../lib/api'
import { canAccessOperator } from '../lib/access'
import { getAdminSession } from '../lib/admin-session'
import type { CreateTravelRequestInput } from '../types'

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
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ protocol: string; message: string } | null>(null)
  const [error, setError] = useState('')

  function updateField<K extends keyof CreateTravelRequestInput>(key: K, value: CreateTravelRequestInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    setForm((current) => ({
      ...current,
      accessCpf: current.useResponsibleCpfForAccess ? current.responsibleCpf : current.cpf,
      companionAddressLine: current.usePatientAddressForCompanion ? current.addressLine : current.companionAddressLine,
    }))
  }, [form.cpf, form.responsibleCpf, form.useResponsibleCpfForAccess, form.addressLine, form.usePatientAddressForCompanion])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const result = await createTravelRequest(form)
      setSuccess({ protocol: result.protocol, message: result.message })
      setForm(initialForm)
    } catch {
      setError('Não foi possível cadastrar a solicitação no momento.')
    } finally {
      setLoading(false)
    }
  }

  if (!session || !canAccessOperator(session)) {
    return (
      <div className="dashboard-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Cadastro interno da Prefeitura de Capão do Leão</strong>
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
    <div className="dashboard-shell">
      <section className="institutional-bar institutional-bar-inner">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Cadastro interno da Prefeitura de Capão do Leão</strong>
          <span>Nova solicitação de transporte para tratamento</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <FilePlus2 size={16} />
            Nova solicitação
          </div>
          <h1>Cadastrar viagem de paciente</h1>
          <p>
            O operador registra os dados do atendimento e define qual CPF será usado pelo cidadão
            ou responsável para acessar o acompanhamento.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Dados do paciente e do destino</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="patient-name">Nome do paciente</label>
                <input id="patient-name" value={form.patientName} onChange={(event) => updateField('patientName', event.target.value)} placeholder="Nome completo" required />
              </div>
              <div className="field">
                <label htmlFor="cpf-register">CPF do paciente</label>
                <input id="cpf-register" value={form.cpf} onChange={(event) => updateField('cpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required />
              </div>
              <div className="field">
                <label htmlFor="cns-register">CNS</label>
                <input id="cns-register" value={form.cns} onChange={(event) => updateField('cns', event.target.value)} placeholder="Número do cartão SUS" />
              </div>
              <div className="field">
                <label htmlFor="phone-register">Telefone</label>
                <input id="phone-register" value={form.phone} onChange={(event) => updateField('phone', formatPhone(event.target.value))} inputMode="tel" placeholder="(53) 99999-9999" required />
              </div>
              <div className="field full checkbox-field">
                <label className="checkbox-row" htmlFor="patient-whatsapp">
                  <input id="patient-whatsapp" type="checkbox" checked={form.isWhatsapp} onChange={(event) => updateField('isWhatsapp', event.target.checked)} />
                  <span>Esse telefone do paciente é WhatsApp</span>
                </label>
              </div>
              <div className="field full">
                <label htmlFor="address-line">Endereço do paciente</label>
                <input id="address-line" value={form.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} placeholder="Rua, numero, bairro e referencia" required />
              </div>
              <div className="field full checkbox-field">
                <label className="checkbox-row" htmlFor="use-responsible-access">
                  <input id="use-responsible-access" type="checkbox" checked={form.useResponsibleCpfForAccess} onChange={(event) => updateField('useResponsibleCpfForAccess', event.target.checked)} />
                  <span>Usar CPF do responsável como acesso ao acompanhamento</span>
                </label>
              </div>
              <div className="field">
                <label htmlFor="responsible-name">Nome do responsável</label>
                <input id="responsible-name" value={form.responsibleName} onChange={(event) => updateField('responsibleName', event.target.value)} placeholder="Preencher quando houver responsável" required={form.useResponsibleCpfForAccess} />
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
              {form.companionRequired ? (
                <>
                  <div className="field">
                    <label htmlFor="companion-name">Nome do acompanhante</label>
                    <input id="companion-name" value={form.companionName} onChange={(event) => updateField('companionName', event.target.value)} placeholder="Nome completo do acompanhante" required />
                  </div>
                  <div className="field">
                    <label htmlFor="companion-cpf">CPF do acompanhante</label>
                    <input id="companion-cpf" value={form.companionCpf} onChange={(event) => updateField('companionCpf', formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" required />
                  </div>
                  <div className="field">
                    <label htmlFor="companion-phone">Telefone do acompanhante</label>
                    <input id="companion-phone" value={form.companionPhone} onChange={(event) => updateField('companionPhone', formatPhone(event.target.value))} inputMode="tel" placeholder="(53) 99999-9999" required />
                  </div>
                  <div className="field full checkbox-field">
                    <label className="checkbox-row" htmlFor="companion-whatsapp">
                      <input id="companion-whatsapp" type="checkbox" checked={form.companionIsWhatsapp} onChange={(event) => updateField('companionIsWhatsapp', event.target.checked)} />
                      <span>Esse telefone do acompanhante é WhatsApp</span>
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
                      onChange={(event) => updateField('companionAddressLine', event.target.value)}
                      placeholder="Rua, numero, bairro e referencia"
                      required
                      readOnly={form.usePatientAddressForCompanion}
                    />
                  </div>
                </>
              ) : null}
              <div className="field">
                <label htmlFor="destination-city">Cidade de destino</label>
                <input id="destination-city" value={form.destinationCity} onChange={(event) => updateField('destinationCity', event.target.value)} placeholder="Pelotas, Porto Alegre..." required />
              </div>
              <div className="field">
                <label htmlFor="destination-state">UF</label>
                <input id="destination-state" value={form.destinationState} onChange={(event) => updateField('destinationState', event.target.value.toUpperCase().slice(0, 2))} placeholder="RS" required />
              </div>
              <div className="field">
                <label htmlFor="treatment-unit">Unidade de tratamento</label>
                <input id="treatment-unit" value={form.treatmentUnit} onChange={(event) => updateField('treatmentUnit', event.target.value)} placeholder="Hospital, clínica ou centro" required />
              </div>
              <div className="field">
                <label htmlFor="specialty">Especialidade</label>
                <input id="specialty" value={form.specialty} onChange={(event) => updateField('specialty', event.target.value)} placeholder="Oncologia, nefrologia..." required />
              </div>
              <div className="field">
                <label htmlFor="travel-date">Data da viagem</label>
                <input id="travel-date" type="date" value={form.travelDate} onChange={(event) => updateField('travelDate', event.target.value)} required />
              </div>
              <div className="field full">
                <label htmlFor="notes-register">Observações</label>
                <textarea id="notes-register" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Documentos apresentados, orientações ou observações internas" rows={5} />
              </div>
            </div>

            <div className="form-actions">
              <button className="action-button primary" disabled={loading} type="submit">
                {loading ? 'Salvando...' : 'Salvar solicitação'}
              </button>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Acesso do cidadão</h2>
            <ul className="check-list">
              <li>CPF, telefone e endereço do paciente agora são obrigatórios</li>
              <li>O telefone pode ser marcado como WhatsApp</li>
              <li>Quando houver acompanhante, nome, CPF, telefone e endereço ficam obrigatórios</li>
              <li>O endereço do acompanhante pode reaproveitar o do paciente ou usar outro</li>
            </ul>
          </article>

          {success ? (
            <article className="content-card success-card">
              <div className="eyebrow">
                <CheckCircle2 size={16} />
                Cadastro concluído
              </div>
              <h2>Solicitação registrada</h2>
              <p><strong>Protocolo:</strong> {success.protocol}</p>
              <p>{success.message}</p>
            </article>
          ) : (
            <article className="content-card">
              <h2>O que acontece depois</h2>
              <ul className="check-list">
                <li>Solicitação nasce com status `recebida`</li>
                <li>Painel interno pode evoluir para análise e agendamento</li>
                <li>Cidadão ou responsável consulta andamento no PWA com CPF de acesso e PIN</li>
              </ul>
            </article>
          )}
        </aside>
      </section>
    </div>
  )
}
