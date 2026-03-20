import {
  BusFront,
  Filter,
  ListChecks,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCcw,
  Route,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loginAdmin, fetchDashboardSummary, fetchRequests } from '../lib/api'
import { canAccessOperator, isValidInternalRole } from '../lib/access'
import { clearAdminSession, getAdminSession, saveAdminSession } from '../lib/admin-session'
import type { AdminSession, DashboardSummary, RequestStatus, TravelRequest } from '../types'

const statusOptions: Array<{ value: RequestStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_analise', label: 'Em analise' },
  { value: 'aguardando_documentos', label: 'Aguardando documentos' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'concluida', label: 'Concluida' },
]

const labelByStatus: Record<RequestStatus, string> = {
  recebida: 'Recebida',
  em_analise: 'Em analise',
  aguardando_documentos: 'Aguardando documentos',
  aprovada: 'Aprovada',
  agendada: 'Agendada',
  cancelada: 'Cancelada',
  concluida: 'Concluida',
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function DashboardPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'todos'>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSession(getAdminSession())
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
          fetchDashboardSummary(),
          fetchRequests(selectedStatus),
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

        setError('Nao foi possivel carregar os dados do painel.')
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
  }, [selectedStatus, session])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const result = await loginAdmin(cpf, password)

      if (!isValidInternalRole(result.session.role) || !canAccessOperator(result.session)) {
        setAuthError('Esse perfil nao pode acessar a area do operador.')
        return
      }

      saveAdminSession(result.session)
      setSession(result.session)
    } catch {
      setAuthError('Nao foi possivel autenticar esse acesso administrativo.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    clearAdminSession()
    setSession(null)
    setSummary(null)
    setRequests([])
  }

  const visibleCountLabel = useMemo(() => {
    if (loading) {
      return 'Carregando solicitacoes...'
    }

    return `${requests.length} solicitacao(oes) encontradas`
  }, [loading, requests.length])

  if (!session) {
    return (
      <div className="dashboard-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Ambiente interno da Prefeitura de Capão do Leão</strong>
            <span>Acesso destinado a operador, regulacao e apoio administrativo</span>
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
                  <label htmlFor="admin-cpf">CPF do administrador</label>
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
                  {authLoading ? 'Entrando...' : 'Entrar como admin'}
                </button>
                <Link className="action-button secondary" to="/acompanhar">
                  Ver fluxo do cidadao
                </Link>
              </div>
            </form>
            {authError ? <p className="table-note">{authError}</p> : null}
          </article>

          <article className="content-card">
            <h2>Escopo liberado para esse acesso</h2>
            <ul className="check-list">
              <li>Visao geral das solicitacoes</li>
              <li>Abertura de nova solicitacao</li>
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
          <p>Esse perfil nao tem permissao para entrar na area do operador.</p>
          <div className="form-actions">
            <Link className="action-button secondary" to="/gerente">
              Ir para gerencia
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
          <strong>Ambiente interno da Prefeitura de Capão do Leão</strong>
          <span>Acesso destinado a operador, regulacao e apoio administrativo</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <ListChecks size={16} />
            Painel do operador
          </div>
          <h1>Solicitacoes de transporte em saude</h1>
          <p>
            Sessão ativa para <strong>{session.name}</strong> com perfil <strong>{session.role}</strong>.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/gerente">
            <Route size={16} />
            Gerencia
          </Link>
          <Link className="action-button secondary" to="/operador/motoristas">
            <BusFront size={16} />
            Motoristas
          </Link>
          <Link className="action-button secondary" to="/operador/cadastro">
            <Plus size={16} />
            Nova solicitacao
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
          <p>solicitacoes registradas</p>
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
          <p>solicitacoes aprovadas</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="content-card">
          <div className="toolbar-row">
            <div className="select-field">
              <label htmlFor="status-filter">Filtrar por status</label>
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as RequestStatus | 'todos')}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="ghost-button" type="button" onClick={() => setSelectedStatus('todos')}>
              <Filter size={16} />
              Limpar filtro
            </button>
          </div>

          <div className="status-line">
            <span className="subtle-label">
              <RefreshCcw size={14} />
              {visibleCountLabel}
            </span>
            {error ? <span className="status-pill">{error}</span> : null}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Paciente</th>
                  <th>Destino</th>
                  <th>Unidade</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link className="inline-link" to={`/operador/solicitacoes/${request.id}`}>
                        {request.protocol}
                      </Link>
                    </td>
                    <td>
                      <strong>{request.patientName}</strong>
                      <div className="table-note">{request.cpfMasked}</div>
                    </td>
                    <td>
                      {request.destinationCity}/{request.destinationState}
                    </td>
                    <td>{request.treatmentUnit}</td>
                    <td>{request.travelDate}</td>
                    <td>
                      <span className={`status-badge ${request.status}`}>
                        {labelByStatus[request.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && requests.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhuma solicitacao encontrada para o filtro atual.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Status recomendados</h2>
            <div className="status-grid">
              <div className="status-card">
                <h3>Recebida</h3>
                <p>Atendimento feito no balcao e protocolo emitido.</p>
              </div>
              <div className="status-card">
                <h3>Em analise</h3>
                <p>Equipe valida elegibilidade, datas e documentos apresentados.</p>
              </div>
              <div className="status-card">
                <h3>Aguardando documentos</h3>
                <p>Faltam laudo, encaminhamento, comprovante ou documento de apoio.</p>
              </div>
              <div className="status-card">
                <h3>Agendada</h3>
                <p>Viagem confirmada com data, rota e orientacoes para o paciente.</p>
              </div>
            </div>
          </article>

          <article className="content-card">
            <h2>Campos do cadastro inicial</h2>
            <ul className="check-list">
              <li>Paciente, CPF, telefone, endereco e sinalizacao de WhatsApp</li>
              <li>Responsavel com CPF de acesso quando necessario</li>
              <li>Acompanhante com telefone e endereco proprios ou herdados do paciente</li>
              <li>Observacoes internas, historico e acesso inicial do cidadao</li>
            </ul>
          </article>

          <article className="content-card login-card">
            <div className="eyebrow">
              <ShieldCheck size={16} />
              Acesso ativo
            </div>
            <h2>Administrador liberado</h2>
            <p>
              Este acesso tem visao total do MVP e pode abrir solicitacoes, distribuir viagens e
              organizar a base de motoristas.
            </p>
            <p className="table-note">
              Fluxo previsto no cadastro: operador informa o CPF, libera o primeiro acesso com
              senha temporária <strong>0000</strong> e o paciente cria depois um PIN de 4 dígitos.
            </p>
          </article>

          <article className="content-card">
            <h2>Fluxo operacional novo</h2>
            <ul className="check-list">
              <li>Operador cadastra e organiza os dados do paciente</li>
              <li>Gerencia analisa a fila e atribui motorista e horario</li>
              <li>Motorista acessa um portal proprio para ver suas viagens</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
