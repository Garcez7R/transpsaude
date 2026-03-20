import { ArrowLeft, CheckCircle2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { canAccessManager, canAccessOperator } from '../lib/access'
import { fetchRequestDetails, updateRequestSchedule, updateRequestStatus } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type { RequestStatus, StatusHistoryEntry, TravelRequestDetails } from '../types'

const statusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_analise', label: 'Em analise' },
  { value: 'aguardando_documentos', label: 'Aguardando documentos' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'concluida', label: 'Concluida' },
]

export function RequestDetailsPage() {
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const params = useParams()
  const requestId = Number(params.id ?? '')
  const [details, setDetails] = useState<TravelRequestDetails | null>(null)
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [status, setStatus] = useState<RequestStatus>('recebida')
  const [note, setNote] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleNote, setScheduleNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!session || !canAccessOperator(session) || !Number.isFinite(requestId) || requestId <= 0) {
      return
    }

    let active = true

    async function loadDetails() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchRequestDetails(requestId)

        if (!active) {
          return
        }

        const { history: historyData, ...requestData } = data
        setDetails(requestData)
        setHistory(historyData)
        setStatus(requestData.status)
        setScheduleDate(requestData.travelDate)
        setScheduleTime(requestData.departureTime ?? '')
      } catch {
        if (active) {
          setError('Nao foi possivel carregar os detalhes da solicitacao.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      active = false
    }
  }, [requestId, session])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!details) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const result = await updateRequestStatus({
        requestId: details.id,
        status,
        note,
      })

      const refreshed = await fetchRequestDetails(details.id)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setMessage(result.message)
      setNote('')
    } catch {
      setError('Nao foi possivel atualizar o status dessa solicitacao.')
    } finally {
      setSaving(false)
    }
  }

  async function handleScheduleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!details) {
      return
    }

    setSavingSchedule(true)
    setError('')
    setMessage('')

    try {
      const result = await updateRequestSchedule({
        requestId: details.id,
        travelDate: scheduleDate,
        departureTime: scheduleTime,
        note: scheduleNote,
      })

      const refreshed = await fetchRequestDetails(details.id)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setScheduleDate(requestData.travelDate)
      setScheduleTime(requestData.departureTime ?? '')
      setScheduleNote('')
      setMessage(result.message)
    } catch {
      setError('Nao foi possivel reagendar a viagem.')
    } finally {
      setSavingSchedule(false)
    }
  }

  if (!session || !canAccessOperator(session)) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Sessao de operador necessaria</h2>
          <p>Entre com um perfil autorizado para consultar ou atualizar solicitacoes.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/operador">
              Ir para operador
            </Link>
          </div>
        </article>
      </div>
    )
  }

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Solicitacao invalida</h2>
          <p>O identificador informado nao e valido.</p>
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
          <strong>Detalhe da solicitacao</strong>
          <span>Consulta completa, andamento e historico interno</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <CheckCircle2 size={16} />
            Solicitacao #{requestId}
          </div>
          <h1>{details?.patientName ?? 'Carregando solicitacao'}</h1>
          <p>Use essa tela para revisar os dados do cadastro e movimentar o status operacional.</p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      {loading || !details ? (
        <article className="content-card">
          <p className="table-note">Carregando detalhes da solicitacao...</p>
        </article>
      ) : (
        <section className="dashboard-grid">
          <article className="content-card">
            <h2>Dados da solicitacao</h2>
            <dl className="request-summary">
              <div>
                <dt>Protocolo</dt>
                <dd>{details.protocol}</dd>
              </div>
              <div>
                <dt>Status atual</dt>
                <dd>
                  <span className={`status-badge ${details.status}`}>{details.status}</span>
                </dd>
              </div>
              <div>
                <dt>Paciente</dt>
                <dd>{details.patientName}</dd>
              </div>
              <div>
                <dt>CPF do paciente</dt>
                <dd>{details.patientCpf}</dd>
              </div>
              <div>
                <dt>CPF de acesso</dt>
                <dd>{details.accessCpfMasked ?? details.cpfMasked}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{details.phone}{details.isWhatsapp ? ' • WhatsApp' : ''}</dd>
              </div>
              <div>
                <dt>Endereco de embarque</dt>
                <dd>{details.boardingLocationLabel || details.addressLine || 'Nao informado'}</dd>
              </div>
              <div>
                <dt>Origem do embarque</dt>
                <dd>{details.useCustomBoardingLocation ? 'Ponto oficial definido pela gerencia' : 'Endereco do paciente'}</dd>
              </div>
              <div>
                <dt>CNS</dt>
                <dd>{details.cns || 'Nao informado'}</dd>
              </div>
              <div>
                <dt>Responsavel</dt>
                <dd>{details.responsibleName || 'Nao informado'}</dd>
              </div>
              <div>
                <dt>CPF do responsavel</dt>
                <dd>{details.responsibleCpfMasked || 'Nao informado'}</dd>
              </div>
              <div>
                <dt>Destino</dt>
                <dd>
                  {details.destinationCity}/{details.destinationState}
                </dd>
              </div>
              <div>
                <dt>Unidade</dt>
                <dd>{details.treatmentUnit}</dd>
              </div>
              <div>
                <dt>Especialidade</dt>
                <dd>{details.specialty}</dd>
              </div>
              <div>
                <dt>Data da viagem</dt>
                <dd>{details.travelDate}</dd>
              </div>
              <div>
                <dt>Motorista</dt>
                <dd>{details.assignedDriverName || 'Nao atribuido'}</dd>
              </div>
              <div>
                <dt>Horario de saida</dt>
                <dd>{details.departureTime || 'Nao definido'}</dd>
              </div>
              <div>
                <dt>Acompanhante</dt>
                <dd>{details.companionRequired ? details.companionName || 'Necessario' : 'Nao necessario'}</dd>
              </div>
              <div>
                <dt>Endereco do acompanhante</dt>
                <dd>{details.companionAddressLine || 'Nao informado'}</dd>
              </div>
              <div>
                <dt>Obs. gerencia</dt>
                <dd>{details.managerNotes || 'Sem observacoes'}</dd>
              </div>
            </dl>

            <div className="detail-note">
              <strong>Observacoes do cadastro:</strong> {details.notes || 'Sem observacoes registradas.'}
            </div>
          </article>

          <aside className="dashboard-side">
            <article className="content-card">
              <h2>Atualizar status</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="request-status">Novo status</label>
                    <select
                      id="request-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as RequestStatus)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field full">
                    <label htmlFor="request-note">Observacao interna</label>
                    <textarea
                      id="request-note"
                      rows={4}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Descreva o motivo da mudanca, pendencia ou orientacao."
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="action-button primary" disabled={saving} type="submit">
                    <Save size={16} />
                    {saving ? 'Salvando...' : 'Salvar status'}
                  </button>
                </div>
              </form>
            </article>

            {canAccessManager(session) ? (
              <article className="content-card">
                <h2>Reagendar viagem</h2>
                <form onSubmit={handleScheduleSubmit}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="schedule-date">Nova data da viagem</label>
                      <input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate}
                        onChange={(event) => setScheduleDate(event.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="schedule-time">Novo horario de saida</label>
                      <input
                        id="schedule-time"
                        type="time"
                        value={scheduleTime}
                        onChange={(event) => setScheduleTime(event.target.value)}
                        required
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor="schedule-note">Motivo ou observacao</label>
                      <textarea
                        id="schedule-note"
                        rows={3}
                        value={scheduleNote}
                        onChange={(event) => setScheduleNote(event.target.value)}
                        placeholder="Mudanca de horario, ajuste por rota, indisponibilidade, nova orientacao."
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="action-button primary" disabled={savingSchedule} type="submit">
                      <Save size={16} />
                      {savingSchedule ? 'Reagendando...' : 'Salvar nova data e horario'}
                    </button>
                  </div>
                </form>
              </article>
            ) : null}

            <article className="content-card">
              <h2>Historico da solicitacao</h2>
              <ol className="status-history">
                {history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong> em {entry.updatedAt}
                    {entry.note ? ` - ${entry.note}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </section>
      )}
    </div>
  )
}
