import { ArrowLeft, BusFront, CarFront, Route, ShieldCheck, UserPlus2, UserRoundSearch, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AsyncActionButton } from '../components/AsyncActionButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InternalSidebar } from '../components/InternalSidebar'
import { canAccessManager, getInternalRoleLabel } from '../lib/access'
import {
  createDriver,
  createOperator,
  createVehicle,
  deleteDriver,
  deleteOperator,
  deletePatient,
  deleteVehicle,
  fetchDriverTrips,
  fetchDrivers,
  fetchOperators,
  fetchPatients,
  fetchVehicles,
  logoutSession,
  resetAccess,
  updateDriver,
  updateOperator,
  updatePatient,
  updateVehicle,
} from '../lib/api'
import { clearManagerSession, getManagerSession } from '../lib/manager-session'
import { clearAdminAreaSession } from '../lib/admin-area-session'
import { clearAdminSession } from '../lib/admin-session'
import { toEmailCase, toInstitutionalText, toTitleCase } from '../lib/text-format'
import { useToastOnChange } from '../lib/use-toast-on-change'
import type {
  CreateDriverInput,
  CreateOperatorInput,
  CreateVehicleInput,
  DriverRecord,
  OperatorRecord,
  PatientRecord,
  TravelRequest,
  UpdatePatientInput,
  VehicleRecord,
} from '../types'

const initialDriverForm: CreateDriverInput = {
  name: '',
  cpf: '',
  phone: '',
  isWhatsapp: false,
  vehicleId: null,
}

const initialVehicleForm: CreateVehicleInput = {
  name: '',
  plate: '',
  category: '',
}

const initialPatientForm: UpdatePatientInput = {
  id: 0,
  fullName: '',
  cpf: '',
  accessCpf: '',
  phone: '',
  isWhatsapp: false,
  addressLine: '',
  cns: '',
  responsibleName: '',
  responsibleCpf: '',
  useResponsibleCpfForAccess: false,
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

  if (/^\d{1,2}$/.test(text)) {
    return false
  }

  return true
}

function getDisplayValue(value?: string | null, fallback = 'Não informado') {
  return isMeaningfulValue(value) ? String(value).trim() : fallback
}

export function DriversPage() {
  const [session, setSession] = useState(() => (typeof window !== 'undefined' ? getManagerSession() : null))
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [operators, setOperators] = useState<OperatorRecord[]>([])
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [driverTrips, setDriverTrips] = useState<TravelRequest[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null)
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null)
  const [editingOperatorId, setEditingOperatorId] = useState<number | null>(null)
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null)
  const [driverForm, setDriverForm] = useState(initialDriverForm)
  const [operatorForm, setOperatorForm] = useState<CreateOperatorInput>({
    name: '',
    cpf: '',
    email: '',
  })
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm)
  const [patientForm, setPatientForm] = useState(initialPatientForm)
  const [loading, setLoading] = useState(true)
  const [savingDriver, setSavingDriver] = useState(false)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingOperator, setSavingOperator] = useState(false)
  const [savingPatient, setSavingPatient] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; name: string } | null>(null)

  useToastOnChange(error, 'error')
  useToastOnChange(message, 'success')

  const selectedDriver = useMemo(
    () => drivers.find((driver) => String(driver.id) === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  )

  const driverTripsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return driverTrips.filter((trip) => trip.travelDate === today).length
  }, [driverTrips])

  useEffect(() => {
    if (!session || !canAccessManager(session)) {
      return
    }

    let active = true

    async function loadData() {
      setLoading(true)

      try {
        const [driverData, vehicleData, operatorData, patientData] = await Promise.all([
          fetchDrivers(),
          fetchVehicles(),
          fetchOperators(),
          fetchPatients(),
        ])

        if (!active) {
          return
        }

        setDrivers(driverData)
        setVehicles(vehicleData)
        setOperators(operatorData)
        setPatients(patientData)

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
  }, [session])

  useEffect(() => {
    if (!selectedDriverId && drivers[0]) {
      setSelectedDriverId(String(drivers[0].id))
    }
  }, [drivers, selectedDriverId])

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverTrips([])
      return
    }

    let active = true

    async function loadTrips() {
      try {
        const data = await fetchDriverTrips(Number(selectedDriverId), 'internal')

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

  function updatePatientField<K extends keyof UpdatePatientInput>(key: K, value: UpdatePatientInput[K]) {
    setPatientForm((current) => ({ ...current, [key]: value }))
  }

  async function handleDriverSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingDriver(true)
    setError('')
    setMessage('')

    try {
      if (editingDriverId) {
        const result = await updateDriver({
          id: editingDriverId,
          ...driverForm,
        })
        setMessage(result.message)
      } else {
        const created = await createDriver(driverForm)
        setDrivers((current) => [created, ...current])
        setMessage(`Motorista ${created.name} cadastrado com sucesso.`)
      }

      const refreshed = await fetchDrivers()
      setDrivers(refreshed)
      setDriverForm(initialDriverForm)
      setEditingDriverId(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o motorista.')
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
      if (editingVehicleId) {
        const result = await updateVehicle({
          id: editingVehicleId,
          ...vehicleForm,
        })
        setMessage(result.message)
      } else {
        const created = await createVehicle(vehicleForm)
        setVehicles((current) => [created, ...current])
        setMessage(`Veículo ${created.name} cadastrado com sucesso.`)
      }

      const refreshed = await fetchVehicles()
      setVehicles(refreshed)
      setVehicleForm(initialVehicleForm)
      setEditingVehicleId(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o veículo.')
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
      const result = editingOperatorId
        ? await updateOperator({
            id: editingOperatorId,
            ...operatorForm,
          })
        : await createOperator(operatorForm)
      setOperatorForm({
        name: '',
        cpf: '',
        email: '',
      })
      setEditingOperatorId(null)
      const refreshed = await fetchOperators()
      setOperators(refreshed)
      setMessage(result.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o operador.')
    } finally {
      setSavingOperator(false)
    }
  }

  async function handlePatientSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPatient(true)
    setError('')
    setMessage('')

    try {
      const result = await updatePatient(patientForm)
      const refreshed = await fetchPatients()
      setPatients(refreshed)
      setEditingPatientId(null)
      setPatientForm(initialPatientForm)
      setMessage(result.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o paciente.')
    } finally {
      setSavingPatient(false)
    }
  }

  function requestDeleteVehicle(id: number) {
    const vehicle = vehicles.find(v => v.id === id)
    setDeleteConfirm({ type: 'veículo', id, name: vehicle?.name || '' })
  }

  function requestDeleteDriver(id: number) {
    const driver = drivers.find(d => d.id === id)
    setDeleteConfirm({ type: 'motorista', id, name: driver?.name || '' })
  }

  function requestDeleteOperator(id: number) {
    const operator = operators.find(o => o.id === id)
    setDeleteConfirm({ type: 'operador', id, name: operator?.name || '' })
  }

  function requestDeletePatient(id: number) {
    const patient = patients.find(p => p.id === id)
    setDeleteConfirm({ type: 'paciente', id, name: patient?.fullName || '' })
  }

  async function executeDelete() {
    if (!deleteConfirm) return

    try {
      switch (deleteConfirm.type) {
        case 'veículo':
          await deleteVehicle(deleteConfirm.id)
          setVehicles(await fetchVehicles())
          if (editingVehicleId === deleteConfirm.id) {
            setEditingVehicleId(null)
            setVehicleForm(initialVehicleForm)
          }
          break
        case 'motorista':
          await deleteDriver(deleteConfirm.id)
          setDrivers(await fetchDrivers())
          if (editingDriverId === deleteConfirm.id) {
            setEditingDriverId(null)
            setDriverForm(initialDriverForm)
          }
          break
        case 'operador':
          await deleteOperator(deleteConfirm.id)
          setOperators(await fetchOperators())
          if (editingOperatorId === deleteConfirm.id) {
            setEditingOperatorId(null)
            setOperatorForm({ name: '', cpf: '', email: '' })
          }
          break
        case 'paciente':
          await deletePatient(deleteConfirm.id)
          setPatients(await fetchPatients())
          if (editingPatientId === deleteConfirm.id) {
            setEditingPatientId(null)
            setPatientForm(initialPatientForm)
          }
          break
      }
      setMessage(`${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)} excluído com sucesso.`)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : `Não foi possível excluir o ${deleteConfirm.type}.`)
    } finally {
      setDeleteConfirm(null)
    }
  }

  async function handleResetAccess(targetType: 'operator' | 'driver' | 'patient', id: number) {
    try {
      const result = await resetAccess(targetType, id)
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível redefinir esse acesso.')
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

    clearManagerSession()
    clearAdminAreaSession()
    clearAdminSession()
    setSession(null)
  }

  if (!session) {
    return (
      <div className="dashboard-shell internal-shell">
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
      <div className="dashboard-shell internal-shell">
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
    <div className="dashboard-shell internal-shell">
      <div className="saas-app-shell">
        <InternalSidebar
          actions={
            <>
              <Link className="action-button secondary" to="/gerente">
                <ArrowLeft size={16} />
                Voltar para gerência
              </Link>
              <button className="action-button primary" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          }
          items={[
            { to: '/gerente', label: 'Gerência', icon: Route },
            { to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users, exact: true },
            { to: '/gerente/pacientes', label: 'Base de pacientes', icon: UserRoundSearch },
            { to: '/motorista', label: 'Portal do motorista', icon: BusFront },
            ...(session.role === 'admin'
              ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }]
              : []),
          ]}
          sessionName={session.name}
          sessionRole={getInternalRoleLabel(session.role)}
          subtitle="Cadastros administrativos e visão operacional das viagens por motorista"
          title="Equipe e veículos"
        />

        <main className="saas-main saas-main--fleet">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <BusFront size={16} />
                Equipe e veículos
              </div>
              <h1>Gestão da equipe de transporte</h1>
              <p>Mantenha motoristas, veículos, operadores e pacientes com visão mais operacional da frota.</p>
            </div>

            <div className="page-actions">
              <Link className="action-button primary" to="/motorista">
                Painel do motorista
              </Link>
            </div>
          </header>

      {error ? <p className="table-note">{error}</p> : null}
      {message ? <p className="table-note">{message}</p> : null}

      <section className="metrics-grid">
        <article className="metric-card">
          <strong>{drivers.length}</strong>
          <p>motoristas cadastrados</p>
        </article>
        <article className="metric-card">
          <strong>{vehicles.length}</strong>
          <p>veículos disponíveis</p>
        </article>
        <article className="metric-card">
          <strong>{operators.length}</strong>
          <p>operadores vinculados</p>
        </article>
        <article className="metric-card">
          <strong>{patients.length}</strong>
          <p>pacientes na base</p>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-single fleet-overview-shell">
        <article className="content-card fleet-overview-card data-access-card">
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

          <div className="status-line">
            <span className="subtle-label">
              <Route size={14} />
              {selectedDriver ? `${driverTrips.length} viagem(ns) vinculada(s) a ${selectedDriver.name}` : 'Selecione um motorista para abrir a agenda'}
            </span>
            <div className="status-line-actions">
              <span className="status-pill">Motoristas: {drivers.length}</span>
              <span className="status-pill">Veículos: {vehicles.length}</span>
              <span className="status-pill">Operadores: {operators.length}</span>
            </div>
          </div>

          {selectedDriver ? (
            <>
              <div className="travel-overview-grid">
                <article className="travel-overview-card">
                  <span>Motorista selecionado</span>
                  <strong>{selectedDriver.name}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Veículo preferencial</span>
                  <strong>{selectedDriver.vehicleName || 'Sem vínculo fixo'}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Viagens atribuídas</span>
                  <strong>{driverTrips.length}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Viagens para hoje</span>
                  <strong>{driverTripsToday}</strong>
                </article>
              </div>

              {driverTrips.length > 0 ? (
                <div className="assignment-list scroll-list">
                  {driverTrips.map((trip) => (
                    <article className="assignment-card" key={trip.id}>
                      <div className="assignment-header">
                        <div>
                          <strong>{getDisplayValue(trip.patientName, 'Paciente não informado')}</strong>
                          <p className="table-note">
                            {trip.protocol} • {trip.destinationCity}/{trip.destinationState}
                          </p>
                        </div>
                        <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                      </div>
                      <div className="travel-overview-grid">
                        <article className="travel-overview-card">
                          <span>Consulta</span>
                          <strong>{trip.appointmentTime ? `${formatDisplayDate(trip.travelDate)} às ${trip.appointmentTime}` : formatDisplayDate(trip.travelDate)}</strong>
                        </article>
                        <article className="travel-overview-card">
                          <span>Saída</span>
                          <strong>{trip.departureTime ? `${formatDisplayDate(trip.travelDate)} às ${trip.departureTime}` : 'A definir'}</strong>
                        </article>
                        <article className="travel-overview-card">
                          <span>Embarque</span>
                          <strong>{getDisplayValue(trip.boardingLocationLabel || trip.addressLine)}</strong>
                        </article>
                        <article className="travel-overview-card">
                          <span>Acompanhante</span>
                          <strong>{trip.companionRequired ? getDisplayValue(trip.companionName, 'Necessário') : 'Não necessário'}</strong>
                        </article>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="table-note">Esse motorista ainda não possui viagens atribuídas.</p>
              )}
            </>
          ) : (
            <p className="table-note">Selecione um motorista para ver as viagens atribuídas a ele.</p>
          )}
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-balanced fleet-forms-grid">
        <article className="content-card fleet-form-card">
          <h2>{editingVehicleId ? 'Editar veículo' : 'Novo veículo'}</h2>
          <form onSubmit={handleVehicleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="vehicle-name">Nome do veículo</label>
                <input
                  id="vehicle-name"
                  value={vehicleForm.name}
                  onChange={(event) => updateVehicleField('name', toInstitutionalText(event.target.value))}
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
                  onChange={(event) => updateVehicleField('category', toTitleCase(event.target.value))}
                  placeholder="Van, Ambulância, Micro-ônibus..."
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <AsyncActionButton icon={CarFront} loading={savingVehicle} loadingLabel="Salvando..." type="submit">
                {editingVehicleId ? 'Salvar veículo' : 'Cadastrar veículo'}
              </AsyncActionButton>
              {editingVehicleId ? (
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setEditingVehicleId(null)
                    setVehicleForm(initialVehicleForm)
                  }}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="content-card fleet-form-card">
          <h2>{editingDriverId ? 'Editar motorista' : 'Novo motorista'}</h2>
          <form onSubmit={handleDriverSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="driver-name">Nome do motorista</label>
                <input
                  id="driver-name"
                  value={driverForm.name}
                  onChange={(event) => updateDriverField('name', toTitleCase(event.target.value))}
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
                <label htmlFor="driver-vehicle">Veículo preferencial</label>
                <select
                  id="driver-vehicle"
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
              <AsyncActionButton icon={UserPlus2} loading={savingDriver} loadingLabel="Salvando..." type="submit">
                {editingDriverId ? 'Salvar motorista' : 'Cadastrar motorista'}
              </AsyncActionButton>
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
      </section>

      <section className="dashboard-grid dashboard-grid-main fleet-operators-shell">
        {canAccessManager(session) ? (
          <article className="content-card fleet-form-card">
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
                <AsyncActionButton icon={ShieldCheck} loading={savingOperator} loadingLabel="Salvando..." type="submit">
                  {editingOperatorId ? 'Salvar operador' : 'Cadastrar operador'}
                </AsyncActionButton>
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
        ) : null}

        <aside className="dashboard-side">
          <article className="content-card dashboard-side-sticky fleet-guidance-card">
            <h2>Permissões nesta área</h2>
            <ul className="check-list">
              <li>Gerente e admin criam motoristas</li>
              <li>Gerente e admin criam operadores</li>
              <li>Somente admin cria gerentes</li>
              <li>O veículo no cadastro do motorista é apenas preferencial</li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="dashboard-grid dashboard-grid-main fleet-lists-shell">
        <article className="content-card fleet-list-card">
          <h2>Veículos cadastrados</h2>
          {loading ? (
            <p className="table-note">Carregando veículos...</p>
          ) : (
            <div className="assignment-list scroll-list">
              {vehicles.map((vehicle) => (
                <article className="assignment-card" key={vehicle.id}>
                  <strong>{vehicle.name}</strong>
                  <p className="table-note">{vehicle.plate} • {vehicle.category}</p>
                  <div className="form-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setEditingVehicleId(vehicle.id)
                        setVehicleForm({
                          name: vehicle.name,
                          plate: vehicle.plate,
                          category: vehicle.category,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button danger" type="button" onClick={() => requestDeleteVehicle(vehicle.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="dashboard-side">
          <article className="content-card fleet-list-card">
            <h2>Motoristas cadastrados</h2>
            {loading ? (
              <p className="table-note">Carregando base de motoristas...</p>
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
                    <button className="action-button danger" type="button" onClick={() => requestDeleteDriver(driver.id)}>
                      Excluir
                    </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>

      <section className="dashboard-grid dashboard-grid-main fleet-lists-shell">
        <article className="content-card fleet-list-card">
          <h2>{editingPatientId ? 'Editar paciente' : 'Pacientes cadastrados'}</h2>
          {editingPatientId ? (
            <form onSubmit={handlePatientSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="patient-edit-name">Nome</label>
                  <input id="patient-edit-name" value={patientForm.fullName} onChange={(event) => updatePatientField('fullName', toTitleCase(event.target.value))} required />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-cpf">CPF</label>
                  <input id="patient-edit-cpf" value={patientForm.cpf} onChange={(event) => updatePatientField('cpf', formatCpf(event.target.value))} inputMode="numeric" required />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-access-cpf">CPF de acesso</label>
                  <input id="patient-edit-access-cpf" value={patientForm.accessCpf} onChange={(event) => updatePatientField('accessCpf', formatCpf(event.target.value))} inputMode="numeric" required />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-phone">Telefone</label>
                  <input id="patient-edit-phone" value={patientForm.phone} onChange={(event) => updatePatientField('phone', formatPhone(event.target.value))} inputMode="tel" required />
                </div>
                <div className="field full checkbox-field">
                  <label className="checkbox-row" htmlFor="patient-edit-whatsapp">
                    <input id="patient-edit-whatsapp" type="checkbox" checked={patientForm.isWhatsapp} onChange={(event) => updatePatientField('isWhatsapp', event.target.checked)} />
                    <span>Esse telefone é WhatsApp</span>
                  </label>
                </div>
                <div className="field full">
                  <label htmlFor="patient-edit-address">Endereço</label>
                  <input id="patient-edit-address" value={patientForm.addressLine} onChange={(event) => updatePatientField('addressLine', toInstitutionalText(event.target.value))} required />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-cns">CNS</label>
                  <input id="patient-edit-cns" value={patientForm.cns} onChange={(event) => updatePatientField('cns', event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-responsible-name">Responsável</label>
                  <input id="patient-edit-responsible-name" value={patientForm.responsibleName} onChange={(event) => updatePatientField('responsibleName', toTitleCase(event.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor="patient-edit-responsible-cpf">CPF do responsável</label>
                  <input id="patient-edit-responsible-cpf" value={patientForm.responsibleCpf} onChange={(event) => updatePatientField('responsibleCpf', formatCpf(event.target.value))} inputMode="numeric" />
                </div>
                <div className="field full checkbox-field">
                  <label className="checkbox-row" htmlFor="patient-edit-use-responsible">
                    <input id="patient-edit-use-responsible" type="checkbox" checked={patientForm.useResponsibleCpfForAccess} onChange={(event) => updatePatientField('useResponsibleCpfForAccess', event.target.checked)} />
                    <span>Usar CPF do responsável como acesso</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <AsyncActionButton loading={savingPatient} loadingLabel="Salvando..." type="submit">
                  Salvar paciente
                </AsyncActionButton>
                <button className="action-button secondary" type="button" onClick={() => {
                  setEditingPatientId(null)
                  setPatientForm(initialPatientForm)
                }}>
                  Cancelar edição
                </button>
              </div>
            </form>
          ) : (
            <div className="assignment-list scroll-list">
              {patients.map((patient) => (
                <article className="assignment-card" key={patient.id}>
                  <strong>{getDisplayValue(patient.fullName, 'Paciente não informado')}</strong>
                  <p className="table-note">{patient.cpfMasked} • {patient.phone}</p>
                  <p className="table-note">Acesso: {patient.accessCpfMasked}</p>
                  <p className="table-note">{getDisplayValue(patient.addressLine, 'Endereço não informado')}</p>
                  <div className="form-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setEditingPatientId(patient.id)
                        setPatientForm({
                          id: patient.id,
                          fullName: patient.fullName,
                          cpf: patient.cpfMasked,
                          accessCpf: patient.accessCpfMasked,
                          phone: patient.phone,
                          isWhatsapp: patient.isWhatsapp,
                          addressLine: patient.addressLine,
                          cns: patient.cns ?? '',
                          responsibleName: patient.responsibleName ?? '',
                          responsibleCpf: patient.responsibleCpfMasked ?? '',
                          useResponsibleCpfForAccess: patient.useResponsibleCpfForAccess,
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button secondary" type="button" onClick={() => void handleResetAccess('patient', patient.id)}>
                      Resetar acesso
                    </button>
                    <button className="action-button danger" type="button" onClick={() => requestDeletePatient(patient.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="dashboard-side">
          <article className="content-card fleet-list-card">
            <h2>Operadores cadastrados</h2>
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
                    <button className="action-button danger" type="button" onClick={() => requestDeleteOperator(operator.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>
        </main>

        <ConfirmDialog
          isOpen={!!deleteConfirm}
          title={`Excluir ${deleteConfirm?.type}`}
          message={deleteConfirm?.name 
            ? `Tem certeza que deseja excluir ${deleteConfirm.type} "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`
            : `Tem certeza que deseja excluir este ${deleteConfirm?.type}? Esta ação não pode ser desfeita.`}
          onConfirm={executeDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      </div>
    </div>
  )
}
