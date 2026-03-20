import { ArrowLeft, Route, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignDriver, fetchDrivers, fetchRequests } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type { DriverRecord, TravelRequest } from '../types'

type AssignmentState = Record<number, { driverId: string; departureTime: string; managerNotes: string }>

const emptyAssignment = {
  driverId: '',
  departureTime: '',
  managerNotes: '',
}

export function ManagerPage() {
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [assignment, setAssignment] = useState<AssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      return
    }

    let active = true

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [requestData, driverData] = await Promise.all([fetchRequests(), fetchDrivers()])

        if (!active) {
          return
        }

        setRequests(requestData)
        setDrivers(driverData)
        setAssignment(
          Object.fromEntries(
            requestData.map((request) => [
              request.id,
              {
                driverId: request.assignedDriverId ? String(request.assignedDriverId) : '',
                departureTime: request.departureTime ?? '',
                managerNotes: request.managerNotes ?? '',
              },
            ]),
          ),
        )
      } catch {
        if (active) {
          setError('Nao foi possivel carregar a tela de gerencia.')
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
  }, [session])

  function updateAssignment(
    requestId: number,
    key: 'driverId' | 'departureTime' | 'managerNotes',
    value: string,
  ) {
    setAssignment((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] ?? emptyAssignment),
        [key]: value,
      },
    }))
  }

  async function handleAssign(requestId: number) {
    const data = assignment[requestId]

    if (!data?.driverId || !data.departureTime) {
      setError('Selecione um motorista e informe o horario de saida.')
      return
    }

    setSavingId(requestId)
    setError('')
    setMessage('')

    try {
      const result = await assignDriver({
        requestId,
        driverId: Number(data.driverId),
        departureTime: data.departureTime,
        managerNotes: data.managerNotes,
      })

      setMessage(result.message)
      const refreshed = await fetchRequests()
      setRequests(refreshed)
    } catch {
      setError('Nao foi possivel atribuir o motorista para essa viagem.')
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
            <strong>Gerencia de transporte em saude</strong>
            <span>Entre primeiro no painel do operador</span>
          </div>
        </section>

        <article className="content-card">
          <h2>Sessao administrativa necessaria</h2>
          <p>A gerencia de rotas e motoristas fica disponivel somente para acesso interno autenticado.</p>
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
          <strong>Gerencia de transporte em saude</strong>
          <span>Analise, organizacao de viagens e atribuicao de motoristas</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <Route size={16} />
            Painel do gerente
          </div>
          <h1>Distribuir viagens para os motoristas</h1>
          <p>Analise os pedidos recebidos e direcione cada viagem para o motorista mais adequado.</p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/operador/motoristas">
            Motoristas
          </Link>
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      <section className="dashboard-grid">
        <div className="content-card">
          <h2>Solicitacoes para analise e distribuicao</h2>
          {loading ? (
            <p className="table-note">Carregando viagens...</p>
          ) : (
            <div className="assignment-list">
              {requests.map((request) => {
                const data = assignment[request.id] ?? emptyAssignment

                return (
                  <article className="assignment-card" key={request.id}>
                    <div className="assignment-header">
                      <div>
                        <strong>{request.patientName}</strong>
                        <p className="table-note">
                          {request.protocol} • {request.destinationCity}/{request.destinationState} • {request.travelDate}
                        </p>
                      </div>
                      <span className={`status-badge ${request.status}`}>{request.status}</span>
                    </div>

                    <div className="assignment-meta">
                      <span>CPF de acesso: {request.accessCpfMasked ?? request.cpfMasked}</span>
                      <span>Unidade: {request.treatmentUnit}</span>
                      <span>Acompanhante: {request.companionRequired ? 'Sim' : 'Nao'}</span>
                      {request.companionRequired && request.companionName ? (
                        <span>
                          Acompanhante: {request.companionName} {request.companionCpfMasked ? `• ${request.companionCpfMasked}` : ''}
                        </span>
                      ) : null}
                      {request.assignedDriverName ? (
                        <span>Motorista atual: {request.assignedDriverName}</span>
                      ) : (
                        <span>Sem motorista atribuido</span>
                      )}
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor={`driver-${request.id}`}>Motorista</label>
                        <select
                          id={`driver-${request.id}`}
                          value={data.driverId}
                          onChange={(event) => updateAssignment(request.id, 'driverId', event.target.value)}
                        >
                          <option value="">Selecione</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name} • {driver.vehicleName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`departure-${request.id}`}>Horario de saida</label>
                        <input
                          id={`departure-${request.id}`}
                          type="time"
                          value={data.departureTime}
                          onChange={(event) => updateAssignment(request.id, 'departureTime', event.target.value)}
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor={`notes-${request.id}`}>Observacoes do gerente</label>
                        <textarea
                          id={`notes-${request.id}`}
                          rows={3}
                          value={data.managerNotes}
                          onChange={(event) => updateAssignment(request.id, 'managerNotes', event.target.value)}
                          placeholder="Ponto de saida, observacoes de rota, documentos ou orientacoes para o motorista."
                        />
                      </div>
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

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Como esse fluxo passa a funcionar</h2>
            <ul className="check-list">
              <li>O operador cadastra a solicitacao normalmente</li>
              <li>A gerencia analisa a fila e define motorista e horario</li>
              <li>A viagem recebe status de agendada automaticamente ao ser atribuida</li>
              <li>O motorista acessa somente as viagens vinculadas ao proprio CPF</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
