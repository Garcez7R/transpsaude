import {
  BusFront,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ListChecks,
  LogOut,
  MapPin,
  MessageSquare,
  Phone,
  Route,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AsyncActionButton } from '../components/AsyncActionButton'
import { InternalSidebar } from '../components/InternalSidebar'
import { activateDriverPassword, createDriverRequestMessage, fetchDriverTrips, loginDriver, logoutSession } from '../lib/api'
import { useAppToast } from '../lib/app-toast'
import { clearDriverSession, getDriverSession, saveDriverSession } from '../lib/driver-session'
import type { DriverSession, TravelRequest } from '../types'

type DriverTripFilter = 'today' | 'upcoming' | 'confirmed' | 'withMessages' | 'all'
type SaveState = 'idle' | 'saving' | 'success'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatDisplayDate(value?: string) {
  if (!value) {
    return 'A definir'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function formatDisplayDateTime(date?: string, time?: string) {
  const formattedDate = formatDisplayDate(date)

  if (!time) {
    return formattedDate
  }

  return `${formattedDate} às ${time}`
}

function formatDisplayTimestamp(value?: string | null) {
  if (!value) {
    return 'Ainda não confirmada'
  }

  const normalized = value.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`
}

function isMeaningfulValue(value?: string | null) {
  const text = String(value ?? '').trim()

  if (!text) {
    return false
  }

  if (/^\d{1,2}$/.test(text)) {
    return false
  }

  return true
}

function getDisplayValue(value?: string | null, fallback = 'Não informado') {
  return isMeaningfulValue(value) ? String(value).trim() : fallback
}

function getBoardingLocation(trip: TravelRequest) {
  return getDisplayValue(trip.boardingLocationLabel || trip.addressLine, 'A definir')
}

function buildMapsUrl(label: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}

function buildPhoneHref(phone: string) {
  return `tel:${phone.replace(/\D/g, '')}`
}

function getTodayKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFilterLabel(filter: DriverTripFilter) {
  switch (filter) {
    case 'today':
      return 'Hoje'
    case 'upcoming':
      return 'Próximas'
    case 'confirmed':
      return 'Confirmadas'
    case 'withMessages':
      return 'Com mensagem'
    case 'all':
      return 'Todas'
    default:
      return 'Hoje'
  }
}

export function DriverPortalPage() {
  const { showToast } = useAppToast()
  const [session, setSession] = useState<DriverSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [trips, setTrips] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)
  const [activeFilter, setActiveFilter] = useState<DriverTripFilter>('today')
  const [selectedDate, setSelectedDate] = useState('')
  const [expandedTripId, setExpandedTripId] = useState<number | null>(null)
  const [messageDrafts, setMessageDrafts] = useState<Record<number, { title: string; body: string; visibleToCitizen: boolean }>>({})
  const [messageSaveState, setMessageSaveState] = useState<Record<number, SaveState>>({})

  useEffect(() => {
    setSession(getDriverSession())
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    const driverId = session.driverId
    let active = true

    async function loadTrips() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchDriverTrips(driverId)

        if (active) {
          setTrips(data)
        }
      } catch (loadError) {
        if (active) {
          const message = loadError instanceof Error ? loadError.message : 'Não foi possível carregar as viagens do motorista.'
          setError(message)
          showToast({ type: 'error', message })
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadTrips()

    return () => {
      active = false
    }
  }, [session, showToast])

  const sortedTrips = useMemo(
    () =>
      [...trips].sort((left, right) => {
        const leftKey = `${left.travelDate ?? ''} ${left.departureTime ?? left.appointmentTime ?? ''}`.trim()
        const rightKey = `${right.travelDate ?? ''} ${right.departureTime ?? right.appointmentTime ?? ''}`.trim()
        return leftKey.localeCompare(rightKey)
      }),
    [trips],
  )

  const todayKey = useMemo(() => getTodayKey(), [])

  const summary = useMemo(() => {
    const confirmedTotal = sortedTrips.filter((trip) => !!trip.patientConfirmedAt).length
    const patientMessageTotal = sortedTrips.filter((trip) => (trip.messages ?? []).some((entry) => entry.createdByRole === 'patient')).length

    return {
      total: sortedTrips.length,
      today: sortedTrips.filter((trip) => trip.travelDate === todayKey).length,
      confirmedTotal,
      patientMessageTotal,
    }
  }, [sortedTrips, todayKey])

  const filteredTrips = useMemo(() => {
    if (selectedDate) {
      return sortedTrips.filter((trip) => trip.travelDate === selectedDate)
    }

    switch (activeFilter) {
      case 'today':
        return sortedTrips.filter((trip) => trip.travelDate === todayKey)
      case 'upcoming':
        return sortedTrips.filter((trip) => String(trip.travelDate ?? '') >= todayKey)
      case 'confirmed':
        return sortedTrips.filter((trip) => !!trip.patientConfirmedAt)
      case 'withMessages':
        return sortedTrips.filter((trip) => (trip.messages ?? []).some((entry) => entry.createdByRole === 'patient'))
      case 'all':
      default:
        return sortedTrips
    }
  }, [activeFilter, selectedDate, sortedTrips, todayKey])

  useEffect(() => {
    if (!filteredTrips.some((trip) => trip.id === expandedTripId)) {
      setExpandedTripId(null)
    }
  }, [expandedTripId, filteredTrips])

  function handleSelectQuickFilter(filter: DriverTripFilter) {
    setActiveFilter(filter)
    setSelectedDate('')
  }

  function handleSelectedDateChange(value: string) {
    setSelectedDate(value)

    if (!value) {
      setActiveFilter('today')
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await loginDriver(cpf, password)
      if (result.mustChangePassword || !result.session) {
        setFirstAccess({ cpf, name: result.name })
        setPassword('')
        return
      }
      saveDriverSession(result.session)
      setSession(result.session)
      showToast({ type: 'success', message: 'Acesso do motorista liberado.' })
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Não foi possível autenticar esse motorista.'
      setError(message)
      showToast({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleFirstAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!firstAccess) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await activateDriverPassword(firstAccess.cpf, newPassword)
      const result = await loginDriver(firstAccess.cpf, newPassword)

      if (!result.session) {
        setError('Não foi possível concluir o primeiro acesso do motorista.')
        showToast({ type: 'error', message: 'Não foi possível concluir o primeiro acesso do motorista.' })
        return
      }

      saveDriverSession(result.session)
      setSession(result.session)
      setFirstAccess(null)
      setNewPassword('')
      setCpf('')
      showToast({ type: 'success', message: 'Novo PIN salvo com sucesso.' })
    } catch (activationError) {
      const message = activationError instanceof Error ? activationError.message : 'Não foi possível concluir o primeiro acesso do motorista.'
      setError(message)
      showToast({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    if (session?.token) {
      try {
        await logoutSession(session.token)
      } catch {
        // A limpeza local continua mesmo se a API não responder.
      }
    }

    clearDriverSession()
    setSession(null)
    setTrips([])
    setExpandedTripId(null)
  }

  function getDraft(requestId: number) {
    return messageDrafts[requestId] ?? { title: '', body: '', visibleToCitizen: false }
  }

  function updateDraft(requestId: number, patch: Partial<{ title: string; body: string; visibleToCitizen: boolean }>) {
    setMessageDrafts((current) => ({
      ...current,
      [requestId]: { ...getDraft(requestId), ...patch },
    }))
  }

  async function handleSubmitMessage(requestId: number) {
    const draft = getDraft(requestId)

    if (!draft.body.trim()) {
      showToast({ type: 'error', message: 'Informe a mensagem antes de enviar.' })
      return
    }

    setMessageSaveState((current) => ({ ...current, [requestId]: 'saving' }))

    try {
      const result = await createDriverRequestMessage({
        requestId,
        title: draft.title,
        body: draft.body,
        visibleToCitizen: draft.visibleToCitizen,
      })

      const refreshed = await fetchDriverTrips(session!.driverId)
      setTrips(refreshed)
      setMessageDrafts((current) => ({
        ...current,
        [requestId]: { title: '', body: '', visibleToCitizen: false },
      }))
      setMessageSaveState((current) => ({ ...current, [requestId]: 'success' }))
      showToast({ type: 'success', message: result.message })

      window.setTimeout(() => {
        setMessageSaveState((current) => ({
          ...current,
          [requestId]: current[requestId] === 'success' ? 'idle' : current[requestId],
        }))
      }, 1400)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Não foi possível enviar a mensagem desta viagem.'
      setMessageSaveState((current) => ({ ...current, [requestId]: 'idle' }))
      showToast({ type: 'error', message })
    }
  }

  if (!session) {
    return (
      <div className="public-shell driver-portal-shell internal-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Portal do motorista</strong>
            <span>Consulte suas viagens, passageiros e orientações da gerência</span>
          </div>
        </section>

        <article className="public-card">
          <div className="eyebrow">
            <BusFront size={16} />
            Acesso do motorista
          </div>
          <h1>Entrar para ver minhas viagens</h1>
          <p>Use seu CPF e PIN para consultar as viagens atribuídas ao seu nome.</p>
          <form onSubmit={handleLogin}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="driver-login-cpf">CPF</label>
                <input
                  id="driver-login-cpf"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="field">
                <label htmlFor="driver-login-password">PIN do motorista</label>
                <input
                  id="driver-login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="0000"
                />
              </div>
            </div>

            <div className="form-actions">
              <AsyncActionButton icon={Search} loading={loading} loadingLabel="Entrando..." type="submit">
                Entrar
              </AsyncActionButton>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        {firstAccess ? (
          <article className="public-card">
            <div className="eyebrow">
              <BusFront size={16} />
              Primeiro acesso
            </div>
            <h2>Cadastrar novo PIN</h2>
            <p>
              {firstAccess.name}, este acesso foi criado com o PIN temporário <strong>0000</strong>. Defina agora um novo PIN numérico de 4 dígitos.
            </p>
            <form onSubmit={handleFirstAccess}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="driver-new-password">Novo PIN do motorista</label>
                  <input
                    id="driver-new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    placeholder="1234"
                  />
                </div>
              </div>

              <div className="form-actions">
                <AsyncActionButton disabled={newPassword.length !== 4} loading={loading} loadingLabel="Salvando novo PIN..." type="submit">
                  Confirmar novo PIN
                </AsyncActionButton>
              </div>
            </form>
          </article>
        ) : null}
      </div>
    )
  }

  return (
    <div className="public-shell driver-portal-shell internal-shell">
      <div className="saas-app-shell">
        <InternalSidebar
          actions={
            <button className="action-button primary" type="button" onClick={handleLogout}>
              <LogOut size={16} />
              Sair
            </button>
          }
          items={[
            { to: '/motorista', label: 'Portal do motorista', icon: BusFront, exact: true },
            { to: '/operador', label: 'Operador', icon: ListChecks },
            { to: '/gerente', label: 'Gerência', icon: Route },
            { to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users },
            { to: '/admin', label: 'Admin', icon: ShieldCheck },
          ]}
          sessionName={session.name}
          sessionRole="Motorista"
          subtitle="Viagens atribuídas pela gerência do transporte em saúde"
          title="Portal do motorista"
        />

        <main className="saas-main">
          <header className="public-header driver-portal-header">
            <div className="eyebrow">
              <BusFront size={16} />
              Motorista autenticado
            </div>
            <div className="driver-hero-row">
              <div>
                <h1>{session.name}</h1>
                <p>Consulte sua rota, acompanhe mensagens e organize o embarque do dia.</p>
                <p>Veículo preferencial: <strong>{session.vehicleName || 'Não definido'}</strong></p>
              </div>
            </div>
          </header>

          {error ? <p className="table-note">{error}</p> : null}

          <section className="driver-toolbar">
        <div className="metrics-grid driver-metrics-grid" aria-label="Resumo do portal do motorista">
          <article className="metric-card">
            <strong>{summary.total}</strong>
            <p>viagem(ns) atribuída(s)</p>
          </article>
          <article className="metric-card emphasis">
            <strong>{summary.today}</strong>
            <p>saída(s) prevista(s) para hoje</p>
          </article>
          <article className="metric-card">
            <strong>{summary.confirmedTotal}</strong>
            <p>agenda(s) confirmada(s) pelo paciente</p>
          </article>
          <article className="metric-card">
            <strong>{summary.patientMessageTotal}</strong>
            <p>viagem(ns) com mensagem do paciente</p>
          </article>
        </div>

        <div className="driver-filter-bar" aria-label="Filtros de viagens">
          {(['today', 'upcoming', 'confirmed', 'withMessages', 'all'] as DriverTripFilter[]).map((filter) => (
            <button
              key={filter}
              className={`driver-filter-chip ${activeFilter === filter ? 'active' : ''}`}
              type="button"
              onClick={() => handleSelectQuickFilter(filter)}
            >
              {getFilterLabel(filter)}
            </button>
          ))}
          <div className="driver-date-filter">
            <label htmlFor="driver-specific-date">Data específica</label>
            <input
              id="driver-specific-date"
              type="date"
              value={selectedDate}
              onChange={(event) => handleSelectedDateChange(event.target.value)}
            />
          </div>
          {selectedDate ? (
            <button className="driver-filter-chip" type="button" onClick={() => handleSelectedDateChange('')}>
              Voltar para hoje
            </button>
          ) : null}
        </div>
      </section>

      <div className="public-layout driver-portal-layout">
        {loading ? (
          <article className="public-card">
            <p className="table-note">Carregando viagens do motorista...</p>
          </article>
        ) : filteredTrips.length > 0 ? (
          <section className="driver-trip-list" aria-label="Lista de viagens do motorista">
            {filteredTrips.map((trip) => {
              const tripMessages = trip.messages ?? []
              const teamMessages = tripMessages.filter((entry) => entry.createdByRole !== 'patient')
              const patientMessages = tripMessages.filter((entry) => entry.createdByRole === 'patient')
              const boardingLocation = getBoardingLocation(trip)
              const patientPhone = isMeaningfulValue(trip.phone) ? trip.phone!.trim() : ''
              const companionPhone = isMeaningfulValue(trip.companionPhone) ? trip.companionPhone!.trim() : ''
              const expanded = expandedTripId === trip.id
              const saveState = messageSaveState[trip.id] ?? 'idle'

              return (
                <article className={`request-card driver-request-card compact ${expanded ? 'expanded' : ''}`} key={trip.id}>
                  <button
                    className="driver-trip-summary"
                    type="button"
                    onClick={() => setExpandedTripId((current) => (current === trip.id ? null : trip.id))}
                    aria-expanded={expanded}
                  >
                    <div className="driver-trip-summary-main">
                      <div className="status-pill-row compact">
                        <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                        {trip.patientConfirmedAt ? <span className="confirmed-badge">Paciente confirmou</span> : null}
                        {patientMessages.length > 0 ? <span className="attention-badge">Mensagem do paciente</span> : null}
                        <span className="status-pill">{trip.protocol}</span>
                      </div>
                      <h2>{getDisplayValue(trip.patientName, 'Paciente não identificado')}</h2>
                      <p className="assignment-patient-name">
                        {trip.destinationCity}/{trip.destinationState} • {formatDisplayDate(trip.travelDate)}
                      </p>
                    </div>

                    <div className="driver-trip-summary-grid" aria-hidden="true">
                      <span>
                        <small>Saída</small>
                        <strong>{trip.departureTime || 'A definir'}</strong>
                      </span>
                      <span>
                        <small>Consulta</small>
                        <strong>{trip.appointmentTime || 'A definir'}</strong>
                      </span>
                      <span>
                        <small>Embarque</small>
                        <strong>{boardingLocation}</strong>
                      </span>
                      <span>
                        <small>Veículo</small>
                        <strong>{trip.assignedVehicleName || session.vehicleName || 'Não definido'}</strong>
                      </span>
                    </div>

                    <span className="driver-trip-expand-icon">
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="driver-trip-details">
                      <div className="travel-actions compact">
                        {boardingLocation !== 'A definir' ? (
                          <a className="action-button secondary" href={buildMapsUrl(boardingLocation)} rel="noreferrer" target="_blank">
                            <MapPin size={16} />
                            Abrir embarque no mapa
                          </a>
                        ) : null}
                        {patientPhone ? (
                          <a className="action-button secondary" href={buildPhoneHref(patientPhone)}>
                            <Phone size={16} />
                            Ligar para o paciente
                          </a>
                        ) : null}
                        {companionPhone ? (
                          <a className="action-button secondary" href={buildPhoneHref(companionPhone)}>
                            <Phone size={16} />
                            Ligar para o acompanhante
                          </a>
                        ) : null}
                      </div>

                      <section className="detail-section-card departure-highlight">
                        <div className="eyebrow">
                          <CalendarClock size={16} />
                          Organização da viagem
                        </div>
                        <dl className="request-summary">
                          <div>
                            <dt>Embarque</dt>
                            <dd>{boardingLocation}</dd>
                          </div>
                          <div>
                            <dt>Motorista</dt>
                            <dd>{session.name}</dd>
                          </div>
                          <div>
                            <dt>Veículo</dt>
                            <dd>{trip.assignedVehicleName || session.vehicleName || 'Não definido'}</dd>
                          </div>
                          <div>
                            <dt>Agenda confirmada</dt>
                            <dd>{formatDisplayTimestamp(trip.patientConfirmedAt)}</dd>
                          </div>
                          <div>
                            <dt>Data e saída</dt>
                            <dd>{formatDisplayDateTime(trip.travelDate, trip.departureTime)}</dd>
                          </div>
                          <div>
                            <dt>Observações da gerência</dt>
                            <dd>{getDisplayValue(trip.managerNotes || trip.notes, 'Sem observações adicionais.')}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className="detail-section-card">
                        <h3>Paciente e atendimento</h3>
                        <dl className="request-summary">
                          <div>
                            <dt>Paciente</dt>
                            <dd>{getDisplayValue(trip.patientName, 'Não informado')}</dd>
                          </div>
                          <div>
                            <dt>Telefone do paciente</dt>
                            <dd>{getDisplayValue(trip.phone)}</dd>
                          </div>
                          <div>
                            <dt>Destino</dt>
                            <dd>{trip.destinationCity}/{trip.destinationState}</dd>
                          </div>
                          <div>
                            <dt>Unidade</dt>
                            <dd>{getDisplayValue(trip.treatmentUnit)}</dd>
                          </div>
                          <div>
                            <dt>Especialidade</dt>
                            <dd>{getDisplayValue(trip.specialty)}</dd>
                          </div>
                          <div>
                            <dt>CPF do paciente</dt>
                            <dd>{trip.cpfMasked}</dd>
                          </div>
                          <div>
                            <dt>Data prevista</dt>
                            <dd>{formatDisplayDate(trip.travelDate)}</dd>
                          </div>
                          <div>
                            <dt>Horário da consulta</dt>
                            <dd>{trip.appointmentTime || 'A definir'}</dd>
                          </div>
                          <div>
                            <dt>Horário de saída</dt>
                            <dd>{trip.departureTime || 'A definir'}</dd>
                          </div>
                          <div>
                            <dt>Acompanhante</dt>
                            <dd>{trip.companionRequired ? getDisplayValue(trip.companionName, 'Sim') : 'Não necessário'}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className="detail-section-card">
                        <h3>Mensagens da equipe</h3>
                        {teamMessages.length > 0 ? (
                          <ol className="status-history">
                            {teamMessages.map((entry) => (
                              <li key={`trip-team-message-${trip.id}-${entry.id}`}>
                                <strong>{entry.title || 'Atualização da viagem'}</strong> por {entry.createdByName}
                                {entry.visibleToCitizen ? ' • visível ao paciente' : ' • interna'}
                                <br />
                                {entry.body}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="table-note">Nenhuma mensagem da equipe registrada para esta viagem.</p>
                        )}
                      </section>

                      {patientMessages.length > 0 ? (
                        <section className="detail-section-card message-highlight">
                          <div className="eyebrow">
                            <MessageSquare size={16} />
                            Mensagens do paciente
                          </div>
                          <ol className="status-history">
                            {patientMessages.map((entry) => (
                              <li key={`trip-patient-message-${trip.id}-${entry.id}`}>
                                <strong>{entry.title || 'Mensagem do paciente'}</strong> em {formatDisplayTimestamp(entry.createdAt)}
                                <br />
                                {entry.body}
                              </li>
                            ))}
                          </ol>
                        </section>
                      ) : null}

                      <section className="detail-section-card">
                        <h3>Nova mensagem</h3>
                        <div className="form-grid" style={{ marginTop: '12px' }}>
                          <div className="field">
                            <label htmlFor={`driver-message-title-${trip.id}`}>Título</label>
                            <input
                              id={`driver-message-title-${trip.id}`}
                              value={getDraft(trip.id).title}
                              onChange={(event) => updateDraft(trip.id, { title: event.target.value })}
                              placeholder="Ex.: Chegada prevista"
                            />
                          </div>
                          <div className="field full">
                            <label htmlFor={`driver-message-body-${trip.id}`}>Mensagem</label>
                            <textarea
                              id={`driver-message-body-${trip.id}`}
                              rows={3}
                              value={getDraft(trip.id).body}
                              onChange={(event) => updateDraft(trip.id, { body: event.target.value })}
                              placeholder="Informe a orientação ou atualização desta viagem."
                            />
                          </div>
                          <div className="field full checkbox-field">
                            <label className="checkbox-row" htmlFor={`driver-message-visible-${trip.id}`}>
                              <input
                                id={`driver-message-visible-${trip.id}`}
                                type="checkbox"
                                checked={getDraft(trip.id).visibleToCitizen}
                                onChange={(event) => updateDraft(trip.id, { visibleToCitizen: event.target.checked })}
                              />
                              <span>Exibir esta mensagem para o paciente na consulta pública</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-actions">
                          <AsyncActionButton
                            className="driver-submit-button"
                            loading={saveState === 'saving'}
                            loadingLabel="Enviando..."
                            onClick={() => void handleSubmitMessage(trip.id)}
                            success={saveState === 'success'}
                            successLabel="Enviado"
                            type="button"
                          >
                            Enviar mensagem
                          </AsyncActionButton>
                        </div>
                      </section>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </section>
        ) : sortedTrips.length > 0 ? (
          <article className="empty-state">
            <BusFront size={28} />
            <h2>{selectedDate ? `Nenhuma viagem em ${formatDisplayDate(selectedDate)}` : `Nenhuma viagem em ${getFilterLabel(activeFilter).toLowerCase()}`}</h2>
            <p>Use outro filtro para visualizar viagens futuras, confirmadas, com mensagem do paciente ou escolha uma data específica.</p>
          </article>
        ) : (
          <article className="empty-state">
            <BusFront size={28} />
            <h2>Nenhuma viagem atribuída ainda</h2>
            <p>Quando a gerência vincular um roteiro ao seu CPF, ele aparecerá aqui com passageiros, embarque e orientações.</p>
          </article>
        )}
      </div>
        </main>
      </div>
    </div>
  )
}
