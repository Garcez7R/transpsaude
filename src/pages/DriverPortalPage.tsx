import { BusFront, CalendarClock, LogOut, MapPin, MessageSquare, Phone, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { activateDriverPassword, createDriverRequestMessage, fetchDriverTrips, loginDriver, logoutSession } from '../lib/api'
import { clearDriverSession, getDriverSession, saveDriverSession } from '../lib/driver-session'
import type { DriverSession, TravelRequest } from '../types'

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

export function DriverPortalPage() {
  const [session, setSession] = useState<DriverSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [trips, setTrips] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)
  const [messageDrafts, setMessageDrafts] = useState<Record<number, { title: string; body: string; visibleToCitizen: boolean }>>({})
  const [messageStatus, setMessageStatus] = useState<Record<number, string>>({})
  const [sendingMessageId, setSendingMessageId] = useState<number | null>(null)

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
      } catch {
        if (active) {
          setError('Não foi possível carregar as viagens do motorista.')
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
  }, [session])

  const sortedTrips = useMemo(
    () =>
      [...trips].sort((left, right) => {
        const leftKey = `${left.travelDate ?? ''} ${left.departureTime ?? left.appointmentTime ?? ''}`.trim()
        const rightKey = `${right.travelDate ?? ''} ${right.departureTime ?? right.appointmentTime ?? ''}`.trim()
        return leftKey.localeCompare(rightKey)
      }),
    [trips],
  )

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const confirmedTotal = sortedTrips.filter((trip) => !!trip.patientConfirmedAt).length
    const patientMessageTotal = sortedTrips.filter((trip) => (trip.messages ?? []).some((entry) => entry.createdByRole === 'patient')).length

    return {
      total: sortedTrips.length,
      today: sortedTrips.filter((trip) => trip.travelDate === today).length,
      confirmedTotal,
      patientMessageTotal,
    }
  }, [sortedTrips])

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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível autenticar esse motorista.')
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
        return
      }

      saveDriverSession(result.session)
      setSession(result.session)
      setFirstAccess(null)
      setNewPassword('')
      setCpf('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível concluir o primeiro acesso do motorista.')
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
  }

  function getDraft(requestId: number) {
    return messageDrafts[requestId] ?? { title: '', body: '', visibleToCitizen: false }
  }

  async function handleSubmitMessage(requestId: number) {
    const draft = getDraft(requestId)

    if (!draft.body.trim()) {
      setMessageStatus((current) => ({ ...current, [requestId]: 'Informe a mensagem antes de enviar.' }))
      return
    }

    setSendingMessageId(requestId)
    setMessageStatus((current) => ({ ...current, [requestId]: '' }))

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
      setMessageStatus((current) => ({ ...current, [requestId]: result.message }))
    } catch (error) {
      setMessageStatus((current) => ({
        ...current,
        [requestId]: error instanceof Error ? error.message : 'Não foi possível enviar a mensagem desta viagem.',
      }))
    } finally {
      setSendingMessageId(null)
    }
  }

  if (!session) {
    return (
      <div className="public-shell driver-portal-shell">
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
              <button className="action-button primary" disabled={loading} type="submit">
                <Search size={16} />
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
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
                <button className="action-button primary" disabled={loading || newPassword.length !== 4} type="submit">
                  {loading ? 'Salvando novo PIN...' : 'Confirmar novo PIN'}
                </button>
              </div>
            </form>
          </article>
        ) : null}
      </div>
    )
  }

  return (
    <div className="public-shell driver-portal-shell">
      <section className="institutional-bar institutional-bar-inner">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Portal do motorista</strong>
          <span>Viagens atribuídas pela gerência do transporte em saúde</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <BusFront size={16} />
          Motorista autenticado
        </div>
        <h1>{session.name}</h1>
        <p>
          Sessão ativa para <strong>{session.name}</strong> com perfil <strong>motorista</strong>.
        </p>
        <p>Veículo preferencial: <strong>{session.vehicleName || 'Não definido'}</strong></p>
        <div className="form-actions driver-header-actions">
          <button className="action-button secondary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}

      <section className="metrics-grid driver-metrics-grid" aria-label="Resumo do portal do motorista">
        <article className="metric-card">
          <strong>{summary.total}</strong>
          <p>viagem(ns) atribuída(s)</p>
        </article>
        <article className="metric-card">
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
      </section>

      <div className="public-layout driver-portal-layout">
        {loading ? (
          <article className="public-card">
            <p className="table-note">Carregando viagens do motorista...</p>
          </article>
        ) : sortedTrips.length > 0 ? (
          sortedTrips.map((trip) => {
            const tripMessages = trip.messages ?? []
            const teamMessages = tripMessages.filter((entry) => entry.createdByRole !== 'patient')
            const patientMessages = tripMessages.filter((entry) => entry.createdByRole === 'patient')
            const boardingLocation = getBoardingLocation(trip)
            const patientPhone = isMeaningfulValue(trip.phone) ? trip.phone!.trim() : ''
            const companionPhone = isMeaningfulValue(trip.companionPhone) ? trip.companionPhone!.trim() : ''

            return (
              <article className="request-card driver-request-card" key={trip.id}>
                <div className="status-pill-row">
                  <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                  {trip.patientConfirmedAt ? <span className="confirmed-badge">Paciente confirmou</span> : null}
                  {patientMessages.length > 0 ? <span className="attention-badge">Mensagem do paciente</span> : null}
                  <span className="status-pill">{trip.protocol}</span>
                </div>

                <div className="assignment-header">
                  <div>
                    <h2>{getDisplayValue(trip.patientName, 'Paciente não identificado')}</h2>
                    <p className="assignment-patient-name">
                      {formatDisplayDateTime(trip.travelDate, trip.departureTime)} • {trip.destinationCity}/{trip.destinationState}
                    </p>
                  </div>
                </div>

                <div className="travel-overview-grid">
                  <article className="travel-overview-card">
                    <span>Consulta</span>
                    <strong>{trip.appointmentTime || 'A definir'}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Saída</span>
                    <strong>{trip.departureTime || 'A definir'}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Embarque</span>
                    <strong>{boardingLocation}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Veículo</span>
                    <strong>{trip.assignedVehicleName || session.vehicleName || 'Não definido'}</strong>
                  </article>
                </div>

                <div className="travel-actions">
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
                        onChange={(event) => setMessageDrafts((current) => ({
                          ...current,
                          [trip.id]: { ...getDraft(trip.id), title: event.target.value },
                        }))}
                        placeholder="Ex.: Chegada prevista"
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor={`driver-message-body-${trip.id}`}>Mensagem</label>
                      <textarea
                        id={`driver-message-body-${trip.id}`}
                        rows={3}
                        value={getDraft(trip.id).body}
                        onChange={(event) => setMessageDrafts((current) => ({
                          ...current,
                          [trip.id]: { ...getDraft(trip.id), body: event.target.value },
                        }))}
                        placeholder="Informe a orientação ou atualização desta viagem."
                      />
                    </div>
                    <div className="field full checkbox-field">
                      <label className="checkbox-row" htmlFor={`driver-message-visible-${trip.id}`}>
                        <input
                          id={`driver-message-visible-${trip.id}`}
                          type="checkbox"
                          checked={getDraft(trip.id).visibleToCitizen}
                          onChange={(event) => setMessageDrafts((current) => ({
                            ...current,
                            [trip.id]: { ...getDraft(trip.id), visibleToCitizen: event.target.checked },
                          }))}
                        />
                        <span>Exibir esta mensagem para o paciente na consulta pública</span>
                      </label>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="action-button primary" disabled={sendingMessageId === trip.id} onClick={() => void handleSubmitMessage(trip.id)} type="button">
                      {sendingMessageId === trip.id ? 'Enviando...' : 'Enviar mensagem'}
                    </button>
                  </div>
                  {messageStatus[trip.id] ? <p className="table-note">{messageStatus[trip.id]}</p> : null}
                </section>
              </article>
            )
          })
        ) : (
          <article className="empty-state">
            <BusFront size={28} />
            <h2>Nenhuma viagem atribuída ainda</h2>
            <p>Quando a gerência vincular um roteiro ao seu CPF, ele aparecerá aqui com passageiros, embarque e orientações.</p>
          </article>
        )}
      </div>
    </div>
  )
}
