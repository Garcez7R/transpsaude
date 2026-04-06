import { ArrowLeft, Fuel, LogOut, Route, ShieldCheck, Truck, UserRoundSearch, Users, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InternalSidebar } from '../components/InternalSidebar'
import { canAccessManager, getInternalRoleLabel } from '../lib/access'
import { createVehicleLog, fetchVehicleDetail, logoutSession } from '../lib/api'
import { clearAdminSession, getAdminSession } from '../lib/admin-session'
import { clearAdminAreaSession } from '../lib/admin-area-session'
import { clearManagerSession, getManagerSession } from '../lib/manager-session'
import { useToastOnChange } from '../lib/use-toast-on-change'
import type { AdminSession, VehicleDetailResponse } from '../types'

function formatKm(value?: number | null) {
  if (!value || !Number.isFinite(value)) {
    return '—'
  }
  return `${Math.round(value).toLocaleString('pt-BR')} km`
}

function formatLiters(value?: number | null) {
  if (!value || !Number.isFinite(value)) {
    return '—'
  }
  return `${Number(value).toFixed(1)} L`
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  const normalized = value.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return value
  }
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function VehicleDetailsPage() {
  const params = useParams()
  const vehicleId = Number(params.id ?? '')
  const [session, setSession] = useState<AdminSession | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }
    return getManagerSession() ?? getAdminSession()
  })
  const [detail, setDetail] = useState<VehicleDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [maintenanceType, setMaintenanceType] = useState('')
  const [maintenanceOdometer, setMaintenanceOdometer] = useState('')
  const [maintenanceNextDue, setMaintenanceNextDue] = useState('')
  const [maintenanceNotes, setMaintenanceNotes] = useState('')

  useToastOnChange(error, 'error')
  useToastOnChange(message, 'success')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    setSession(getManagerSession() ?? getAdminSession())
  }, [])

  useEffect(() => {
    if (!session || !canAccessManager(session) || !Number.isFinite(vehicleId) || vehicleId <= 0) {
      return
    }

    let active = true

    async function loadDetail() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchVehicleDetail(vehicleId)
        if (active) {
          setDetail(data)
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Não foi possível carregar o painel do veículo.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [session, vehicleId])

  async function handleMaintenanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!detail) {
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await createVehicleLog({
        vehicleId: detail.vehicle.id,
        entryType: 'maintenance',
        odometerKm: Number(maintenanceOdometer),
        maintenanceType: maintenanceType.trim(),
        nextDueKm: maintenanceNextDue ? Number(maintenanceNextDue) : undefined,
        notes: maintenanceNotes.trim(),
      })
      setMessage('Manutenção registrada com sucesso.')
      setMaintenanceType('')
      setMaintenanceOdometer('')
      setMaintenanceNextDue('')
      setMaintenanceNotes('')
      const refreshed = await fetchVehicleDetail(vehicleId)
      setDetail(refreshed)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível registrar a manutenção.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    if (session?.token) {
      try {
        await logoutSession(session.token)
      } catch {
        // segue a limpeza local mesmo se a API falhar
      }
    }

    clearManagerSession()
    clearAdminAreaSession()
    clearAdminSession()
    setSession(null)
  }

  const fuelLogs = detail?.fuelLogs ?? []
  const maintenanceLogs = detail?.maintenanceLogs ?? []
  const trips = detail?.trips ?? []
  const driverTotals = detail?.driverTotals ?? []

  const averageConsumption = useMemo(() => {
    if (!detail?.summary?.averageConsumptionKmPerLiter) {
      return '—'
    }
    return `${detail.summary.averageConsumptionKmPerLiter.toFixed(1)} km/L`
  }, [detail])

  if (!session || !canAccessManager(session)) {
    return (
      <div className="dashboard-shell internal-shell">
        <article className="content-card">
          <h2>Acesso negado</h2>
          <p>Somente gerente e administrador podem acessar os detalhes do veículo.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/gerente">
              Voltar para a gerência
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
              <Link className="action-button secondary" to="/gerente/equipe">
                <ArrowLeft size={16} />
                Voltar para equipe
              </Link>
              <button className="action-button primary" type="button" onClick={handleLogout}>
                <LogOut size={16} />
                Sair
              </button>
            </>
          }
          items={[
            { to: '/gerente', label: 'Gerência', icon: Route },
            { to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users },
            { to: '/gerente/pacientes', label: 'Base de pacientes', icon: UserRoundSearch },
            ...(session.role === 'admin'
              ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }]
              : []),
          ]}
          sessionName={session.name}
          sessionRole={getInternalRoleLabel(session.role)}
          subtitle="Telemetria, manutenção e histórico operacional"
          title="Painel do veículo"
        />

        <main className="saas-main saas-main--admin">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <Truck size={16} />
                Veículo
              </div>
              <h1>{detail?.vehicle?.name ?? 'Painel do veículo'}</h1>
              <p>Telemetria, abastecimentos e histórico de viagens para tomada de decisão.</p>
            </div>
          </header>

          {error ? <p className="table-note">{error}</p> : null}
          {message ? <p className="table-note">{message}</p> : null}

          {loading || !detail ? (
            <article className="content-card">
              <p className="table-note">Carregando detalhes do veículo...</p>
            </article>
          ) : (
            <>
              <section className="metrics-grid">
                <article className="metric-card">
                  <strong>{formatKm(detail.summary.lastOdometerKm)}</strong>
                  <p>odômetro atual</p>
                </article>
                <article className="metric-card">
                  <strong>{averageConsumption}</strong>
                  <p>consumo médio estimado</p>
                </article>
                <article className="metric-card">
                  <strong>{detail.summary.estimatedAutonomyKm ? formatKm(detail.summary.estimatedAutonomyKm) : '—'}</strong>
                  <p>autonomia estimada</p>
                </article>
                <article className="metric-card">
                  <strong>{detail.summary.lastFuel ? formatDate(detail.summary.lastFuel.recordedAt) : '—'}</strong>
                  <p>último abastecimento</p>
                </article>
              </section>

              <section className="dashboard-grid dashboard-grid-balanced">
                <article className="content-card">
                  <div className="eyebrow">
                    <Fuel size={16} />
                    Telemetria
                  </div>
                  <h2>Resumo de combustível</h2>
                  <div className="request-summary">
                    <div>
                      <dt>Combustível</dt>
                      <dd>{detail.summary.lastFuel?.fuelType || 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt>Litros no último abastecimento</dt>
                      <dd>{detail.summary.lastFuel ? formatLiters(detail.summary.lastFuel.liters) : '—'}</dd>
                    </div>
                    <div>
                      <dt>Odômetro do último registro</dt>
                      <dd>{detail.summary.lastFuel ? formatKm(detail.summary.lastFuel.odometerKm) : '—'}</dd>
                    </div>
                  </div>
                </article>

                <article className="content-card">
                  <div className="eyebrow">
                    <Wrench size={16} />
                    Manutenção
                  </div>
                  <h2>Registrar revisão</h2>
                  <form onSubmit={handleMaintenanceSubmit}>
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="maintenance-type">Tipo de manutenção</label>
                        <input
                          id="maintenance-type"
                          value={maintenanceType}
                          onChange={(event) => setMaintenanceType(event.target.value)}
                          placeholder="Troca de óleo, revisão, troca de pneu..."
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="maintenance-odometer">Odômetro (km)</label>
                        <input
                          id="maintenance-odometer"
                          type="number"
                          value={maintenanceOdometer}
                          onChange={(event) => setMaintenanceOdometer(event.target.value)}
                          placeholder="Ex.: 52300"
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="maintenance-next">Próxima revisão (km)</label>
                        <input
                          id="maintenance-next"
                          type="number"
                          value={maintenanceNextDue}
                          onChange={(event) => setMaintenanceNextDue(event.target.value)}
                          placeholder="Ex.: 57000"
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="maintenance-notes">Observações</label>
                        <textarea
                          id="maintenance-notes"
                          rows={3}
                          value={maintenanceNotes}
                          onChange={(event) => setMaintenanceNotes(event.target.value)}
                          placeholder="Detalhes, alertas ou pontos de atenção."
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="action-button primary" type="submit" disabled={saving}>
                        Salvar manutenção
                      </button>
                    </div>
                  </form>
                </article>
              </section>

              <section className="dashboard-grid dashboard-grid-balanced">
                <article className="content-card">
                  <h2>Abastecimentos recentes</h2>
                  {fuelLogs.length > 0 ? (
                    <div className="assignment-list scroll-list">
                      {fuelLogs.map((log) => (
                        <article className="assignment-card" key={log.id}>
                          <strong>{formatDate(log.recordedAt)} • {formatLiters(log.liters)}</strong>
                          <p className="table-note">
                            Odômetro: {formatKm(log.odometerKm)} • {log.fuelType || 'Combustível não informado'}
                          </p>
                          <p className="table-note">Motorista: {log.driverName || 'Não informado'}</p>
                          {log.notes ? <p className="table-note">{log.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="table-note">Nenhum abastecimento registrado ainda.</p>
                  )}
                </article>

                <article className="content-card">
                  <h2>Manutenções recentes</h2>
                  {maintenanceLogs.length > 0 ? (
                    <div className="assignment-list scroll-list">
                      {maintenanceLogs.map((log) => (
                        <article className="assignment-card" key={log.id}>
                          <strong>{log.maintenanceType || 'Manutenção'}</strong>
                          <p className="table-note">
                            {formatDate(log.recordedAt)} • Odômetro {formatKm(log.odometerKm)}
                          </p>
                          {log.nextDueKm ? <p className="table-note">Próxima revisão: {formatKm(log.nextDueKm)}</p> : null}
                          {log.notes ? <p className="table-note">{log.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="table-note">Nenhuma manutenção registrada ainda.</p>
                  )}
                </article>
              </section>

              <section className="dashboard-grid dashboard-grid-balanced">
                <article className="content-card">
                  <h2>Histórico de viagens</h2>
                  {trips.length > 0 ? (
                    <div className="assignment-list scroll-list">
                      {trips.map((trip) => (
                        <article className="assignment-card" key={trip.id}>
                          <strong>{formatDate(trip.travelDate)}</strong>
                          <p className="table-note">
                            Destino: {trip.destinationCity}/{trip.destinationState}
                          </p>
                          <p className="table-note">Motorista: {trip.driverName || 'Não informado'}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="table-note">Nenhuma viagem vinculada a este veículo.</p>
                  )}
                </article>

                <article className="content-card">
                  <h2>Totais por condutor</h2>
                  {driverTotals.length > 0 ? (
                    <div className="assignment-list scroll-list">
                      {driverTotals.map((driver) => (
                        <article className="assignment-card" key={driver.driverName}>
                          <strong>{driver.driverName}</strong>
                          <p className="table-note">{driver.totalTrips} viagem(ns) registradas</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="table-note">Ainda não há viagens agrupadas por condutor.</p>
                  )}
                </article>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
