import { ArrowLeft, BusFront, LockKeyhole, LogOut, RefreshCcw, Route, Save, Search, ShieldCheck, UserRoundSearch, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdvancedFilters } from '../components/AdvancedFilters'
import { AsyncActionButton } from '../components/AsyncActionButton'
import { Pagination } from '../components/Pagination'
import { InternalSidebar } from '../components/InternalSidebar'
import { canAccessManager, getInternalRoleLabel, isValidInternalRole } from '../lib/access'
import { boardingLocations } from '../lib/boarding-locations'
import { activateAdminPassword, assignDriver, fetchDrivers, fetchRequests, fetchVehicles, loginAdmin, logoutSession } from '../lib/api'
import { clearAdminSession, saveAdminSession } from '../lib/admin-session'
import { clearAdminAreaSession } from '../lib/admin-area-session'
import { clearManagerSession, getManagerSession, saveManagerSession } from '../lib/manager-session'
import { useToastOnChange } from '../lib/use-toast-on-change'
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

type PeriodPreset = 'custom' | 'today' | 'tomorrow' | 'week' | 'next15' | 'month'

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

function isMeaningfulValue(value?: string | null) {
  const text = String(value ?? '').trim()

  if (!text) {
    return false
  }

  if (text.length === 1) {
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
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('custom')
  const [destination, setDestination] = useState('')
  const [driverFilterId, setDriverFilterId] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [assignment, setAssignment] = useState<AssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12

  useToastOnChange(authError, 'error')
  useToastOnChange(error, 'error')
  useToastOnChange(message, 'success')

  const hasAdvancedFilters =
    Boolean(travelDate) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(destination) ||
    Boolean(driverFilterId)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedStatus, travelDate, dateFrom, dateTo, destination, driverFilterId])

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

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return requests.slice(start, end)
  }, [currentPage, requests])

  const totalPages = Math.ceil(requests.length / ITEMS_PER_PAGE)

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (paginatedRequests.length === 0) {
      setSelectedRequestId(null)
      return
    }

    if (!selectedRequestId || !paginatedRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(paginatedRequests[0].id)
    }
  }, [paginatedRequests, selectedRequestId])

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ??
    requests[0] ??
    null
  const selectedAssignment = selectedRequest ? assignment[selectedRequest.id] ?? emptyAssignment : emptyAssignment

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
        setSelectedRequestId((current) =>
          requestData.some((request) => request.id === current) ? current : (requestData[0]?.id ?? null),
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

  function applyQuickPeriod(mode: Exclude<PeriodPreset, 'custom'>) {
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

    if (mode === 'week') {
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() + 7)
      setTravelDate('')
      setDateFrom(today)
      setDateTo(weekEnd.toISOString().slice(0, 10))
      return
    }

    if (mode === 'next15') {
      const end = new Date(now)
      end.setDate(end.getDate() + 15)
      setTravelDate('')
      setDateFrom(today)
      setDateTo(end.toISOString().slice(0, 10))
      return
    }

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setTravelDate('')
    setDateFrom(today)
    setDateTo(monthEnd.toISOString().slice(0, 10))
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

    if (!data?.driverId) {
      setError('Selecione um motorista para vincular esta viagem.')
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
        vehicleId: data.vehicleId ? Number(data.vehicleId) : undefined,
        departureTime: data.departureTime || undefined,
        appointmentTime: data.appointmentTime || undefined,
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
      setSelectedRequestId((current) =>
        refreshed.some((request) => request.id === current) ? current : (refreshed[0]?.id ?? null),
      )
    } catch {
      setError('Não foi possível atribuir o motorista para essa viagem.')
    } finally {
      setSavingId(null)
    }
  }

  if (!session) {
    return (
      <div className="dashboard-shell internal-shell">
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
                <AsyncActionButton icon={ShieldCheck} loading={authLoading} loadingLabel="Entrando..." type="submit">
                  Entrar na gerência
                </AsyncActionButton>
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
                  <AsyncActionButton disabled={newPassword.length !== 4} loading={authLoading} loadingLabel="Salvando novo PIN..." type="submit">
                    Confirmar novo PIN
                  </AsyncActionButton>
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
      <div className="dashboard-shell internal-shell">
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
    <div className="dashboard-shell internal-shell">
      <div className="saas-app-shell">
        <InternalSidebar
          actions={
            <>
              <Link className="action-button secondary" to="/operador">
                <ArrowLeft size={16} />
                Operador
              </Link>
              <button className="action-button primary" type="button" onClick={handleLogout}>
                <LogOut size={16} />
                Sair
              </button>
            </>
          }
          items={[
            { to: '/gerente', label: 'Gerência', icon: Route, exact: true },
            { to: '/gerente/pacientes', label: 'Base de pacientes', icon: UserRoundSearch },
            { to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users },
            { to: '/operador', label: 'Operador', icon: ArrowLeft },
            { to: '/motorista', label: 'Portal do motorista', icon: BusFront },
          ]}
          sessionName={session.name}
          sessionRole={getInternalRoleLabel(session.role)}
          subtitle="Análise, organização de viagens e atribuição de motoristas"
          title="Gerência de transporte"
        />

        <main className="saas-main saas-main--admin">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <Route size={16} />
                Painel do gerente
              </div>
              <h1>Distribuir viagens para os motoristas</h1>
              <p>Planeje a operação do dia, defina a ordem das agendas e distribua a rota com mais clareza.</p>
            </div>

            <div className="page-actions">
              <Link className="action-button secondary" to="/gerente/pacientes">
                Base de pacientes
              </Link>
              <Link className="action-button primary" to="/gerente/equipe">
                Equipe e veículos
              </Link>
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

      <section className="content-card compact-workspace-card data-access-card">
        <h2>Agendamentos e solicitações</h2>
          <div className="filter-stack">
            <div className="field full">
              <label htmlFor="manager-search">Buscar</label>
              <input
                id="manager-search"
              value={search}
              onChange={(event) => setSearch(event.target.value.trimStart())}
              placeholder="Paciente, protocolo, CPF, unidade..."
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
            <AdvancedFilters
              label="Filtros avançados"
              hasActiveFilters={hasAdvancedFilters}
              onClear={() => {
                setTravelDate('')
                setDateFrom('')
                setDateTo('')
                setDestination('')
                setDriverFilterId('')
              }}
            >
              <div className="field">
                <label htmlFor="manager-date">Data da viagem</label>
                <input
                  id="manager-date"
                  type="date"
                  value={travelDate}
                  onChange={(event) => {
                    setPeriodPreset('custom')
                    setTravelDate(event.target.value)
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="manager-date-from">Período inicial</label>
                <input
                  id="manager-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setPeriodPreset('custom')
                    setDateFrom(event.target.value)
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="manager-date-to">Período final</label>
                <input
                  id="manager-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setPeriodPreset('custom')
                    setDateTo(event.target.value)
                  }}
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
            </AdvancedFilters>
          </div>
        <div className="filter-actions compact-filter-actions">
          <div className="field period-inline-field">
            <label htmlFor="manager-period-preset">Período rápido</label>
            <select
              id="manager-period-preset"
              value={periodPreset}
              onChange={(event) => {
                const value = event.target.value as PeriodPreset
                setPeriodPreset(value)
                if (value === 'custom') {
                  return
                }
                applyQuickPeriod(value)
              }}
            >
              <option value="custom">Personalizado</option>
              <option value="today">Hoje</option>
              <option value="tomorrow">Amanhã</option>
              <option value="week">Esta semana</option>
              <option value="next15">Próximos 15 dias</option>
              <option value="month">Até o fim do mês</option>
            </select>
          </div>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              setPeriodPreset('custom')
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

      <section className="dashboard-grid dashboard-grid-single manager-distribution-shell">
        <div className="content-card manager-distribution-card data-access-card">
          <h2>Central de distribuição</h2>
          {loading ? (
            <p className="table-note">Carregando viagens...</p>
          ) : requests.length > 0 && selectedRequest ? (
            <div className="manager-workspace">
              <div className="manager-request-list">
                {paginatedRequests.map((request) => (
                  <button
                    key={request.id}
                    className={`manager-request-list-item ${selectedRequest.id === request.id ? 'active' : ''}`}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <div className="request-list-header">
                      <span className={`status-badge ${request.status}`}>{statusLabels[request.status]}</span>
                      <span className="status-pill">{formatDisplayDate(request.travelDate)}</span>
                    </div>
                    <strong>{getDisplayValue(request.patientName, 'Paciente não informado')}</strong>
                    <span>{request.protocol}</span>
                    <span>{request.destinationCity}/{request.destinationState}</span>
                    <span>
                      Saída {request.departureTime || 'A definir'} • Consulta {request.appointmentTime || 'A definir'}
                    </span>
                    <div className="request-list-flags">
                      {request.patientConfirmedAt ? <span className="confirmed-badge">Confirmada</span> : null}
                      {request.assignedDriverName ? <span className="read-badge">{request.assignedDriverName}</span> : <span className="attention-badge">Sem motorista</span>}
                      {Number(request.patientMessageCount ?? 0) > 0 ? (
                        <span className={request.hasUnreadPatientMessage ? 'attention-badge' : 'read-badge'}>
                          {request.hasUnreadPatientMessage ? 'Mensagem nova' : 'Mensagem lida'}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={requests.length}
                  onPageChange={setCurrentPage}
                />
              )}

              <article className="assignment-card manager-request-card manager-request-focus compact-assignment-card">
                <div className="assignment-header">
                  <div>
                    <strong>{getDisplayValue(selectedRequest.patientName, 'Paciente não informado')}</strong>
                    <p className="table-note">
                      {selectedRequest.protocol} • {selectedRequest.destinationCity}/{selectedRequest.destinationState} • {formatDisplayDate(selectedRequest.travelDate)}
                    </p>
                    <p className="assignment-patient-name">
                      {selectedRequest.accessCpfMasked ?? selectedRequest.cpfMasked} • {getDisplayValue(selectedRequest.treatmentUnit)}
                    </p>
                    <p className="table-note">
                      <Link className="inline-link" to={`/operador/solicitacoes/${selectedRequest.id}`}>
                        Abrir detalhe completo da solicitação
                      </Link>
                    </p>
                  </div>
                  <span className={`status-badge ${selectedRequest.status}`}>{statusLabels[selectedRequest.status]}</span>
                </div>

                <div className="travel-overview-grid">
                  <article className="travel-overview-card">
                    <span>Consulta</span>
                    <strong>{selectedRequest.appointmentTime || 'Não definido'}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Saída</span>
                    <strong>{selectedRequest.departureTime || 'Não definido'}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Motorista</span>
                    <strong>{selectedRequest.assignedDriverName || 'Não atribuído'}</strong>
                  </article>
                  <article className="travel-overview-card">
                    <span>Embarque</span>
                    <strong>{getDisplayValue(selectedRequest.boardingLocationLabel || selectedRequest.addressLine)}</strong>
                  </article>
                </div>

                <div className="assignment-meta">
                  <span>CPF de acesso: {selectedRequest.accessCpfMasked ?? selectedRequest.cpfMasked}</span>
                  {selectedRequest.assignedVehicleName ? <span>Veículo da viagem: {selectedRequest.assignedVehicleName}</span> : null}
                  {selectedRequest.companionRequired ? <span>Acompanhante: {selectedRequest.companionName || 'Sim'}</span> : null}
                  {Number(selectedRequest.patientMessageCount ?? 0) > 0 ? (
                    <span>{selectedRequest.hasUnreadPatientMessage ? 'Nova mensagem do paciente' : 'Mensagem do paciente já lida'}</span>
                  ) : null}
                </div>

                <div className="status-pill-row">
                  {selectedRequest.patientConfirmedAt ? <span className="confirmed-badge">Confirmada pelo paciente</span> : null}
                  {selectedRequest.patientLastViewedAt ? <span className="status-pill-live">Lida pelo paciente</span> : null}
                  {Number(selectedRequest.patientMessageCount ?? 0) > 0 ? (
                    <Link
                      className={`${selectedRequest.hasUnreadPatientMessage ? 'attention-badge' : 'read-badge'} inline-link`}
                      to={`/operador/solicitacoes/${selectedRequest.id}#mensagens-paciente`}
                    >
                      {selectedRequest.hasUnreadPatientMessage ? 'Nova mensagem do paciente' : 'Mensagem do paciente lida'}
                    </Link>
                  ) : null}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={`driver-${selectedRequest.id}`}>Motorista</label>
                    <select
                      id={`driver-${selectedRequest.id}`}
                      value={selectedAssignment.driverId}
                      onChange={(event) => {
                        const nextDriverId = event.target.value
                        const selectedDriver = drivers.find((driver) => String(driver.id) === nextDriverId)
                        updateAssignment(selectedRequest.id, 'driverId', nextDriverId)

                        if (selectedDriver?.vehicleId) {
                          updateAssignment(selectedRequest.id, 'vehicleId', String(selectedDriver.vehicleId))
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
                    <label htmlFor={`vehicle-${selectedRequest.id}`}>Veículo da viagem</label>
                    <select
                      id={`vehicle-${selectedRequest.id}`}
                      value={selectedAssignment.vehicleId}
                      onChange={(event) => updateAssignment(selectedRequest.id, 'vehicleId', event.target.value)}
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
                    <label htmlFor={`appointment-${selectedRequest.id}`}>Horário da consulta</label>
                    <input
                      id={`appointment-${selectedRequest.id}`}
                      type="time"
                      value={selectedAssignment.appointmentTime}
                      onChange={(event) => updateAssignment(selectedRequest.id, 'appointmentTime', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`departure-${selectedRequest.id}`}>Horário de saída</label>
                    <input
                      id={`departure-${selectedRequest.id}`}
                      type="time"
                      value={selectedAssignment.departureTime}
                      onChange={(event) => updateAssignment(selectedRequest.id, 'departureTime', event.target.value)}
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor={`notes-${selectedRequest.id}`}>Observações do gerente</label>
                    <textarea
                      id={`notes-${selectedRequest.id}`}
                      rows={4}
                      value={selectedAssignment.managerNotes}
                      onChange={(event) => updateAssignment(selectedRequest.id, 'managerNotes', event.target.value)}
                      placeholder="Ponto de saída, observações de rota, documentos ou orientações para o motorista."
                    />
                  </div>
                  <div className="field checkbox-field checkbox-field-inline">
                    <label className="checkbox-row" htmlFor={`show-driver-phone-${selectedRequest.id}`}>
                      <input
                        id={`show-driver-phone-${selectedRequest.id}`}
                        type="checkbox"
                        checked={selectedAssignment.showDriverPhoneToPatient}
                        onChange={(event) => updateAssignment(selectedRequest.id, 'showDriverPhoneToPatient', event.target.checked)}
                      />
                      <span>Exibir telefone do motorista para o paciente</span>
                    </label>
                  </div>
                  <div className="field checkbox-field checkbox-field-inline">
                    <label className="checkbox-row" htmlFor={`boarding-flag-${selectedRequest.id}`}>
                      <input
                        id={`boarding-flag-${selectedRequest.id}`}
                        type="checkbox"
                        checked={selectedAssignment.useCustomBoardingLocation}
                        onChange={(event) => updateAssignment(selectedRequest.id, 'useCustomBoardingLocation', event.target.checked)}
                      />
                      <span>Usar ponto oficial de embarque em vez do endereço do paciente</span>
                    </label>
                  </div>
                  {selectedAssignment.useCustomBoardingLocation ? (
                    <div className="field full">
                      <label htmlFor={`boarding-location-${selectedRequest.id}`}>Ponto oficial de embarque</label>
                      <select
                        id={`boarding-location-${selectedRequest.id}`}
                        value={selectedAssignment.boardingLocationName}
                        onChange={(event) => updateAssignment(selectedRequest.id, 'boardingLocationName', event.target.value)}
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
                      <input value={selectedRequest.addressLine || 'Não informado'} readOnly />
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <AsyncActionButton
                    icon={Save}
                    loading={savingId === selectedRequest.id}
                    loadingLabel="Salvando..."
                    onClick={() => void handleAssign(selectedRequest.id)}
                    type="button"
                  >
                    {selectedRequest.assignedDriverId ? 'Salvar distribuição' : 'Atribuir motorista'}
                  </AsyncActionButton>
                </div>
              </article>
            </div>
          ) : (
            <article className="empty-state">
              <h3>Nenhuma solicitação encontrada</h3>
              <p>Ajuste os filtros para visualizar agendas e distribuir motoristas.</p>
            </article>
          )}
        </div>
      </section>
        </main>
      </div>
    </div>
  )
}
