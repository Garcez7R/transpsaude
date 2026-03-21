import { ArrowLeft, BusFront, CarFront, ShieldCheck, UserPlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  updateDriver,
  updateOperator,
  updatePatient,
  updateVehicle,
} from '../lib/api'
import { getManagerSession } from '../lib/manager-session'
import { toEmailCase, toInstitutionalText, toTitleCase } from '../lib/text-format'
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
  password: '',
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

export function DriversPage() {
  const session = typeof window !== 'undefined' ? getManagerSession() : null
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
    password: '',
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
          password: driverForm.password || undefined,
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
            password: operatorForm.password || undefined,
          })
        : await createOperator(operatorForm)
      setOperatorForm({
        name: '',
        cpf: '',
        email: '',
        password: '',
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

  async function handleDeleteOperator(id: number) {
    try {
      const result = await deleteOperator(id)
      setOperators(await fetchOperators())
      if (editingOperatorId === id) {
        setEditingOperatorId(null)
        setOperatorForm({ name: '', cpf: '', email: '', password: '' })
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o operador.')
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
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o motorista.')
    }
  }

  async function handleDeleteVehicle(id: number) {
    try {
      const result = await deleteVehicle(id)
      setVehicles(await fetchVehicles())
      if (editingVehicleId === id) {
        setEditingVehicleId(null)
        setVehicleForm(initialVehicleForm)
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o veículo.')
    }
  }

  async function handleDeletePatient(id: number) {
    try {
      const result = await deletePatient(id)
      setPatients(await fetchPatients())
      if (editingPatientId === id) {
        setEditingPatientId(null)
        setPatientForm(initialPatientForm)
      }
      setMessage(result.message)
      setError('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o paciente.')
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
              <button className="action-button primary" disabled={savingVehicle} type="submit">
                <CarFront size={16} />
                {savingVehicle ? 'Salvando...' : editingVehicleId ? 'Salvar veículo' : 'Cadastrar veículo'}
              </button>
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

        <article className="content-card">
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
                <label htmlFor="driver-password">{editingDriverId ? 'Novo PIN do motorista' : 'PIN inicial do motorista'}</label>
                <input
                  id="driver-password"
                  value={driverForm.password}
                  onChange={(event) => updateDriverField('password', event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="0000"
                  required={!editingDriverId}
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
      </section>

      <section className="dashboard-grid">
        {canAccessManager(session) ? (
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
                  <label htmlFor="operator-password">{editingOperatorId ? 'Nova senha do operador' : 'Senha inicial'}</label>
                  <input
                    id="operator-password"
                    value={operatorForm.password}
                    onChange={(event) => updateOperatorField('password', event.target.value)}
                    placeholder={editingOperatorId ? 'Opcional para redefinir' : 'Senha inicial'}
                    required={!editingOperatorId}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={savingOperator} type="submit">
                  <ShieldCheck size={16} />
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
                        password: '',
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
                    <button className="action-button primary" type="button" onClick={() => void handleDeleteVehicle(vehicle.id)}>
                      Excluir
                    </button>
                  </div>
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
                            password: '',
                          })
                        }}
                      >
                        Editar
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
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="content-card">
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
                <button className="action-button primary" disabled={savingPatient} type="submit">
                  {savingPatient ? 'Salvando...' : 'Salvar paciente'}
                </button>
                <button className="action-button secondary" type="button" onClick={() => {
                  setEditingPatientId(null)
                  setPatientForm(initialPatientForm)
                }}>
                  Cancelar edição
                </button>
              </div>
            </form>
          ) : (
            <div className="assignment-list">
              {patients.map((patient) => (
                <article className="assignment-card" key={patient.id}>
                  <strong>{patient.fullName}</strong>
                  <p className="table-note">{patient.cpfMasked} • {patient.phone}</p>
                  <p className="table-note">Acesso: {patient.accessCpfMasked}</p>
                  <p className="table-note">{patient.addressLine || 'Endereço não informado'}</p>
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
                    <button className="action-button primary" type="button" onClick={() => void handleDeletePatient(patient.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Operadores cadastrados</h2>
            <div className="assignment-list">
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
                          password: '',
                        })
                      }}
                    >
                      Editar
                    </button>
                    <button className="action-button primary" type="button" onClick={() => void handleDeleteOperator(operator.id)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
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
