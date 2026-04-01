import { ArrowLeft, BusFront, CheckCircle2, ListChecks, Printer, Route, Save, ShieldCheck, UserRoundSearch, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AsyncActionButton } from '../components/AsyncActionButton'
import { InternalSidebar } from '../components/InternalSidebar'
import { canAccessManager, canAccessOperator } from '../lib/access'
import { createRequestMessage, fetchRequestDetails, markRequestPatientMessagesSeen, resetAccess, updateDriverPhoneVisibility, updateRequestSchedule, updateRequestStatus } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import { getManagerSession } from '../lib/manager-session'
import { getOperatorSession } from '../lib/operator-session'
import { toInstitutionalText } from '../lib/text-format'
import { useToastOnChange } from '../lib/use-toast-on-change'
import type { AdminSession, RequestStatus, StatusHistoryEntry, TravelRequestDetails } from '../types'

const statusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'aguardando_documentos', label: 'Aguardando documentos' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'concluida', label: 'Concluída' },
]

function formatDisplayTimestamp(value?: string | null) {
  if (!value) {
    return ''
  }

  const normalized = value.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`
}

export function RequestDetailsPage() {
  const params = useParams()
  const requestId = Number(params.id ?? '')
  const [session, setSession] = useState<AdminSession | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return getOperatorSession() ?? getManagerSession() ?? getAdminSession()
  })
  const [details, setDetails] = useState<TravelRequestDetails | null>(null)
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [status, setStatus] = useState<RequestStatus>('recebida')
  const [note, setNote] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleNote, setScheduleNote] = useState('')
  const [messageType, setMessageType] = useState('general')
  const [messageTitle, setMessageTitle] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [visibleToCitizen, setVisibleToCitizen] = useState(true)
  const [showDriverPhoneToPatient, setShowDriverPhoneToPatient] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [savingDriverPhoneVisibility, setSavingDriverPhoneVisibility] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const patientMessages = details?.messages.filter((entry) => entry.createdByRole === 'patient') ?? []
  const teamMessages = details?.messages.filter((entry) => entry.createdByRole !== 'patient') ?? []
  const accessMode = canAccessManager(session) ? 'internal' : 'operator'
  const backTo = canAccessManager(session) ? '/gerente' : '/operador'
  const sidebarRole = session ? (canAccessManager(session) ? 'Gestão interna' : 'Operador') : 'Área interna'

  useToastOnChange(error, 'error')
  useToastOnChange(message, 'success')

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSession(null)
      return
    }

    setSession(getOperatorSession() ?? getManagerSession() ?? getAdminSession())
  }, [])

  async function handleResetPatientAccess() {
    if (!details) {
      return
    }

    try {
      const result = await resetAccess('patient', details.patientId, accessMode)
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível redefinir o acesso do paciente.')
    }
  }

  useEffect(() => {
    if (!session || !canAccessOperator(session) || !Number.isFinite(requestId) || requestId <= 0) {
      return
    }

    let active = true

    async function loadDetails() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchRequestDetails(requestId, accessMode)

        if (!active) {
          return
        }

        const { history: historyData, ...requestData } = data
        setDetails(requestData)
        setHistory(historyData)
        setStatus(requestData.status)
        setScheduleDate(requestData.travelDate)
        setAppointmentTime(requestData.appointmentTime ?? '')
        setScheduleTime(requestData.departureTime ?? '')
        setShowDriverPhoneToPatient(requestData.showDriverPhoneToPatient ?? true)
      } catch {
        if (active) {
          setError('Não foi possível carregar os detalhes da solicitação.')
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
  }, [accessMode, requestId, session])

  useEffect(() => {
    if (!details || patientMessages.length === 0 || !session || !canAccessOperator(session)) {
      return
    }

    void markRequestPatientMessagesSeen(details.id, accessMode).catch(() => {
      // O detalhe continua acessível mesmo se o registro de leitura falhar.
    })
  }, [accessMode, details, patientMessages.length, session])

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
      }, accessMode)

      const refreshed = await fetchRequestDetails(details.id, accessMode)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setMessage(result.message)
      setNote('')
    } catch {
      setError('Não foi possível atualizar o status desta solicitação.')
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
        appointmentTime,
        note: scheduleNote,
      }, accessMode)

      const refreshed = await fetchRequestDetails(details.id, accessMode)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setScheduleDate(requestData.travelDate)
      setAppointmentTime(requestData.appointmentTime ?? '')
      setScheduleTime(requestData.departureTime ?? '')
      setScheduleNote('')
      setMessage(result.message)
    } catch {
      setError('Não foi possível reagendar a viagem.')
    } finally {
      setSavingSchedule(false)
    }
  }

  async function handleMessageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!details) {
      return
    }

    setSavingMessage(true)
    setError('')
    setMessage('')

    try {
      const result = await createRequestMessage({
        requestId: details.id,
        messageType,
        title: messageTitle,
        body: messageBody,
        visibleToCitizen,
      }, accessMode)

      const refreshed = await fetchRequestDetails(details.id, accessMode)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setMessage(result.message)
      setMessageTitle('')
      setMessageBody('')
      setMessageType('general')
      setVisibleToCitizen(true)
    } catch {
      setError('Não foi possível registrar a mensagem desta solicitação.')
    } finally {
      setSavingMessage(false)
    }
  }

  async function handleDriverPhoneVisibilitySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!details) {
      return
    }

    setSavingDriverPhoneVisibility(true)
    setError('')
    setMessage('')

    try {
      const result = await updateDriverPhoneVisibility(details.id, showDriverPhoneToPatient, accessMode)
      const refreshed = await fetchRequestDetails(details.id, accessMode)
      const { history: historyData, ...requestData } = refreshed
      setDetails(requestData)
      setHistory(historyData)
      setShowDriverPhoneToPatient(requestData.showDriverPhoneToPatient ?? true)
      setMessage(result.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível atualizar a visibilidade do telefone do motorista.')
    } finally {
      setSavingDriverPhoneVisibility(false)
    }
  }

  if (!session || !canAccessOperator(session)) {
    return (
      <div className="dashboard-shell internal-shell">
        <article className="content-card">
          <h2>Sessão de operador necessária</h2>
          <p>Entre com um perfil autorizado para consultar ou atualizar solicitações.</p>
          <div className="form-actions">
            <Link className="action-button primary" to={backTo}>
              Ir para a área interna
            </Link>
          </div>
        </article>
      </div>
    )
  }

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return (
      <div className="dashboard-shell internal-shell">
        <article className="content-card">
          <h2>Solicitação inválida</h2>
          <p>O identificador informado não é válido.</p>
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
              <button className="action-button secondary" type="button" onClick={() => void handleResetPatientAccess()}>
                Resetar acesso
              </button>
              <Link className="action-button secondary" to={backTo}>
                <ArrowLeft size={16} />
                Voltar
              </Link>
            </>
          }
          items={[
            { to: backTo, label: backTo === '/gerente' ? 'Gerência' : 'Operador', icon: backTo === '/gerente' ? Route : ListChecks },
            { to: '/operador/pacientes', label: 'Base de pacientes', icon: UserRoundSearch },
            { to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users },
            { to: '/motorista', label: 'Portal do motorista', icon: BusFront },
            { to: '/admin', label: 'Admin', icon: ShieldCheck },
          ]}
          sessionName={session.name}
          sessionRole={sidebarRole}
          subtitle="Consulta completa, andamento e histórico interno"
          title="Detalhe da solicitação"
        />

        <main className="saas-main">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <CheckCircle2 size={16} />
                Solicitação #{requestId}
              </div>
              <h1>{details?.patientName ?? 'Carregando solicitação'}</h1>
              <p>Revise o cadastro, registre mensagens e movimente o status operacional com mais contexto.</p>
            </div>

            <div className="page-actions">
              <button className="action-button secondary" type="button" onClick={() => window.print()}>
                <Printer size={16} />
                Imprimir comprovante
              </button>
              <Link className="action-button secondary" to={backTo}>
                <ArrowLeft size={16} />
                Voltar ao painel
              </Link>
            </div>
          </header>

          {error ? <p className="table-note">{error}</p> : null}
          {message ? <p className="table-note">{message}</p> : null}

      {loading || !details ? (
        <article className="content-card">
          <p className="table-note">Carregando detalhes da solicitação...</p>
        </article>
      ) : (
        <section className="dashboard-grid dashboard-grid-main">
          <div className="dashboard-main-stack">
            <article className="content-card">
              <h2>Dados da solicitação</h2>
              <div className="travel-overview-grid">
                <article className="travel-overview-card">
                  <span>Consulta</span>
                  <strong>{details.appointmentTime || 'Não definido'}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Saída</span>
                  <strong>{details.departureTime || 'Não definido'}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Embarque</span>
                  <strong>{details.boardingLocationLabel || details.addressLine || 'Não informado'}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Motorista</span>
                  <strong>{details.assignedDriverName || 'Não atribuído'}</strong>
                </article>
              </div>
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
                <dt>Endereço de embarque</dt>
                <dd>{details.boardingLocationLabel || details.addressLine || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Origem do embarque</dt>
                <dd>{details.useCustomBoardingLocation ? 'Ponto oficial definido pela gerência' : 'Endereço do paciente'}</dd>
              </div>
              <div>
                <dt>CNS</dt>
                <dd>{details.cns || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Responsavel</dt>
                <dd>{details.responsibleName || 'Não informado'}</dd>
              </div>
              <div>
                <dt>CPF do responsável</dt>
                <dd>{details.responsibleCpfMasked || 'Não informado'}</dd>
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
                <dt>Horário da consulta</dt>
                <dd>{details.appointmentTime || 'Não definido'}</dd>
              </div>
              <div>
                <dt>Motorista</dt>
                <dd>{details.assignedDriverName || 'Não atribuído'}</dd>
              </div>
              <div>
                <dt>Telefone do motorista para o paciente</dt>
                <dd>
                  {details.showDriverPhoneToPatient
                    ? details.assignedDriverPhone || 'Não informado'
                    : 'Oculto na consulta pública'}
                </dd>
              </div>
              <div>
                <dt>Veículo da viagem</dt>
                <dd>{details.assignedVehicleName || 'Não definido'}</dd>
              </div>
              <div>
                <dt>Horário de saída</dt>
                <dd>{details.departureTime || 'Não definido'}</dd>
              </div>
              <div>
                <dt>Confirmação do paciente</dt>
                <dd>{details.patientConfirmedAt ? formatDisplayTimestamp(details.patientConfirmedAt) : 'Ainda não confirmada na consulta pública'}</dd>
              </div>
              <div>
                <dt>Último acesso do paciente</dt>
                <dd>{details.patientLastViewedAt ? formatDisplayTimestamp(details.patientLastViewedAt) : 'Ainda não registrado'}</dd>
              </div>
              <div>
                <dt>Última leitura de mensagens</dt>
                <dd>{details.patientLastMessageSeenAt ? formatDisplayTimestamp(details.patientLastMessageSeenAt) : 'Ainda não registrada'}</dd>
              </div>
              <div>
                <dt>Acompanhante</dt>
                <dd>{details.companionRequired ? details.companionName || 'Necessário' : 'Não necessário'}</dd>
              </div>
              <div>
                <dt>Endereço do acompanhante</dt>
                <dd>{details.companionAddressLine || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Obs. gerência</dt>
                <dd>{details.managerNotes || 'Sem observações'}</dd>
              </div>
              </dl>

              <div className="detail-note">
                <strong>Observações do cadastro:</strong> {details.notes || 'Sem observações registradas.'}
              </div>
            </article>

            <article className="content-card">
              <h2>Comprovante de agendamento</h2>
              <p className="table-note">
                Use este bloco para impressão ou conferência rápida com o paciente no balcão.
              </p>
              <dl className="request-summary">
              <div>
                <dt>Protocolo</dt>
                <dd>{details.protocol}</dd>
              </div>
              <div>
                <dt>Paciente</dt>
                <dd>{details.patientName}</dd>
              </div>
              <div>
                <dt>CPF de acesso</dt>
                <dd>{details.accessCpfMasked ?? details.cpfMasked}</dd>
              </div>
              <div>
                <dt>Data da viagem</dt>
                <dd>{details.travelDate}</dd>
              </div>
              <div>
                <dt>Horário da consulta</dt>
                <dd>{details.appointmentTime || 'A definir'}</dd>
              </div>
              <div>
                <dt>Horário de saída</dt>
                <dd>{details.departureTime || 'A definir'}</dd>
              </div>
              <div>
                <dt>Local de embarque</dt>
                <dd>{details.boardingLocationLabel || details.addressLine || 'Não informado'}</dd>
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
                <dt>Motorista</dt>
                <dd>{details.assignedDriverName || 'A definir'}</dd>
              </div>
              <div>
                <dt>Telefone do motorista</dt>
                <dd>
                  {details.showDriverPhoneToPatient
                    ? details.assignedDriverPhone || 'A definir'
                    : 'Oculto na consulta pública'}
                </dd>
              </div>
              <div>
                <dt>Veículo da viagem</dt>
                <dd>{details.assignedVehicleName || 'A definir'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{details.phone || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Agenda confirmada</dt>
                <dd>{details.patientConfirmedAt || 'Não'}</dd>
              </div>
              </dl>
            </article>
          </div>

          <aside className="dashboard-side">
            <article className="content-card">
              <h2>Contato do motorista</h2>
              <form onSubmit={handleDriverPhoneVisibilitySubmit}>
                <div className="form-grid">
                  <div className="field full checkbox-field">
                    <label className="checkbox-row" htmlFor="request-driver-phone-visibility">
                      <input
                        id="request-driver-phone-visibility"
                        type="checkbox"
                        checked={showDriverPhoneToPatient}
                        onChange={(event) => setShowDriverPhoneToPatient(event.target.checked)}
                      />
                      <span>Exibir telefone do motorista na consulta do paciente</span>
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <AsyncActionButton icon={Save} loading={savingDriverPhoneVisibility} loadingLabel="Salvando..." type="submit">
                    Salvar visibilidade
                  </AsyncActionButton>
                </div>
              </form>
            </article>

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
                    <label htmlFor="request-note">Observação interna</label>
                    <textarea
                      id="request-note"
                      rows={4}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Descreva o motivo da mudança, pendência ou orientação."
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <AsyncActionButton icon={Save} loading={saving} loadingLabel="Salvando..." type="submit">
                    Salvar status
                  </AsyncActionButton>
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
                      <label htmlFor="schedule-appointment-time">Novo horário da consulta</label>
                      <input
                        id="schedule-appointment-time"
                        type="time"
                        value={appointmentTime}
                        onChange={(event) => setAppointmentTime(event.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="schedule-time">Novo horário de saída</label>
                      <input
                        id="schedule-time"
                        type="time"
                        value={scheduleTime}
                        onChange={(event) => setScheduleTime(event.target.value)}
                        required
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor="schedule-note">Motivo ou observação</label>
                      <textarea
                        id="schedule-note"
                        rows={3}
                        value={scheduleNote}
                        onChange={(event) => setScheduleNote(event.target.value)}
                        placeholder="Mudança de horário, ajuste por rota, indisponibilidade, nova orientação."
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <AsyncActionButton icon={Save} loading={savingSchedule} loadingLabel="Reagendando..." type="submit">
                      Salvar nova data e horário
                    </AsyncActionButton>
                  </div>
                </form>
              </article>
            ) : null}

            <article className="content-card">
              <h2>Mensagens e avisos</h2>
              <form onSubmit={handleMessageSubmit}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="request-message-type">Tipo</label>
                    <select id="request-message-type" value={messageType} onChange={(event) => setMessageType(event.target.value)}>
                      <option value="general">Aviso geral</option>
                      <option value="schedule">Mudança de horário</option>
                      <option value="documents">Documentos</option>
                      <option value="boarding">Embarque</option>
                    </select>
                  </div>
                  <div className="field full">
                    <label htmlFor="request-message-title">Título</label>
                    <input
                      id="request-message-title"
                      value={messageTitle}
                      onChange={(event) => setMessageTitle(toInstitutionalText(event.target.value))}
                      placeholder="Ex.: Comparecer com antecedência"
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor="request-message-body">Mensagem</label>
                    <textarea
                      id="request-message-body"
                      rows={4}
                      value={messageBody}
                      onChange={(event) => setMessageBody(toInstitutionalText(event.target.value))}
                      placeholder="Escreva a orientação que deve ficar registrada nesta solicitação."
                      required
                    />
                  </div>
                  <div className="field checkbox-field checkbox-field-inline">
                    <label className="checkbox-row" htmlFor="request-message-visible">
                      <input
                        id="request-message-visible"
                        type="checkbox"
                        checked={visibleToCitizen}
                        onChange={(event) => setVisibleToCitizen(event.target.checked)}
                      />
                      <span>Exibir esta mensagem na consulta do paciente</span>
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <AsyncActionButton disabled={!messageBody.trim()} icon={Save} loading={savingMessage} loadingLabel="Registrando..." type="submit">
                    Registrar mensagem
                  </AsyncActionButton>
                </div>
              </form>

              {teamMessages.length > 0 ? (
                <ol className="status-history">
                  {teamMessages.map((entry) => (
                    <li key={`team-message-${entry.id}`}>
                      <strong>{entry.title || 'Mensagem registrada'}</strong> em {formatDisplayTimestamp(entry.createdAt)} por {entry.createdByName}
                      {entry.visibleToCitizen ? ' • Visível ao paciente' : ' • Uso interno'}
                      <br />
                      {entry.body}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="table-note">Nenhuma mensagem da equipe registrada até o momento.</p>
              )}
            </article>

            <article className="content-card" id="mensagens-paciente">
              <h2>Mensagens do paciente</h2>
              {patientMessages.length > 0 ? (
                <ol className="status-history">
                  {patientMessages.map((entry) => (
                    <li key={`patient-message-${entry.id}`}>
                      <strong>{entry.title || 'Mensagem enviada pelo paciente'}</strong> em {formatDisplayTimestamp(entry.createdAt)}
                      <br />
                      {entry.body}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="table-note">O paciente ainda não enviou mensagens por esta solicitação.</p>
              )}
            </article>

            <article className="content-card">
              <h2>Histórico da solicitação</h2>
              <ol className="status-history">
                {history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong> em {formatDisplayTimestamp(entry.updatedAt)}
                    {entry.note ? ` - ${entry.note}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </section>
      )}
        </main>
      </div>
    </div>
  )
}
