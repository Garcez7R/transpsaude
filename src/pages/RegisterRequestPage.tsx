import { ArrowLeft, CheckCircle2, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createTravelRequest } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type { CreateTravelRequestInput } from '../types'

const initialForm: CreateTravelRequestInput = {
  patientName: '',
  cpf: '',
  cns: '',
  phone: '',
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
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
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
      setError('Nao foi possivel cadastrar a solicitacao no momento.')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
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
          <h2>Sessao administrativa necessaria</h2>
          <p>Para cadastrar uma nova solicitacao, primeiro entre no painel do operador.</p>
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
            Nova solicitacao
          </div>
          <h1>Cadastrar viagem de paciente</h1>
          <p>
            O operador registra os dados do atendimento e o sistema libera o primeiro acesso do
            cidadão com CPF e senha temporária <strong>0000</strong>.
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
                <input
                  id="patient-name"
                  value={form.patientName}
                  onChange={(event) => updateField('patientName', event.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cpf-register">CPF</label>
                <input
                  id="cpf-register"
                  value={form.cpf}
                  onChange={(event) => updateField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cns-register">CNS</label>
                <input
                  id="cns-register"
                  value={form.cns}
                  onChange={(event) => updateField('cns', event.target.value)}
                  placeholder="Numero do cartao SUS"
                />
              </div>
              <div className="field">
                <label htmlFor="phone-register">Telefone</label>
                <input
                  id="phone-register"
                  value={form.phone}
                  onChange={(event) => updateField('phone', formatPhone(event.target.value))}
                  inputMode="tel"
                  placeholder="(53) 99999-9999"
                />
              </div>
              <div className="field">
                <label htmlFor="destination-city">Cidade de destino</label>
                <input
                  id="destination-city"
                  value={form.destinationCity}
                  onChange={(event) => updateField('destinationCity', event.target.value)}
                  placeholder="Pelotas, Porto Alegre..."
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="destination-state">UF</label>
                <input
                  id="destination-state"
                  value={form.destinationState}
                  onChange={(event) => updateField('destinationState', event.target.value.toUpperCase().slice(0, 2))}
                  placeholder="RS"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="treatment-unit">Unidade de tratamento</label>
                <input
                  id="treatment-unit"
                  value={form.treatmentUnit}
                  onChange={(event) => updateField('treatmentUnit', event.target.value)}
                  placeholder="Hospital, clinica ou centro"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="specialty">Especialidade</label>
                <input
                  id="specialty"
                  value={form.specialty}
                  onChange={(event) => updateField('specialty', event.target.value)}
                  placeholder="Oncologia, nefrologia..."
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="travel-date">Data da viagem</label>
                <input
                  id="travel-date"
                  type="date"
                  value={form.travelDate}
                  onChange={(event) => updateField('travelDate', event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="companion-required">Acompanhante</label>
                <select
                  id="companion-required"
                  value={form.companionRequired ? 'sim' : 'nao'}
                  onChange={(event) => updateField('companionRequired', event.target.value === 'sim')}
                >
                  <option value="nao">Nao necessario</option>
                  <option value="sim">Necessario</option>
                </select>
              </div>
              <div className="field full">
                <label htmlFor="notes-register">Observacoes</label>
                <textarea
                  id="notes-register"
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Documentos apresentados, orientacoes ou observacoes internas"
                  rows={5}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="action-button primary" disabled={loading} type="submit">
                {loading ? 'Salvando...' : 'Salvar solicitacao'}
              </button>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Acesso do cidadão</h2>
            <ul className="check-list">
              <li>Login inicial com CPF cadastrado</li>
              <li>Senha temporária padrão: <strong>0000</strong></li>
              <li>Troca obrigatória para PIN numérico de 4 dígitos</li>
              <li>Reset futuro somente pela prefeitura</li>
            </ul>
          </article>

          {success ? (
            <article className="content-card success-card">
              <div className="eyebrow">
                <CheckCircle2 size={16} />
                Cadastro concluido
              </div>
              <h2>Solicitacao registrada</h2>
              <p><strong>Protocolo:</strong> {success.protocol}</p>
              <p>{success.message}</p>
            </article>
          ) : (
            <article className="content-card">
              <h2>O que acontece depois</h2>
              <ul className="check-list">
                <li>Solicitação nasce com status `recebida`</li>
                <li>Painel interno pode evoluir para analise e agendamento</li>
                <li>Cidadão consulta andamento no PWA com CPF e PIN</li>
              </ul>
            </article>
          )}
        </aside>
      </section>
    </div>
  )
}
