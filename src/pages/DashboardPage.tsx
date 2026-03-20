import { Filter, ListChecks, LockKeyhole, Plus, RefreshCcw, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDashboardSummary, fetchRequests } from '../lib/api'
import type { DashboardSummary, RequestStatus, TravelRequest } from '../types'

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

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'todos'>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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
  }, [selectedStatus])

  const visibleCountLabel = useMemo(() => {
    if (loading) {
      return 'Carregando solicitacoes...'
    }

    return `${requests.length} solicitacao(oes) encontradas`
  }, [loading, requests.length])

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
            Base inicial para o atendimento presencial da Prefeitura de Capão do Leão, com
            acompanhamento de status e consulta do cidadão.
          </p>
        </div>

        <div className="page-actions">
          <button className="action-button secondary" type="button">
            <Plus size={16} />
            Nova solicitacao
          </button>
          <Link className="action-button primary" to="/acompanhar">
            Ver fluxo publico
          </Link>
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
                    <td>{request.protocol}</td>
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
              <li>Paciente, CPF, CNS e contato</li>
              <li>Destino, unidade, especialidade e data</li>
              <li>Acompanhante e justificativa clinica</li>
              <li>Observacoes internas e historico</li>
            </ul>
          </article>

          <article className="content-card login-card">
            <div className="eyebrow">
              <LockKeyhole size={16} />
              Acesso do operador
            </div>
            <h2>Entrada institucional</h2>
            <p>
              Nesta fase, a tela representa o ponto de login do operador. No proximo passo podemos
              ligar com autenticacao real.
            </p>
            <div className="login-grid">
              <div className="field">
                <label htmlFor="operator-login">Matricula ou e-mail</label>
                <input id="operator-login" placeholder="operador@prefeitura.local" />
              </div>
              <div className="field">
                <label htmlFor="operator-password">Senha</label>
                <input id="operator-password" placeholder="••••••••" type="password" />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" type="button">
                <ShieldCheck size={16} />
                Entrar no painel
              </button>
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
