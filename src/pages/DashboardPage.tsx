import { Filter, ListChecks, LockKeyhole, LogOut, Plus, RefreshCcw, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { activateAdminPassword, loginAdmin, fetchDashboardSummary, fetchRequests, logoutSession } from '../lib/api'
import { canAccessOperator, getInternalRoleLabel, isValidInternalRole } from '../lib/access'
import { clearOperatorSession, getOperatorSession, saveOperatorSession } from '../lib/operator-session'
import { toInstitutionalText } from '../lib/text-format'
import type { AdminSession, DashboardSummary, RequestStatus, TravelRequest } from '../types'

const statusOptions: Array<{ value: RequestStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'aguardando_documentos', label: 'Aguardando documentos' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'concluida', label: 'Concluída' },
]

const labelByStatus: Record<RequestStatus, string> = {
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

function normalizeSearchInput(value: string) {
  const trimmed = value.trimStart()
  const digits = trimmed.replace(/\D/g, '')

  if (trimmed.toUpperCase().startsWith('TS')) {
    return trimmed.toUpperCase()
  }

  if (digits.length > 0 && digits.length <= 11 && /^[\d.\- ]+$/.test(trimmed)) {
    return formatCpf(trimmed)
  }

  return toInstitutionalText(trimmed)
}

function formatDisplayDate(value?: string) {
  if (!value) {
    return 'A definir'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

const initialFilters = {
  status: 'todos' as RequestStatus | 'todos',
  search: '',
  travelDate: '',
  dateFrom: '',
  dateTo: '',
  destination: '',
}

export function DashboardPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSession(getOperatorSession())
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    let active = true

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [dashboardData, requestsData] = await Promise.all([
          fetchDashboardSummary('operator'),
          fetchRequests({
            status: filters.status,
            search: filters.search,
            travelDate: filters.travelDate,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            destination: filters.destination,
          }, 'operator'),
        ])

        if (!active) {
          return
        }

        setSummary(dashboardData)
        setRequests(requestsData)
      } catch {
        if (!active) {
          return
        }

        setError('Não foi possível carregar os dados do painel.')
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
  }, [filters, session])

  function updateDraftFilter<K extends keyof typeof initialFilters>(key: K, value: (typeof initialFilters)[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters() {
    setFilters(draftFilters)
  }

  function applyQuickPeriod(mode: 'today' | 'tomorrow' | 'week') {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    if (mode === 'today') {
      const nextFilters = {
        ...draftFilters,
        travelDate: '',
        dateFrom: today,
        dateTo: today,
      }
      setDraftFilters(nextFilters)
      setFilters(nextFilters)
      return
    }

    if (mode === 'tomorrow') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const value = tomorrow.toISOString().slice(0, 10)
      const nextFilters = {
        ...draftFilters,
        travelDate: '',
        dateFrom: value,
        dateTo: value,
      }
      setDraftFilters(nextFilters)
      setFilters(nextFilters)
      return
    }

    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const nextFilters = {
      ...draftFilters,
      travelDate: '',
      dateFrom: today,
      dateTo: weekEnd.toISOString().slice(0, 10),
    }
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    applyFilters()
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

      if (!isValidInternalRole(result.session.role) || !canAccessOperator(result.session)) {
        setAuthError('Esse perfil não pode acessar a área do operador.')
        return
      }

      saveOperatorSession(result.session)
      setSession(result.session)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível autenticar esse acesso administrativo.')
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

      if (!result.session || !isValidInternalRole(result.session.role) || !canAccessOperator(result.session)) {
        setAuthError('Esse perfil não pode acessar a área do operador.')
        return
      }

      saveOperatorSession(result.session)
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

    clearOperatorSession()
    setSession(null)
    setSummary(null)
    setRequests([])
  }

  const visibleCountLabel = useMemo(() => {
    if (loading) {
      return 'Carregando solicitações...'
    }

    return `${requests.length} solicitação(ões) encontradas`
  }, [loading, requests.length])

  if (!session) {
    return (
      <div className="dashboard-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Ambiente interno da Prefeitura Municipal de Capão do Leão</strong>
            <span>Acesso destinado a operador, regulação e apoio administrativo</span>
          </div>
        </section>

        <section className="auth-shell">
          <article className="content-card login-card">
            <div className="eyebrow">
              <LockKeyhole size={16} />
              Acesso administrativo
            </div>
            <h1>Entrar no painel</h1>
            <p>Ambiente restrito para operadores e administradores autorizados.</p>
            <form onSubmit={handleLogin}>
              <div className="login-grid">
                <div className="field">
                  <label htmlFor="admin-cpf">CPF do operador</label>
                  <input
                    id="admin-cpf"
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="admin-password">Senha</label>
                  <input
                    id="admin-password"
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
                  {authLoading ? 'Entrando...' : 'Entrar no ambiente interno'}
                </button>
                <Link className="action-button secondary" to="/acompanhar">
                  Ver fluxo do cidadão
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
                    <label htmlFor="operator-new-password">Novo PIN do operador</label>
                    <input
                      id="operator-new-password"
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

          <article className="content-card">
            <h2>Escopo liberado para esse acesso</h2>
            <ul className="check-list">
              <li>Visão geral das solicitações</li>
              <li>Abertura de nova solicitação</li>
              <li>Base para evoluir autenticação real e perfis</li>
            </ul>
          </article>
        </section>
      </div>
    )
  }

  if (!canAccessOperator(session)) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Acesso negado</h2>
          <p>Esse perfil não tem permissão para entrar na área do operador.</p>
          <div className="form-actions">
            <Link className="action-button secondary" to="/gerente">
              Ir para gerência
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
          <strong>Ambiente interno da Prefeitura Municipal de Capão do Leão</strong>
          <span>Acesso destinado a operador, regulação e apoio administrativo</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <ListChecks size={16} />
            Painel do operador
          </div>
          <h1>Solicitações de transporte em saúde</h1>
          <p>
            Sessão ativa para <strong>{session.name}</strong> com perfil <strong>{getInternalRoleLabel(session.role)}</strong>.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/operador/cadastro">
            <Plus size={16} />
            Nova solicitação
          </Link>
          <button className="action-button primary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <strong>{summary?.totalRequests ?? '--'}</strong>
          <p>solicitações registradas</p>
        </article>
        <article className="metric-card">
          <strong>{summary?.scheduledToday ?? '--'}</strong>
          <p>viagens agendadas para hoje</p>
        </article>
        <article className="metric-card">
          <strong>{summary?.pendingDocuments ?? '--'}</strong>
          <p>casos aguardando documentos</p>
        </article>
        <article className="metric-card">
          <strong>{summary?.approvedRequests ?? '--'}</strong>
          <p>solicitações aprovadas</p>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-main">
        <div className="content-card">
          <div className="filter-stack">
            <form className="filter-stack" onSubmit={handleFilterSubmit}>
              <div className="field full operator-search-row">
                <label htmlFor="request-search">Buscar</label>
                <div className="operator-search-inline">
                  <input
                    id="request-search"
                    value={draftFilters.search}
                    onChange={(event) => updateDraftFilter('search', normalizeSearchInput(event.target.value))}
                    placeholder="CPF, nome, protocolo ou unidade..."
                  />
                  <button className="action-button primary" type="submit">
                    <Search size={16} />
                    Buscar
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="request-date-filter">Data da viagem</label>
                <input
                  id="request-date-filter"
                  type="date"
                  value={draftFilters.travelDate}
                  onChange={(event) => updateDraftFilter('travelDate', event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="request-date-from">Período inicial</label>
                <input
                  id="request-date-from"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => updateDraftFilter('dateFrom', event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="request-date-to">Período final</label>
                <input
                  id="request-date-to"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => updateDraftFilter('dateTo', event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="destination-filter">Destino</label>
                <input
                  id="destination-filter"
                  value={draftFilters.destination}
                  onChange={(event) => updateDraftFilter('destination', toInstitutionalText(event.target.value))}
                  placeholder="Cidade"
                />
              </div>
              <div className="field">
                <label htmlFor="status-filter">Filtrar por status</label>
                <select
                  id="status-filter"
                  value={draftFilters.status}
                  onChange={(event) => updateDraftFilter('status', event.target.value as RequestStatus | 'todos')}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions operator-filter-actions">
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setDraftFilters(initialFilters)
                    setFilters(initialFilters)
                  }}
                >
                  <Filter size={16} />
                  Limpar filtros
                </button>
                <button className="ghost-button" type="button" onClick={() => applyQuickPeriod('today')}>
                  Hoje
                </button>
                <button className="ghost-button" type="button" onClick={() => applyQuickPeriod('tomorrow')}>
                  Amanhã
                </button>
                <button className="ghost-button" type="button" onClick={() => applyQuickPeriod('week')}>
                  Esta semana
                </button>
              </div>
            </form>
          </div>

          <div className="status-line">
            <span className="subtle-label">
              {filters.search || filters.travelDate || filters.dateFrom || filters.dateTo || filters.destination ? <Search size={14} /> : <RefreshCcw size={14} />}
              {visibleCountLabel}
            </span>
            {error ? <span className="status-pill">{error}</span> : null}
          </div>

          {loading ? (
            <p className="table-note">Carregando solicitações...</p>
          ) : requests.length > 0 ? (
            <div className="assignment-list scroll-list">
              {requests.map((request) => (
                <article className="assignment-card operator-request-card" key={request.id}>
                  <div className="assignment-header">
                    <div>
                      <Link className="inline-link" to={`/operador/solicitacoes/${request.id}`}>
                        {request.protocol}
                      </Link>
                      <p className="table-note">
                        {formatDisplayDate(request.travelDate)} • {request.destinationCity}/{request.destinationState}
                      </p>
                    </div>
                    <span className={`status-badge ${request.status}`}>
                      {labelByStatus[request.status]}
                    </span>
                  </div>

                  <div className="travel-overview-grid">
                    <article className="travel-overview-card">
                      <span>Paciente</span>
                      <strong>{request.patientName}</strong>
                    </article>
                    <article className="travel-overview-card">
                      <span>Consulta</span>
                      <strong>{request.appointmentTime || 'A definir'}</strong>
                    </article>
                    <article className="travel-overview-card">
                      <span>Saída</span>
                      <strong>{request.departureTime || 'A definir'}</strong>
                    </article>
                    <article className="travel-overview-card">
                      <span>Embarque</span>
                      <strong>{request.boardingLocationLabel || request.addressLine || 'Não informado'}</strong>
                    </article>
                  </div>

                  <div className="assignment-meta">
                    <span>CPF: {request.cpfMasked}</span>
                    <span>Unidade: {request.treatmentUnit}</span>
                    <span>Destino: {request.destinationCity}/{request.destinationState}</span>
                    {request.patientConfirmedAt ? <span>Agenda confirmada pelo paciente</span> : null}
                    {request.patientLastViewedAt ? <span>Consulta pública já visualizada</span> : null}
                    {Number(request.patientMessageCount ?? 0) > 0 ? <span>Paciente enviou mensagem</span> : null}
                  </div>

                  <div className="status-pill-row">
                    {request.patientConfirmedAt ? <span className="confirmed-badge">Confirmada</span> : null}
                    {request.patientLastViewedAt ? <span className="status-pill-live">Lida</span> : null}
                    {Number(request.patientMessageCount ?? 0) > 0 ? (
                      <Link className="update-badge inline-link" to={`/operador/solicitacoes/${request.id}#mensagens-paciente`}>
                        Ver mensagem do paciente
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="table-note">Nenhuma solicitação encontrada para o filtro atual.</p>
          )}
        </div>

        <aside className="dashboard-side">
          <article className="content-card dashboard-side-sticky">
            <h2>Ações rápidas</h2>
            <ul className="check-list">
              <li>Busque por CPF para reaproveitar cadastros e evitar redigitação.</li>
              <li>Abra o protocolo para responder mensagens e conferir leitura ou confirmação da agenda.</li>
              <li>Preencha o horário da consulta junto da saída para facilitar a ordem do transporte.</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
