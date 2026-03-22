import { BusFront, LogOut, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { activateDriverPassword, fetchDriverTrips, loginDriver, logoutSession } from '../lib/api'
import { clearDriverSession, getDriverSession, saveDriverSession } from '../lib/driver-session'
import type { DriverSession, TravelRequest } from '../types'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function DriverPortalPage() {
  const [session, setSession] = useState<DriverSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [trips, setTrips] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [firstAccess, setFirstAccess] = useState<{ cpf: string; name: string } | null>(null)

  useEffect(() => {
    setSession(getDriverSession())
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    const driverId = session.driverId
    let active = true

    async function loadTrips() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchDriverTrips(driverId)

        if (active) {
          setTrips(data)
        }
      } catch {
        if (active) {
          setError('Não foi possível carregar as viagens do motorista.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadTrips()

    return () => {
      active = false
    }
  }, [session])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await loginDriver(cpf, password)
      if (result.mustChangePassword || !result.session) {
        setFirstAccess({ cpf, name: result.name })
        setPassword('')
        return
      }
      saveDriverSession(result.session)
      setSession(result.session)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível autenticar esse motorista.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFirstAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!firstAccess) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await activateDriverPassword(firstAccess.cpf, newPassword)
      const result = await loginDriver(firstAccess.cpf, newPassword)

      if (!result.session) {
        setError('Não foi possível concluir o primeiro acesso do motorista.')
        return
      }

      saveDriverSession(result.session)
      setSession(result.session)
      setFirstAccess(null)
      setNewPassword('')
      setCpf('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível concluir o primeiro acesso do motorista.')
    } finally {
      setLoading(false)
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

    clearDriverSession()
    setSession(null)
    setTrips([])
  }

  if (!session) {
    return (
      <div className="public-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Portal do motorista</strong>
            <span>Consulte suas viagens, passageiros e orientações da gerência</span>
          </div>
        </section>

        <article className="public-card">
          <div className="eyebrow">
            <BusFront size={16} />
            Acesso do motorista
          </div>
          <h1>Entrar para ver minhas viagens</h1>
          <p>Use seu CPF e PIN para consultar as viagens atribuídas ao seu nome.</p>
          <form onSubmit={handleLogin}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="driver-login-cpf">CPF</label>
                <input
                  id="driver-login-cpf"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="field">
                <label htmlFor="driver-login-password">PIN do motorista</label>
                <input
                  id="driver-login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="0000"
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="action-button primary" disabled={loading} type="submit">
                <Search size={16} />
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        {firstAccess ? (
          <article className="public-card">
            <div className="eyebrow">
              <BusFront size={16} />
              Primeiro acesso
            </div>
            <h2>Cadastrar novo PIN</h2>
            <p>
              {firstAccess.name}, este acesso foi criado com o PIN temporário <strong>0000</strong>. Defina agora um novo PIN numérico de 4 dígitos.
            </p>
            <form onSubmit={handleFirstAccess}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="driver-new-password">Novo PIN do motorista</label>
                  <input
                    id="driver-new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    placeholder="1234"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button className="action-button primary" disabled={loading || newPassword.length !== 4} type="submit">
                  {loading ? 'Salvando novo PIN...' : 'Confirmar novo PIN'}
                </button>
              </div>
            </form>
          </article>
        ) : null}
      </div>
    )
  }

  return (
    <div className="public-shell">
      <section className="institutional-bar institutional-bar-inner">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Portal do motorista</strong>
          <span>Viagens atribuídas pela gerência do transporte em saúde</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <BusFront size={16} />
          Motorista autenticado
        </div>
        <h1>{session.name}</h1>
        <p>
          Sessão ativa para <strong>{session.name}</strong> com perfil <strong>motorista</strong>.
        </p>
        <p>Veículo preferencial: <strong>{session.vehicleName || 'Não definido'}</strong></p>
        <div className="form-actions">
          <button className="action-button secondary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {error ? <p className="table-note">{error}</p> : null}

      <div className="public-layout">
        {loading ? (
          <article className="public-card">
            <p className="table-note">Carregando viagens do motorista...</p>
          </article>
        ) : trips.length > 0 ? (
          trips.map((trip) => (
            <article className="request-card" key={trip.id}>
              <div className="status-pill-row">
                <span className={`status-badge ${trip.status}`}>{trip.status}</span>
                <span className="status-pill">{trip.protocol}</span>
              </div>
              <h2>{trip.patientName}</h2>
              <dl className="request-summary">
                <div>
                  <dt>Paciente</dt>
                  <dd>{trip.patientName}</dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>
                    {trip.destinationCity}/{trip.destinationState}
                  </dd>
                </div>
                <div>
                  <dt>Veículo da viagem</dt>
                  <dd>{trip.assignedVehicleName || session.vehicleName || 'Não definido'}</dd>
                </div>
                <div>
                  <dt>Horário de saída</dt>
                  <dd>{trip.departureTime || 'A definir'}</dd>
                </div>
                <div>
                  <dt>Unidade</dt>
                  <dd>{trip.treatmentUnit}</dd>
                </div>
                <div>
                  <dt>Especialidade</dt>
                  <dd>{trip.specialty}</dd>
                </div>
                <div>
                  <dt>CPF do paciente</dt>
                  <dd>{trip.cpfMasked}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{trip.phone || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Endereço de embarque</dt>
                  <dd>{trip.boardingLocationLabel || trip.addressLine || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Acompanhante</dt>
                  <dd>{trip.companionRequired ? trip.companionName || 'Sim' : 'Não'}</dd>
                </div>
                <div>
                  <dt>Observações da gerência</dt>
                  <dd>{trip.managerNotes || trip.notes || 'Sem observações adicionais.'}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <article className="empty-state">
            <BusFront size={28} />
            <h2>Nenhuma viagem atribuida ainda</h2>
            <p>Quando a gerência vincular um roteiro ao seu CPF, ele aparecerá aqui com passageiros, embarque e orientações.</p>
          </article>
        )}
      </div>
    </div>
  )
}
