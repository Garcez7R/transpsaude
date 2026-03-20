import { ArrowLeft, BusFront, CarFront, ShieldCheck, UserPlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessAdmin, canAccessManager, getInternalRoleLabel } from '../lib/access'
import { createDriver, createOperator, createVehicle, fetchDriverTrips, fetchDrivers, fetchVehicles } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type {
  CreateDriverInput,
  CreateOperatorInput,
  CreateVehicleInput,
  DriverRecord,
  TravelRequest,
  VehicleRecord,
} from '../types'

const initialDriverForm: CreateDriverInput = {
  name: '',
  cpf: '',
  phone: '',
  isWhatsapp: false,
  vehicleId: null,
  password: '',
}

const initialVehicleForm: CreateVehicleInput = {
  name: '',
  plate: '',
  category: '',
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

export function DriversPage() {
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [driverTrips, setDriverTrips] = useState<TravelRequest[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [driverForm, setDriverForm] = useState(initialDriverForm)
  const [operatorForm, setOperatorForm] = useState<CreateOperatorInput>({
    name: '',
    cpf: '',
    email: '',
    password: '',
  })
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm)
  const [loading, setLoading] = useState(true)
  const [savingDriver, setSavingDriver] = useState(false)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingOperator, setSavingOperator] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!session || !canAccessManager(session)) {
      return
    }

    let active = true

    async function loadData() {
      setLoading(true)

      try {
        const [driverData, vehicleData] = await Promise.all([fetchDrivers(), fetchVehicles()])

        if (!active) {
          return
        }

        setDrivers(driverData)
        setVehicles(vehicleData)

        if (!selectedDriverId && driverData[0]) {
          setSelectedDriverId(String(driverData[0].id))
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar motoristas e veículos.')
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
  }, [session, selectedDriverId])

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverTrips([])
      return
    }

    let active = true

    async function loadTrips() {
      try {
        const data = await fetchDriverTrips(Number(selectedDriverId))

        if (active) {
          setDriverTrips(data)
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar as viagens desse motorista.')
        }
      }
    }

    void loadTrips()

    return () => {
      active = false
    }
  }, [selectedDriverId])

  function updateDriverField<K extends keyof CreateDriverInput>(key: K, value: CreateDriverInput[K]) {
    setDriverForm((current) => ({ ...current, [key]: value }))
  }

  function updateVehicleField<K extends keyof CreateVehicleInput>(key: K, value: CreateVehicleInput[K]) {
    setVehicleForm((current) => ({ ...current, [key]: value }))
  }

  function updateOperatorField<K extends keyof CreateOperatorInput>(key: K, value: CreateOperatorInput[K]) {
    setOperatorForm((current) => ({ ...current, [key]: value }))
  }

  async function handleDriverSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingDriver(true)
    setError('')
    setMessage('')

    try {
      const created = await createDriver(driverForm)
      setDrivers((current) => [created, ...current])
      setDriverForm(initialDriverForm)
      setMessage(`Motorista ${created.name} cadastrado com sucesso.`)
    } catch {
      setError('Não foi possível salvar o motorista.')
    } finally {
      setSavingDriver(false)
    }
  }

  async function handleVehicleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingVehicle(true)
    setError('')
    setMessage('')

    try {
      const created = await createVehicle(vehicleForm)
      setVehicles((current) => [created, ...current])
      setVehicleForm(initialVehicleForm)
      setMessage(`Veículo ${created.name} cadastrado com sucesso.`)
    } catch {
      setError('Não foi possível salvar o veículo.')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function handleOperatorSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingOperator(true)
    setError('')
    setMessage('')

    try {
      const result = await createOperator(operatorForm)
      setOperatorForm({
        name: '',
        cpf: '',
        email: '',
        password: '',
      })
      setMessage(result.message)
    } catch {
      setError('Não foi possível salvar o operador.')
    } finally {
      setSavingOperator(false)
    }
  }

  if (!session) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Sessão administrativa necessária</h2>
          <p>Cadastros de motoristas e veículos ficam disponíveis somente para a equipe interna.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/gerente">
              Ir para login da gerência
            </Link>
          </div>
        </article>
      </div>
    )
  }

  if (!canAccessManager(session)) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Acesso negado</h2>
          <p>Somente gerente e administrador podem cadastrar ou gerenciar motoristas e veículos.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/gerente">
              Ir para gerência
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
          <strong>Gerência de motoristas e veículos</strong>
          <span>Cadastros administrativos e visão operacional das viagens por motorista</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <BusFront size={16} />
            Equipe e veículos
          </div>
          <h1>Gestão da equipe de transporte</h1>
          <p>
            Sessão ativa para <strong>{session.name}</strong> com perfil <strong>{getInternalRoleLabel(session.role)}</strong>.
          </p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/motorista">
            Painel do motorista
          </Link>
          {canAccessAdmin(session) ? (
            <Link className="action-button secondary" to="/admin">
              Admin
            </Link>
          ) : null}
          <Link className="action-button secondary" to="/gerente">
            <ArrowLeft size={16} />
            Voltar para gerência
          </Link>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Novo veículo</h2>
          <form onSubmit={handleVehicleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="vehicle-name">Nome do veículo</label>
                <input
                  id="vehicle-name"
                  value={vehicleForm.name}
                  onChange={(event) => updateVehicleField('name', event.target.value)}
                  placeholder="Van 01, Micro-ônibus..."
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="vehicle-plate">Placa</label>
                <input
                  id="vehicle-plate"
                  value={vehicleForm.plate}
                  onChange={(event) => updateVehicleField('plate', event.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="vehicle-category">Categoria</label>
                <input
                  id="vehicle-category"
                  value={vehicleForm.category}
                  onChange={(event) => updateVehicleField('category', event.target.value)}
                  placeholder="Van, Ambulância, Micro-ônibus..."
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={savingVehicle} type="submit">
                <CarFront size={16} />
                {savingVehicle ? 'Salvando...' : 'Cadastrar veículo'}
              </button>
            </div>
          </form>
        </article>

        <article className="content-card">
          <h2>Novo motorista</h2>
          <form onSubmit={handleDriverSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="driver-name">Nome do motorista</label>
                <input
                  id="driver-name"
                  value={driverForm.name}
                  onChange={(event) => updateDriverField('name', event.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-cpf">CPF</label>
                <input
                  id="driver-cpf"
                  value={driverForm.cpf}
                  onChange={(event) => updateDriverField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-phone">Telefone</label>
                <input
                  id="driver-phone"
                  value={driverForm.phone}
                  onChange={(event) => updateDriverField('phone', formatPhone(event.target.value))}
                  inputMode="tel"
                  placeholder="(53) 99999-9999"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-vehicle">Veículo vinculado</label>
                <select
                  id="driver-vehicle"
                  value={driverForm.vehicleId ?? ''}
                  onChange={(event) => updateDriverField('vehicleId', event.target.value ? Number(event.target.value) : null)}
                  required
                >
                  <option value="">Selecione um veículo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} • {vehicle.plate}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="driver-password">Senha inicial do motorista</label>
                <input
                  id="driver-password"
                  value={driverForm.password}
                  onChange={(event) => updateDriverField('password', event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="0000"
                  required
                />
              </div>
              <div className="field full checkbox-field">
                <label className="checkbox-row" htmlFor="driver-whatsapp">
                  <input
                    id="driver-whatsapp"
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
                {savingDriver ? 'Salvando...' : 'Cadastrar motorista'}
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="dashboard-grid">
        {canAccessManager(session) ? (
          <article className="content-card">
            <h2>Novo operador</h2>
            <form onSubmit={handleOperatorSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="operator-name">Nome do operador</label>
                  <input
                    id="operator-name"
                    value={operatorForm.name}
                    onChange={(event) => updateOperatorField('name', event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="operator-cpf">CPF</label>
                  <input
                    id="operator-cpf"
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
                    onChange={(event) => updateOperatorField('email', event.target.value)}
                    placeholder="operador@prefeitura.rs.gov.br"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="operator-password">Senha inicial</label>
                  <input
                    id="operator-password"
                    value={operatorForm.password}
                    onChange={(event) => updateOperatorField('password', event.target.value)}
                    placeholder="Senha inicial"
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={savingOperator} type="submit">
                  <ShieldCheck size={16} />
                  {savingOperator ? 'Salvando...' : 'Cadastrar operador'}
                </button>
              </div>
            </form>
          </article>
        ) : null}

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Permissões nesta área</h2>
            <ul className="check-list">
              <li>Gerente e admin criam motoristas</li>
              <li>Gerente e admin criam operadores</li>
              <li>Somente admin cria gerentes</li>
              <li>Veículos ficam vinculados aos motoristas cadastrados</li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Veículos cadastrados</h2>
          {loading ? (
            <p className="table-note">Carregando veículos...</p>
          ) : (
            <div className="assignment-list">
              {vehicles.map((vehicle) => (
                <article className="assignment-card" key={vehicle.id}>
                  <strong>{vehicle.name}</strong>
                  <p className="table-note">{vehicle.plate} • {vehicle.category}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Motoristas cadastrados</h2>
            {loading ? (
              <p className="table-note">Carregando base de motoristas...</p>
            ) : (
              <div className="assignment-list">
                {drivers.map((driver) => (
                  <article className="assignment-card" key={driver.id}>
                    <strong>{driver.name}</strong>
                    <p className="table-note">
                      {driver.cpfMasked} • {driver.phone}
                    </p>
                    <p className="table-note">Veículo: {driver.vehicleName}</p>
                  </article>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Viagens por motorista</h2>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="trip-driver-selector">Selecionar motorista</label>
              <select
                id="trip-driver-selector"
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
              >
                <option value="">Selecione um motorista</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} • {driver.vehicleName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedDriverId ? (
            driverTrips.length > 0 ? (
              <div className="assignment-list">
                {driverTrips.map((trip) => (
                  <article className="assignment-card" key={trip.id}>
                    <div className="assignment-header">
                      <div>
                        <strong>{trip.patientName}</strong>
                        <p className="table-note">
                          {trip.protocol} • {trip.destinationCity}/{trip.destinationState}
                        </p>
                      </div>
                      <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                    </div>
                    <div className="assignment-meta">
                      <span>Saída: {trip.travelDate} {trip.departureTime ? `às ${trip.departureTime}` : ''}</span>
                      <span>Embarque: {trip.boardingLocationLabel || trip.addressLine || 'Não informado'}</span>
                      <span>Acompanhante: {trip.companionRequired ? trip.companionName || 'Sim' : 'Não'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="table-note">Esse motorista ainda não possui viagens atribuídas.</p>
            )
          ) : (
            <p className="table-note">Selecione um motorista para ver as viagens atribuídas a ele.</p>
          )}
        </article>
      </section>
    </div>
  )
}
