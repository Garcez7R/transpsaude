import { ArrowLeft, ShieldCheck, UserPlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessAdmin, isValidInternalRole } from '../lib/access'
import {
  createDriver,
  createManager,
  createOperator,
  deleteDriver,
  deleteManager,
  deleteOperator,
  fetchDrivers,
  fetchManagers,
  fetchOperators,
  fetchRequests,
  fetchVehicles,
  loginAdmin,
  resetAccess,
  logoutSession,
  activateAdminPassword,
  updateDriver,
  updateManager,
  updateOperator,
} from '../lib/api'
import { clearAdminSession, saveAdminSession } from '../lib/admin-session'
import { clearManagerSession } from '../lib/manager-session'
import { clearAdminAreaSession, getAdminAreaSession, saveAdminAreaSession } from '../lib/admin-area-session'
import { toEmailCase, toTitleCase } from '../lib/text-format'
import type {
  CreateDriverInput,
  CreateManagerInput,
  CreateOperatorInput,
  DriverRecord,
  ManagerRecord,
  OperatorRecord,
  RequestStatus,
  TravelRequest,
  VehicleRecord,
} from '../types'

const initialForm: CreateManagerInput = {
  name: '',
  cpf: '',
  email: '',
}

const initialDriverForm: CreateDriverInput = {
  name: '',
  cpf: '',
  phone: '',
  isWhatsapp: false,
  vehicleId: null,
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }

  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function AdminManagersPage() {
  const [session, setSession] = useState(() => (typeof window !== 'undefined' ? getAdminAreaSession() : null))
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)
  const [form, setForm] = useState(initialForm)
  const [operatorForm, setOperatorForm] = useState<CreateOperatorInput>({
    name: '',
    cpf: '',
    email: '',
  })
  const [driverForm, setDriverForm] = useState<CreateDriverInput>(initialDriverForm)
  const [managers, setManagers] = useState<ManagerRecord[]>([])
  const [operators, setOperators] = useState<OperatorRecord[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null)
  const [editingOperatorId, setEditingOperatorId] = useState<number | null>(null)
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingOperator, setSavingOperator] = useState(false)
  const [savingDriver, setSavingDriver] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatus, setRequestStatus] = useState<RequestStatus | 'todos'>('todos')
  const [travelDate, setTravelDate] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [destination, setDestination] = useState('')

  function updateField<K extends keyof CreateManagerInput>(key: K, value: CreateManagerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateOperatorField<K extends keyof CreateOperatorInput>(key: K, value: CreateOperatorInput[K]) {
    setOperatorForm((current) => ({ ...current, [key]: value }))
  }

  function updateDriverField<K extends keyof CreateDriverInput>(key: K, value: CreateDriverInput[K]) {
    setDriverForm((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!session || !canAccessAdmin(session)) {
      return
    }

    let active = true

    async function loadData() {
      setLoadingData(true)

      try {
        const [managerData, operatorData, driverData, vehicleData] = await Promise.all([
          fetchManagers(),
          fetchOperators(),
          fetchDrivers(),
          fetchVehicles(),
        ])

        if (!active) {
          return
        }

        setManagers(managerData)
        setOperators(operatorData)
        setDrivers(driverData)
        setVehicles(vehicleData)
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros internos.')
        }
      } finally {
        if (active) {
          setLoadingData(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!session || !canAccessAdmin(session)) {
      return
    }

    let active = true

    async function loadRequests() {
      setLoadingRequests(true)

      try {
        const data = await fetchRequests({
          status: requestStatus,
          search: requestSearch,
          travelDate,
          dateFrom,
          dateTo,
          destination,
        })

        if (active) {
          setRequests(data)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os agendamentos.')
        }
      } finally {
        if (active) {
          setLoadingRequests(false)
        }
      }
    }

    void loadRequests()

    return () => {
      active = false
    }
  }, [dateFrom, dateTo, destination, requestSearch, requestStatus, session, travelDate])

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

      if (!isValidInternalRole(result.session.role) || !canAccessAdmin(result.session)) {
        setAuthError('Somente o administrador pode acessar esta área.')
        return
      }

      saveAdminSession(result.session)
      saveAdminAreaSession(result.session)
      setCpf('')
      setPassword('')
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

      if (!result.session || !isValidInternalRole(result.session.role) || !canAccessAdmin(result.session)) {
        setAuthError('Somente o administrador pode acessar esta área.')
        return
      }

      saveAdminSession(result.session)
      saveAdminAreaSession(result.session)
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const result = editingManagerId ? await updateManager({ id: editingManagerId, ...form }) : await createManager(form)
      setMessage(result.message)
      setForm(initialForm)
      setEditingManagerId(null)
      try {
        setManagers(await fetchManagers())
      } catch (reloadError) {
        setMessage(`${result.message} Cadastro salvo, mas a lista de gerentes não pôde ser recarregada agora.`)
        setError(reloadError instanceof Error ? reloadError.message : 'Não foi possível recarregar os gerentes.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar esse gerente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleOperatorSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingOperator(true)
    setError('')
    setMessage('')

    try {
      const result = editingOperatorId
        ? await updateOperator({
            id: editingOperatorId,
            ...operatorForm,
          })
        : await createOperator(operatorForm)
      setMessage(result.message)
      setOperatorForm({
        name: '',
        cpf: '',
        email: '',
      })
      setEditingOperatorId(null)
      try {
        setOperators(await fetchOperators())
      } catch (reloadError) {
        setMessage(`${result.message} Cadastro salvo, mas a lista de operadores não pôde ser recarregada agora.`)
        setError(reloadError instanceof Error ? reloadError.message : 'Não foi possível recarregar os operadores.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar esse operador.')
    } finally {
      setSavingOperator(false)
    }
  }

  async function handleDriverSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingDriver(true)
    setError('')
    setMessage('')

    try {
      const result = editingDriverId
        ? await updateDriver({
          id: editingDriverId,
          ...driverForm,
        })
        : await createDriver(driverForm)

      setMessage('message' in result ? result.message : `Motorista ${result.name} cadastrado com sucesso.`)
      setDriverForm(initialDriverForm)
      setEditingDriverId(null)
      try {
        setDrivers(await fetchDrivers())
      } catch (reloadError) {
        const baseMessage = 'message' in result ? result.message : `Motorista ${result.name} cadastrado com sucesso.`
        setMessage(`${baseMessage} Cadastro salvo, mas a lista de motoristas não pôde ser recarregada agora.`)
        setError(reloadError instanceof Error ? reloadError.message : 'Não foi possível recarregar os motoristas.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar esse motorista.')
    } finally {
      setSavingDriver(false)
    }
  }

  async function handleDeleteManager(id: number) {
    try {
      const result = await deleteManager(id)
      setManagers(await fetchManagers())
      if (editingManagerId === id) {
        setEditingManagerId(null)
        setForm(initialForm)
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir esse gerente.')
    }
  }

  async function handleDeleteOperator(id: number) {
    try {
      const result = await deleteOperator(id)
      setOperators(await fetchOperators())
      if (editingOperatorId === id) {
        setEditingOperatorId(null)
        setOperatorForm({ name: '', cpf: '', email: '' })
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir esse operador.')
    }
  }

  async function handleDeleteDriver(id: number) {
    try {
      const result = await deleteDriver(id)
      setDrivers(await fetchDrivers())
      if (editingDriverId === id) {
        setEditingDriverId(null)
        setDriverForm(initialDriverForm)
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir esse motorista.')
    }
  }

  async function handleResetAccess(targetType: 'operator' | 'manager' | 'driver', id: number) {
    try {
      const result = await resetAccess(targetType, id)
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível redefinir esse acesso.')
    }
  }

  if (!session || !canAccessAdmin(session)) {
    return (
      <div className="dashboard-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Área administrativa do sistema</strong>
            <span>Acesso exclusivo do administrador</span>
          </div>
        </section>

        <section className="auth-shell">
          <article className="content-card login-card">
            <div className="eyebrow">
              <ShieldCheck size={16} />
              Painel do admin
            </div>
            <h1>Entrar no administrativo</h1>
            <p>Somente o administrador pode criar gerentes e governar os acessos internos.</p>
            <form onSubmit={handleLogin}>
              <div className="login-grid">
                <div className="field">
                  <label htmlFor="admin-area-cpf">CPF do administrador</label>
                  <input
                    id="admin-area-cpf"
                    value={cpf}
                    onChange={(event) => setCpf(formatCpf(event.target.value))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="admin-area-password">Senha</label>
                  <input
                    id="admin-area-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Sua senha"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={authLoading} type="submit">
                  {authLoading ? 'Entrando...' : 'Entrar no admin'}
                </button>
              </div>
            </form>
            {authError ? <p className="table-note">{authError}</p> : null}
          </article>

          {firstAccess ? (
            <article className="content-card login-card">
              <div className="eyebrow">
                <ShieldCheck size={16} />
                Primeiro acesso
              </div>
              <h2>Cadastrar novo PIN</h2>
              <p>
                {firstAccess.name}, este acesso foi criado com o PIN temporário <strong>0000</strong>. Defina agora um novo PIN numérico de 4 dígitos.
              </p>
              <form onSubmit={handleFirstAccess}>
                <div className="login-grid">
                  <div className="field">
                    <label htmlFor="admin-new-password">Novo PIN do administrador</label>
                    <input
                      id="admin-new-password"
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

  return (
    <div className="dashboard-shell">
      <section className="institutional-bar institutional-bar-inner">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Área administrativa do sistema</strong>
          <span>Cadastro de gerentes com permissão de gestão total</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Painel do admin
          </div>
          <h1>Gestão administrativa do sistema</h1>
          <p>
            Sessão ativa para <strong>{session.name}</strong> com perfil <strong>administrador</strong>.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/gerente">
            Gerência
          </Link>
          <Link className="action-button secondary" to="/gerente/equipe">
            Equipe e veículos
          </Link>
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
          <button
            className="action-button primary"
            type="button"
            onClick={async () => {
              if (session?.token) {
                try {
                  await logoutSession(session.token)
                } catch {
                  // A limpeza local continua mesmo se a API não responder.
                }
              }

              clearAdminSession()
              clearAdminAreaSession()
              clearManagerSession()
              setSession(null)
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <section className="content-card">
        <h2>Agendamentos e solicitações</h2>
        <div className="filter-stack">
          <div className="field">
            <label htmlFor="admin-request-search">Buscar</label>
            <input
              id="admin-request-search"
              value={requestSearch}
              onChange={(event) => setRequestSearch(event.target.value)}
              placeholder="Paciente, protocolo, CPF, unidade..."
            />
          </div>
          <div className="field">
            <label htmlFor="admin-request-date">Data da viagem</label>
            <input
              id="admin-request-date"
              type="date"
              value={travelDate}
              onChange={(event) => setTravelDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-request-date-from">Período inicial</label>
            <input
              id="admin-request-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-request-date-to">Período final</label>
            <input
              id="admin-request-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-request-destination">Destino</label>
            <input
              id="admin-request-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Cidade de destino"
            />
          </div>
          <div className="field">
            <label htmlFor="admin-request-status">Status</label>
            <select
              id="admin-request-status"
              value={requestStatus}
              onChange={(event) => setRequestStatus(event.target.value as RequestStatus | 'todos')}
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
              setRequestSearch('')
              setRequestStatus('todos')
              setTravelDate('')
              setDateFrom('')
              setDateTo('')
              setDestination('')
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Paciente</th>
                <th>Destino</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.protocol}</td>
                  <td>{request.patientName}</td>
                  <td>{request.destinationCity}/{request.destinationState}</td>
                  <td>{request.travelDate}</td>
                  <td>{request.status}</td>
                </tr>
              ))}
              {!loadingRequests && requests.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhuma solicitação encontrada para esse recorte.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>{editingManagerId ? 'Editar gerente' : 'Novo gerente'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="manager-name">Nome do gerente</label>
                <input
                  id="manager-name"
                  value={form.name}
                  onChange={(event) => updateField('name', toTitleCase(event.target.value))}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="manager-cpf-register">CPF</label>
                <input
                  id="manager-cpf-register"
                  value={form.cpf}
                  onChange={(event) => updateField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="manager-email">E-mail institucional</label>
                <input
                  id="manager-email"
                  value={form.email}
                  onChange={(event) => updateField('email', toEmailCase(event.target.value))}
                  placeholder="gerencia@prefeitura.rs.gov.br"
                  required
                />
              </div>
              <div className="field">
                <label>Primeiro acesso</label>
                <input value={editingManagerId ? 'Use o botão de reset para voltar ao PIN 0000' : 'PIN temporário 0000 com troca obrigatória no primeiro acesso'} readOnly />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={saving} type="submit">
                <UserPlus2 size={16} />
                {saving ? 'Salvando...' : editingManagerId ? 'Salvar gerente' : 'Cadastrar gerente'}
              </button>
              {editingManagerId ? (
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setEditingManagerId(null)
                    setForm(initialForm)
                  }}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
          {message ? <p className="table-note">{message}</p> : null}
        </article>

        <article className="content-card">
          <h2>{editingOperatorId ? 'Editar operador' : 'Novo operador'}</h2>
          <form onSubmit={handleOperatorSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="operator-name">Nome do operador</label>
                <input
                  id="operator-name"
                  value={operatorForm.name}
                  onChange={(event) => updateOperatorField('name', toTitleCase(event.target.value))}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="operator-cpf-register">CPF</label>
                <input
                  id="operator-cpf-register"
                  value={operatorForm.cpf}
                  onChange={(event) => updateOperatorField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="operator-email">E-mail institucional</label>
                <input
                  id="operator-email"
                  value={operatorForm.email}
                  onChange={(event) => updateOperatorField('email', toEmailCase(event.target.value))}
                  placeholder="operador@prefeitura.rs.gov.br"
                  required
                />
              </div>
              <div className="field">
                <label>Primeiro acesso</label>
                <input value={editingOperatorId ? 'Use o botão de reset para voltar ao PIN 0000' : 'PIN temporário 0000 com troca obrigatória no primeiro acesso'} readOnly />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={savingOperator} type="submit">
                <UserPlus2 size={16} />
                {savingOperator ? 'Salvando...' : editingOperatorId ? 'Salvar operador' : 'Cadastrar operador'}
              </button>
              {editingOperatorId ? (
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setEditingOperatorId(null)
                    setOperatorForm({
                      name: '',
                      cpf: '',
                      email: '',
                    })
                  }}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </article>

      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>{editingDriverId ? 'Editar motorista' : 'Novo motorista'}</h2>
          <form onSubmit={handleDriverSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="admin-driver-name">Nome do motorista</label>
                <input
                  id="admin-driver-name"
                  value={driverForm.name}
                  onChange={(event) => updateDriverField('name', toTitleCase(event.target.value))}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="admin-driver-cpf">CPF</label>
                <input
                  id="admin-driver-cpf"
                  value={driverForm.cpf}
                  onChange={(event) => updateDriverField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="admin-driver-phone">Telefone</label>
                <input
                  id="admin-driver-phone"
                  value={driverForm.phone}
                  onChange={(event) => updateDriverField('phone', formatPhone(event.target.value))}
                  inputMode="tel"
                  placeholder="(53) 99999-9999"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="admin-driver-vehicle">Veículo preferencial</label>
                <select
                  id="admin-driver-vehicle"
                  value={driverForm.vehicleId ?? ''}
                  onChange={(event) => updateDriverField('vehicleId', event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">Sem vínculo fixo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} • {vehicle.plate}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Primeiro acesso</label>
                <input value={editingDriverId ? 'Use o botão de reset para voltar ao PIN 0000' : 'PIN temporário 0000 com troca obrigatória no primeiro acesso'} readOnly />
              </div>
              <div className="field full checkbox-field">
                <label className="checkbox-row" htmlFor="admin-driver-whatsapp">
                  <input
                    id="admin-driver-whatsapp"
                    type="checkbox"
                    checked={driverForm.isWhatsapp}
                    onChange={(event) => updateDriverField('isWhatsapp', event.target.checked)}
                  />
                  <span>Esse telefone do motorista é WhatsApp</span>
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={savingDriver} type="submit">
                <UserPlus2 size={16} />
                {savingDriver ? 'Salvando...' : editingDriverId ? 'Salvar motorista' : 'Cadastrar motorista'}
              </button>
              {editingDriverId ? (
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setEditingDriverId(null)
                    setDriverForm(initialDriverForm)
                  }}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="content-card">
          <h2>Permissões por perfil</h2>
          <ul className="check-list">
            <li>Administrador cria gerente e operador</li>
            <li>Gerente e administrador criam, editam e desativam motoristas e operadores</li>
            <li>Somente administrador cria novos gerentes</li>
            <li>Redefinição de senha acontece pela edição do cadastro</li>
            <li>O painel do admin concentra a governança dos acessos internos</li>
          </ul>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Gerentes cadastrados</h2>
          {loadingData ? (
            <p className="table-note">Carregando gerentes...</p>
          ) : (
            <div className="assignment-list scroll-list">
              {managers.map((manager) => (
                <article className="assignment-card" key={manager.id}>
                  <strong>{manager.name}</strong>
                  <p className="table-note">{manager.cpfMasked}</p>
                  <p className="table-note">{manager.email}</p>
                  <div className="form-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setEditingManagerId(manager.id)
                        setForm({
                          name: manager.name,
                          cpf: manager.cpfMasked,
                          email: manager.email,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button secondary" type="button" onClick={() => void handleResetAccess('manager', manager.id)}>
                      Resetar senha
                    </button>
                    <button className="action-button primary" type="button" onClick={() => void handleDeleteManager(manager.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="content-card">
          <h2>Operadores cadastrados</h2>
          {loadingData ? (
            <p className="table-note">Carregando operadores...</p>
          ) : (
            <div className="assignment-list scroll-list">
              {operators.map((operator) => (
                <article className="assignment-card" key={operator.id}>
                  <strong>{operator.name}</strong>
                  <p className="table-note">{operator.cpfMasked}</p>
                  <p className="table-note">{operator.email}</p>
                  <div className="form-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setEditingOperatorId(operator.id)
                        setOperatorForm({
                          name: operator.name,
                          cpf: operator.cpfMasked,
                          email: operator.email,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button secondary" type="button" onClick={() => void handleResetAccess('operator', operator.id)}>
                      Resetar senha
                    </button>
                    <button className="action-button primary" type="button" onClick={() => void handleDeleteOperator(operator.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Motoristas cadastrados</h2>
          {loadingData ? (
            <p className="table-note">Carregando motoristas...</p>
          ) : (
            <div className="assignment-list scroll-list">
              {drivers.map((driver) => (
                <article className="assignment-card" key={driver.id}>
                  <strong>{driver.name}</strong>
                  <p className="table-note">
                    {driver.cpfMasked} • {driver.phone}
                  </p>
                  <p className="table-note">Veículo preferencial: {driver.vehicleName || 'Sem vínculo fixo'}</p>
                  <div className="form-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setEditingDriverId(driver.id)
                        setDriverForm({
                          name: driver.name,
                          cpf: driver.cpfMasked,
                          phone: driver.phone,
                          isWhatsapp: driver.isWhatsapp,
                          vehicleId: driver.vehicleId ?? null,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button secondary" type="button" onClick={() => void handleResetAccess('driver', driver.id)}>
                      Resetar PIN
                    </button>
                    <button className="action-button primary" type="button" onClick={() => void handleDeleteDriver(driver.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  )
}
