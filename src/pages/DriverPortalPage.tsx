import { BusFront, LogOut, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessManager } from '../lib/access'
import { getAdminSession } from '../lib/admin-session'
import { fetchDriverTrips, loginDriver } from '../lib/api'
import { clearDriverSession, getDriverSession, saveDriverSession } from '../lib/driver-session'
import type { AdminSession, DriverSession, TravelRequest } from '../types'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function DriverPortalPage() {
  const [session, setSession] = useState<DriverSession | null>(null)
  const [internalSession, setInternalSession] = useState<AdminSession | null>(null)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [trips, setTrips] = useState<TravelRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSession(getDriverSession())
    setInternalSession(getAdminSession())
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
          setError('Nao foi possivel carregar as viagens do motorista.')
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
      saveDriverSession(result.session)
      setSession(result.session)
    } catch {
      setError('Nao foi possivel autenticar esse motorista.')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clearDriverSession()
    setSession(null)
    setTrips([])
  }

  if (!session && internalSession && canAccessManager(internalSession)) {
    return (
      <div className="public-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Portal do motorista</strong>
            <span>Acesso funcional do motorista com visualizacao administrativa liberada para gerente e admin</span>
          </div>
        </section>

        <article className="public-card">
          <h2>Acesso administrativo liberado</h2>
          <p>Gerente e admin podem acessar esta tela, mas a visao operacional por motorista ficou centralizada na gerencia.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/gerente/motoristas">
              Ir para gerencia de motoristas
            </Link>
            <Link className="action-button secondary" to="/gerente">
              Ir para gerencia
            </Link>
          </div>
        </article>
      </div>
    )
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
            <span>Consulte suas viagens, passageiros e orientacoes da gerencia</span>
          </div>
        </section>

        <article className="public-card">
          <div className="eyebrow">
            <BusFront size={16} />
            Acesso do motorista
          </div>
          <h1>Entrar para ver minhas viagens</h1>
          <p>Use seu CPF e PIN para consultar as viagens atribuidas ao seu nome.</p>
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
          <span>Viagens atribuidas pela gerencia do transporte em saude</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <BusFront size={16} />
          Motorista autenticado
        </div>
        <h1>{session.name}</h1>
        <p>Veiculo designado: <strong>{session.vehicleName}</strong></p>
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
                  <dt>Horario de saida</dt>
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
                  <dd>{trip.phone || 'Nao informado'}</dd>
                </div>
                <div>
                  <dt>Endereco de embarque</dt>
                  <dd>{trip.boardingLocationLabel || trip.addressLine || 'Nao informado'}</dd>
                </div>
                <div>
                  <dt>Acompanhante</dt>
                  <dd>{trip.companionRequired ? trip.companionName || 'Sim' : 'Nao'}</dd>
                </div>
                <div>
                  <dt>Observacoes da gerencia</dt>
                  <dd>{trip.managerNotes || trip.notes || 'Sem observacoes adicionais.'}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <article className="empty-state">
            <BusFront size={28} />
            <h2>Nenhuma viagem atribuida ainda</h2>
            <p>Quando a gerencia vincular um roteiro ao seu CPF, ele aparecera aqui com passageiros, embarque e orientacoes.</p>
          </article>
        )}
      </div>
    </div>
  )
}
