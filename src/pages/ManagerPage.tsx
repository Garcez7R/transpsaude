import { ArrowLeft, LockKeyhole, LogOut, RefreshCcw, Route, Save, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessManager, getInternalRoleLabel, isValidInternalRole } from '../lib/access'
import { boardingLocations } from '../lib/boarding-locations'
import { activateAdminPassword, assignDriver, fetchDrivers, fetchRequests, fetchVehicles, loginAdmin, logoutSession } from '../lib/api'
import { clearAdminSession, saveAdminSession } from '../lib/admin-session'
import { clearAdminAreaSession } from '../lib/admin-area-session'
import { clearManagerSession, getManagerSession, saveManagerSession } from '../lib/manager-session'
import type { AdminSession, DriverRecord, TravelRequest, VehicleRecord } from '../types'

type AssignmentState = Record<
  number,
  {
    driverId: string
    vehicleId: string
    departureTime: string
    appointmentTime: string
    managerNotes: string
    useCustomBoardingLocation: boolean
    boardingLocationName: string
    showDriverPhoneToPatient: boolean
  }
>

const emptyAssignment = {
  driverId: '',
  vehicleId: '',
  departureTime: '',
  appointmentTime: '',
  managerNotes: '',
  useCustomBoardingLocation: false,
  boardingLocationName: '',
  showDriverPhoneToPatient: true,
}

const statusLabels: Record<TravelRequest['status'], string> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  aguardando_documentos: 'Aguardando documentos',
  aprovada: 'Aprovada',
  agendada: 'Agendada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
}

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

export function ManagerPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)

  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [selectedStatus, setSelectedStatus] = useState<'todos' | TravelRequest['status']>('todos')
  const [search, setSearch] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [destination, setDestination] = useState('')
  const [driverFilterId, setDriverFilterId] = useState('')
  const [assignment, setAssignment] = useState<AssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reports = useMemo(() => {
    const scheduledTotal = requests.filter((request) => request.status === 'agendada').length
    const pendingTotal = requests.filter((request) => request.status === 'aguardando_documentos').length
    const withoutDriverTotal = requests.filter((request) => !request.assignedDriverName).length
    const confirmedByPatientTotal = requests.filter((request) => !!request.patientConfirmedAt).length
    const unreadPatientMessagesTotal = requests.filter((request) => !!request.hasUnreadPatientMessage).length

    return {
      scheduledTotal,
      pendingTotal,
      withoutDriverTotal,
      confirmedByPatientTotal,
      unreadPatientMessagesTotal,
      total: requests.length,
    }
  }, [requests])

  const visibleCountLabel = useMemo(() => {
    if (loading) {
      return 'Carregando solicitações...'
    }

    return `${requests.length} solicitação(ões) no recorte atual`
  }, [loading, requests.length])

  useEffect(() => {
    setSession(getManagerSession())
  }, [])

  useEffect(() => {
    if (!session || !canAccessManager(session)) {
      return
    }

    let active = true

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [requestData, driverData, vehicleData] = await Promise.all([
          fetchRequests({
            status: selectedStatus,
            search,
            travelDate,
            dateFrom,
            dateTo,
            destination,
            driverId: driverFilterId ? Number(driverFilterId) : null,
          }),
          fetchDrivers(),
          fetchVehicles(),
        ])

        if (!active) {
          return
        }

        setRequests(requestData)
        setDrivers(driverData)
        setVehicles(vehicleData)
        setAssignment(
          Object.fromEntries(
            requestData.map((request) => [
              request.id,
              {
                driverId: request.assignedDriverId ? String(request.assignedDriverId) : '',
                vehicleId: request.assignedVehicleId ? String(request.assignedVehicleId) : '',
                departureTime: request.departureTime ?? '',
                appointmentTime: request.appointmentTime ?? '',
                managerNotes: request.managerNotes ?? '',
                useCustomBoardingLocation: request.useCustomBoardingLocation ?? false,
                boardingLocationName: request.boardingLocationName ?? '',
                showDriverPhoneToPatient: request.showDriverPhoneToPatient ?? true,
              },
            ]),
          ),
        )
      } catch {
        if (active) {
          setError('Não foi possível carregar a tela de gerência.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [dateFrom, dateTo, destination, driverFilterId, search, selectedStatus, session, travelDate])

  function applyQuickPeriod(mode: 'today' | 'tomorrow' | 'week') {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    if (mode === 'today') {
      setTravelDate('')
      setDateFrom(today)
      setDateTo(today)
      return
    }

    if (mode === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const value = tomorrow.toISOString().slice(0, 10)
      setTravelDate('')
      setDateFrom(value)
      setDateTo(value)
      return
    }

    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    setTravelDate('')
    setDateFrom(today)
    setDateTo(weekEnd.toISOString().slice(0, 10))
  }

  function updateAssignment(
    requestId: number,
    key:
      | 'driverId'
      | 'vehicleId'
      | 'departureTime'
      | 'appointmentTime'
      | 'managerNotes'
      | 'boardingLocationName'
      | 'useCustomBoardingLocation'
      | 'showDriverPhoneToPatient',
    value: string | boolean,
  ) {
    setAssignment((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] ?? emptyAssignment),
        [key]: value,
      },
    }))
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const result = await loginAdmin(cpf, password)

      if (result.mustChangePassword || !result.session) {
        setFirstAccess({ cpf, name: result.name })
        setPassword('')
        return
      }

      if (!isValidInternalRole(result.session.role) || !canAccessManager(result.session)) {
        setAuthError('Esse perfil não tem permissão para acessar a gerência.')
        return
      }

      saveAdminSession(result.session)
      saveManagerSession(result.session)
      setSession(result.session)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível autenticar esse acesso de gerência.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleFirstAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!firstAccess) {
      return
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      await activateAdminPassword(firstAccess.cpf, newPassword)
      const result = await loginAdmin(firstAccess.cpf, newPassword)

      if (!result.session || !isValidInternalRole(result.session.role) || !canAccessManager(result.session)) {
        setAuthError('Esse perfil não tem permissão para acessar a gerência.')
        return
      }

      saveAdminSession(result.session)
      saveManagerSession(result.session)
      setSession(result.session)
      setFirstAccess(null)
      setNewPassword('')
      setCpf('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível concluir o primeiro acesso.')
    } finally {
      setAuthLoading(false)
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

    clearAdminSession()
    clearManagerSession()
    clearAdminAreaSession()
    setSession(null)
    setRequests([])
    setDrivers([])
    setVehicles([])
  }

  async function handleAssign(requestId: number) {
    const data = assignment[requestId]

    if (!data?.driverId || !data.vehicleId || !data.departureTime || !data.appointmentTime) {
      setError('Selecione um motorista, um veículo, o horário da consulta e o horário de saída.')
      return
    }

    if (data.useCustomBoardingLocation && !data.boardingLocationName) {
      setError('Selecione um ponto oficial de embarque quando essa opção estiver ativada.')
      return
    }

    setSavingId(requestId)
    setError('')
    setMessage('')

    try {
      const result = await assignDriver({
        requestId,
        driverId: Number(data.driverId),
        vehicleId: Number(data.vehicleId),
        departureTime: data.departureTime,
        appointmentTime: data.appointmentTime,
        managerNotes: data.managerNotes,
        useCustomBoardingLocation: data.useCustomBoardingLocation,
        boardingLocationName: data.boardingLocationName,
        showDriverPhoneToPatient: data.showDriverPhoneToPatient,
      })

      setMessage(result.message)
      const refreshed = await fetchRequests({
        status: selectedStatus,
        search,
        travelDate,
        dateFrom,
        dateTo,
        destination,
        driverId: driverFilterId ? Number(driverFilterId) : null,
      })
      setRequests(refreshed)
    } catch {
      setError('Não foi possível atribuir o motorista para essa viagem.')
    } finally {
      setSavingId(null)
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
            <strong>Gerência de transporte em saúde</strong>
            <span>Acesso reservado a gerente e administrador</span>
          </div>
        </section>

        <section className="auth-shell">
          <article className="content-card login-card">
            <div className="eyebrow">
              <LockKeyhole size={16} />
              Acesso da gerência
            </div>
            <h1>Entrar na gerência</h1>
            <p>Somente gerente ou administrador podem acessar esta área.</p>
            <form onSubmit={handleLogin}>
              <div className="login-grid">
                <div className="field">
                  <label htmlFor="manager-cpf">CPF do gerente</label>
                  <input
                    id="manager-cpf"
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="manager-password">Senha</label>
                  <input
                    id="manager-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Sua senha"
                    type="password"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={authLoading} type="submit">
                  <ShieldCheck size={16} />
                  {authLoading ? 'Entrando...' : 'Entrar na gerência'}
                </button>
                <Link className="action-button secondary" to="/operador">
                  Ir para operador
                </Link>
              </div>
            </form>
            {authError ? <p className="table-note">{authError}</p> : null}
          </article>

          {firstAccess ? (
            <article className="content-card login-card">
              <div className="eyebrow">
                <LockKeyhole size={16} />
                Primeiro acesso
              </div>
              <h2>Cadastrar novo PIN</h2>
              <p>
                {firstAccess.name}, este acesso foi criado com o PIN temporário <strong>0000</strong>. Defina agora um novo PIN numérico de 4 dígitos.
              </p>
              <form onSubmit={handleFirstAccess}>
                <div className="login-grid">
                  <div className="field">
                    <label htmlFor="manager-new-password">Novo PIN do gerente</label>
                    <input
                      id="manager-new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      inputMode="numeric"
                      placeholder="1234"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="action-button primary" disabled={authLoading || newPassword.length !== 4} type="submit">
                    {authLoading ? 'Salvando novo PIN...' : 'Confirmar novo PIN'}
                  </button>
                </div>
              </form>
            </article>
          ) : null}
        </section>
      </div>
    )
  }

  if (!canAccessManager(session)) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Acesso negado</h2>
          <p>Seu perfil atual não tem permissão para entrar na gerência.</p>
          <div className="form-actions">
            <Link className="action-button secondary" to="/operador">
              Ir para operador
            </Link>
            <button className="action-button primary" type="button" onClick={handleLogout}>
              <LogOut size={16} />
              Sair
            </button>
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
          <strong>Gerência de transporte em saúde</strong>
          <span>Análise, organização de viagens e atribuição de motoristas</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <Route size={16} />
            Painel do gerente
          </div>
          <h1>Distribuir viagens para os motoristas</h1>
          <p>
            Sessão ativa para <strong>{session.name}</strong> com perfil <strong>{getInternalRoleLabel(session.role)}</strong>.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/gerente/pacientes">
            Base de pacientes
          </Link>
          <Link className="action-button secondary" to="/gerente/equipe">
            Equipe e veículos
          </Link>
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Operador
          </Link>
          <button className="action-button primary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      <section className="metrics-grid">
        <article className="metric-card">
          <strong>{reports.total}</strong>
          <p>solicitações no relatório</p>
        </article>
        <article className="metric-card">
          <strong>{reports.scheduledTotal}</strong>
          <p>viagens agendadas</p>
        </article>
        <article className="metric-card">
          <strong>{reports.pendingTotal}</strong>
          <p>aguardando documentos</p>
        </article>
        <article className="metric-card">
          <strong>{reports.withoutDriverTotal}</strong>
          <p>ainda sem motorista</p>
        </article>
      </section>

      <section className="content-card">
        <h2>Agendamentos e solicitações</h2>
        <div className="filter-stack">
          <div className="field">
            <label htmlFor="manager-search">Buscar</label>
            <div className="operator-search-inline">
              <input
                id="manager-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Paciente, protocolo, CPF, unidade..."
              />
              <button className="action-button primary" type="button" onClick={() => setSearch((current) => current.trimStart())}>
                <Search size={16} />
                Buscar
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="manager-date">Data da viagem</label>
            <input
              id="manager-date"
              type="date"
              value={travelDate}
              onChange={(event) => setTravelDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="manager-date-from">Período inicial</label>
            <input
              id="manager-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="manager-date-to">Período final</label>
            <input
              id="manager-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="manager-destination">Destino</label>
            <input
              id="manager-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Cidade de destino"
            />
          </div>
          <div className="field">
            <label htmlFor="manager-status">Status</label>
            <select
              id="manager-status"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as 'todos' | TravelRequest['status'])}
            >
              <option value="todos">Todos os status</option>
              <option value="recebida">Recebida</option>
              <option value="em_analise">Em análise</option>
              <option value="aguardando_documentos">Aguardando documentos</option>
              <option value="aprovada">Aprovada</option>
              <option value="agendada">Agendada</option>
              <option value="cancelada">Cancelada</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="manager-driver-filter">Motorista</label>
            <select
              id="manager-driver-filter"
              value={driverFilterId}
              onChange={(event) => setDriverFilterId(event.target.value)}
            >
              <option value="">Todos os motoristas</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button className="action-button secondary" type="button" onClick={() => applyQuickPeriod('today')}>
            Hoje
          </button>
          <button className="action-button secondary" type="button" onClick={() => applyQuickPeriod('tomorrow')}>
            Amanhã
          </button>
          <button className="action-button secondary" type="button" onClick={() => applyQuickPeriod('week')}>
            Esta semana
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              setSelectedStatus('todos')
              setSearch('')
              setTravelDate('')
              setDateFrom('')
              setDateTo('')
              setDestination('')
              setDriverFilterId('')
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="status-line">
          <span className="subtle-label">
            {search || travelDate || dateFrom || dateTo || destination || driverFilterId ? <Search size={14} /> : <RefreshCcw size={14} />}
            {visibleCountLabel}
          </span>
          <span className="status-pill">Confirmadas pelo paciente: {reports.confirmedByPatientTotal}</span>
          <span className={reports.unreadPatientMessagesTotal > 0 ? 'attention-badge' : 'read-badge'}>
            {reports.unreadPatientMessagesTotal > 0
              ? `${reports.unreadPatientMessagesTotal} com mensagem nova do paciente`
              : 'Sem mensagem nova do paciente'}
          </span>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-single">
        <div className="content-card">
          <h2>Distribuição das solicitações</h2>
          {loading ? (
            <p className="table-note">Carregando viagens...</p>
          ) : (
            <div className="assignment-list scroll-list">
              {requests.map((request) => {
                const data = assignment[request.id] ?? emptyAssignment

                return (
                  <article className="assignment-card manager-request-card" key={request.id}>
                    <div className="assignment-header">
                      <div>
                        <strong>{request.patientName}</strong>
                        <p className="table-note">
                          {request.protocol} • {request.destinationCity}/{request.destinationState} • {formatDisplayDate(request.travelDate)}
                        </p>
                        <p className="assignment-patient-name">
                          {request.accessCpfMasked ?? request.cpfMasked} • {request.treatmentUnit}
                        </p>
                        <p className="table-note">
                          <Link className="inline-link" to={`/operador/solicitacoes/${request.id}`}>
                            Abrir detalhe completo da solicitação
                          </Link>
                        </p>
                      </div>
                      <span className={`status-badge ${request.status}`}>{statusLabels[request.status]}</span>
                    </div>

                    <div className="travel-overview-grid">
                      <article className="travel-overview-card">
                        <span>Consulta</span>
                        <strong>{request.appointmentTime || 'Não definido'}</strong>
                      </article>
                      <article className="travel-overview-card">
                        <span>Saída</span>
                        <strong>{request.departureTime || 'Não definido'}</strong>
                      </article>
                      <article className="travel-overview-card">
                        <span>Motorista</span>
                        <strong>{request.assignedDriverName || 'Não atribuído'}</strong>
                      </article>
                      <article className="travel-overview-card">
                        <span>Embarque</span>
                        <strong>{request.boardingLocationLabel || request.addressLine || 'Não informado'}</strong>
                      </article>
                    </div>

                    <div className="assignment-meta">
                      <span>Veículo da viagem: {request.assignedVehicleName || 'Não definido'}</span>
                      <span>Telefone do motorista ao paciente: {request.showDriverPhoneToPatient ? 'Visível' : 'Oculto'}</span>
                      <span>Acompanhante: {request.companionRequired ? 'Sim' : 'Não'}</span>
                      {Number(request.patientMessageCount ?? 0) > 0 ? (
                        <span>{request.hasUnreadPatientMessage ? 'Nova mensagem do paciente' : 'Mensagem do paciente já lida'}</span>
                      ) : null}
                      {request.companionRequired && request.companionName ? (
                        <span>
                          Acompanhante: {request.companionName} {request.companionCpfMasked ? `• ${request.companionCpfMasked}` : ''}
                        </span>
                      ) : null}
                    </div>

                    <div className="status-pill-row">
                      {request.patientConfirmedAt ? <span className="confirmed-badge">Confirmada pelo paciente</span> : null}
                      {request.patientLastViewedAt ? <span className="status-pill-live">Lida pelo paciente</span> : null}
                      {Number(request.patientMessageCount ?? 0) > 0 ? (
                        <Link
                          className={`${request.hasUnreadPatientMessage ? 'attention-badge' : 'read-badge'} inline-link`}
                          to={`/operador/solicitacoes/${request.id}#mensagens-paciente`}
                        >
                          {request.hasUnreadPatientMessage ? 'Nova mensagem do paciente' : 'Mensagem do paciente lida'}
                        </Link>
                      ) : null}
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor={`driver-${request.id}`}>Motorista</label>
                        <select
                          id={`driver-${request.id}`}
                          value={data.driverId}
                          onChange={(event) => {
                            const nextDriverId = event.target.value
                            const selectedDriver = drivers.find((driver) => String(driver.id) === nextDriverId)
                            updateAssignment(request.id, 'driverId', nextDriverId)

                            if (selectedDriver?.vehicleId) {
                              updateAssignment(request.id, 'vehicleId', String(selectedDriver.vehicleId))
                            }
                          }}
                        >
                          <option value="">Selecione</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`vehicle-${request.id}`}>Veículo da viagem</label>
                        <select
                          id={`vehicle-${request.id}`}
                          value={data.vehicleId}
                          onChange={(event) => updateAssignment(request.id, 'vehicleId', event.target.value)}
                        >
                          <option value="">Selecione</option>
                          {vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.name} • {vehicle.plate}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`appointment-${request.id}`}>Horário da consulta</label>
                        <input
                          id={`appointment-${request.id}`}
                          type="time"
                          value={data.appointmentTime}
                          onChange={(event) => updateAssignment(request.id, 'appointmentTime', event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`departure-${request.id}`}>Horário de saída</label>
                        <input
                          id={`departure-${request.id}`}
                          type="time"
                          value={data.departureTime}
                          onChange={(event) => updateAssignment(request.id, 'departureTime', event.target.value)}
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor={`notes-${request.id}`}>Observações do gerente</label>
                        <textarea
                          id={`notes-${request.id}`}
                          rows={3}
                          value={data.managerNotes}
                          onChange={(event) => updateAssignment(request.id, 'managerNotes', event.target.value)}
                          placeholder="Ponto de saída, observações de rota, documentos ou orientações para o motorista."
                        />
                      </div>
                      <div className="field checkbox-field checkbox-field-inline">
                        <label className="checkbox-row" htmlFor={`show-driver-phone-${request.id}`}>
                          <input
                            id={`show-driver-phone-${request.id}`}
                            type="checkbox"
                            checked={data.showDriverPhoneToPatient}
                            onChange={(event) =>
                              updateAssignment(request.id, 'showDriverPhoneToPatient', event.target.checked)
                            }
                          />
                          <span>Exibir telefone do motorista para o paciente</span>
                        </label>
                      </div>
                      <div className="field checkbox-field checkbox-field-inline">
                        <label className="checkbox-row" htmlFor={`boarding-flag-${request.id}`}>
                          <input
                            id={`boarding-flag-${request.id}`}
                            type="checkbox"
                            checked={data.useCustomBoardingLocation}
                            onChange={(event) =>
                              updateAssignment(request.id, 'useCustomBoardingLocation', event.target.checked)
                            }
                          />
                          <span>Usar ponto oficial de embarque em vez do endereço do paciente</span>
                        </label>
                      </div>
                      {data.useCustomBoardingLocation ? (
                        <div className="field full">
                          <label htmlFor={`boarding-location-${request.id}`}>Ponto oficial de embarque</label>
                          <select
                            id={`boarding-location-${request.id}`}
                            value={data.boardingLocationName}
                            onChange={(event) =>
                              updateAssignment(request.id, 'boardingLocationName', event.target.value)
                            }
                          >
                            <option value="">Selecione um ponto</option>
                            {boardingLocations.map((location) => (
                              <option key={location} value={location}>
                                {location}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="field full">
                          <label>Endereço padrão de embarque</label>
                          <input value={request.addressLine || 'Não informado'} readOnly />
                        </div>
                      )}
                    </div>

                    <div className="form-actions">
                      <button
                        className="action-button primary"
                        type="button"
                        disabled={savingId === request.id}
                        onClick={() => void handleAssign(request.id)}
                      >
                        <Save size={16} />
                        {savingId === request.id ? 'Salvando...' : 'Atribuir motorista'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
