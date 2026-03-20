import { ArrowLeft, LockKeyhole, LogOut, Route, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessAdmin, canAccessManager, isValidInternalRole } from '../lib/access'
import { boardingLocations } from '../lib/boarding-locations'
import { assignDriver, fetchDrivers, fetchRequests, loginAdmin } from '../lib/api'
import { clearAdminSession, getAdminSession, saveAdminSession } from '../lib/admin-session'
import type { AdminSession, DriverRecord, TravelRequest } from '../types'

type AssignmentState = Record<
  number,
  {
    driverId: string
    departureTime: string
    managerNotes: string
    useCustomBoardingLocation: boolean
    boardingLocationName: string
  }
>

const emptyAssignment = {
  driverId: '',
  departureTime: '',
  managerNotes: '',
  useCustomBoardingLocation: false,
  boardingLocationName: '',
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function ManagerPage() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [assignment, setAssignment] = useState<AssignmentState>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setSession(getAdminSession())
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
                useCustomBoardingLocation: request.useCustomBoardingLocation ?? false,
                boardingLocationName: request.boardingLocationName ?? '',
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
  }, [session])

  function updateAssignment(
    requestId: number,
    key:
      | 'driverId'
      | 'departureTime'
      | 'managerNotes'
      | 'boardingLocationName'
      | 'useCustomBoardingLocation',
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

      if (!isValidInternalRole(result.session.role) || !canAccessManager(result.session)) {
        setAuthError('Esse perfil não tem permissão para acessar a gerência.')
        return
      }

      saveAdminSession(result.session)
      setSession(result.session)
    } catch {
      setAuthError('Não foi possível autenticar esse acesso de gerência.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    clearAdminSession()
    setSession(null)
    setRequests([])
    setDrivers([])
  }

  async function handleAssign(requestId: number) {
    const data = assignment[requestId]

    if (!data?.driverId || !data.departureTime) {
      setError('Selecione um motorista e informe o horário de saída.')
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
        departureTime: data.departureTime,
        managerNotes: data.managerNotes,
        useCustomBoardingLocation: data.useCustomBoardingLocation,
        boardingLocationName: data.boardingLocationName,
      })

      setMessage(result.message)
      const refreshed = await fetchRequests()
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
            <p>Somente perfis com role `manager` ou `admin` podem acessar esta área.</p>
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
          <p>Analise os pedidos recebidos e direcione cada viagem para o motorista mais adequado.</p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/gerente/motoristas">
            Motoristas
          </Link>
          {canAccessAdmin(session) ? (
            <Link className="action-button secondary" to="/admin/gerentes">
              Gerentes
            </Link>
          ) : null}
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Ir para operador
          </Link>
          <button className="action-button primary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      <section className="dashboard-grid">
        <div className="content-card">
          <h2>Solicitações para análise e distribuição</h2>
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
                      <span>Motorista designado: {request.assignedDriverName || 'Não atribuído'}</span>
                      <span>Horário de saída: {request.departureTime || 'Não definido'}</span>
                      <span>Embarque: {request.boardingLocationLabel || request.addressLine || 'Não informado'}</span>
                      <span>Acompanhante: {request.companionRequired ? 'Sim' : 'Não'}</span>
                      {request.companionRequired && request.companionName ? (
                        <span>
                          Acompanhante: {request.companionName} {request.companionCpfMasked ? `• ${request.companionCpfMasked}` : ''}
                        </span>
                      ) : null}
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
                      <div className="field full checkbox-field">
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

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Regras de acesso</h2>
            <ul className="check-list">
              <li>Operator entra apenas na área de operador</li>
              <li>Manager entra em operador, gerência e motorista</li>
              <li>Admin também tem acesso total</li>
              <li>Driver fica restrito ao portal do motorista</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
