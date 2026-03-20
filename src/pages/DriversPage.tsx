import { ArrowLeft, BusFront, UserPlus2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createDriver, fetchDrivers } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type { CreateDriverInput, DriverRecord } from '../types'

const initialForm: CreateDriverInput = {
  name: '',
  cpf: '',
  phone: '',
  isWhatsapp: false,
  vehicleName: '',
  password: '',
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
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!session) {
      return
    }

    let active = true

    async function loadDrivers() {
      setLoading(true)

      try {
        const data = await fetchDrivers()

        if (active) {
          setDrivers(data)
        }
      } catch {
        if (active) {
          setError('Nao foi possivel carregar os motoristas.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDrivers()

    return () => {
      active = false
    }
  }, [session])

  function updateField<K extends keyof CreateDriverInput>(key: K, value: CreateDriverInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const created = await createDriver(form)
      setDrivers((current) => [created, ...current])
      setForm(initialForm)
      setMessage(`Motorista ${created.name} cadastrado com sucesso.`)
    } catch {
      setError('Nao foi possivel salvar o motorista.')
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Sessao administrativa necessaria</h2>
          <p>Cadastros de motoristas ficam disponiveis somente para a equipe interna.</p>
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
          <strong>Base de motoristas da Prefeitura de Capão do Leão</strong>
          <span>Cadastre acessos e veiculos para uso na distribuicao das viagens</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <BusFront size={16} />
            Motoristas
          </div>
          <h1>Cadastro e controle de motoristas</h1>
          <p>Esses acessos serao usados pela gerencia para distribuir as viagens e pelo motorista para consultar suas rotas.</p>
        </div>

        <div className="page-actions">
          <Link className="action-button secondary" to="/operador/gerencia">
            Gerencia
          </Link>
          <Link className="action-button secondary" to="/operador">
            <ArrowLeft size={16} />
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Novo motorista</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="driver-name">Nome do motorista</label>
                <input
                  id="driver-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-cpf">CPF</label>
                <input
                  id="driver-cpf"
                  value={form.cpf}
                  onChange={(event) => updateField('cpf', formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-phone">Telefone</label>
                <input
                  id="driver-phone"
                  value={form.phone}
                  onChange={(event) => updateField('phone', formatPhone(event.target.value))}
                  inputMode="tel"
                  placeholder="(53) 99999-9999"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="vehicle-name">Veiculo principal</label>
                <input
                  id="vehicle-name"
                  value={form.vehicleName}
                  onChange={(event) => updateField('vehicleName', event.target.value)}
                  placeholder="Van 01, Micro-onibus..."
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="driver-password">Senha inicial do motorista</label>
                <input
                  id="driver-password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value.replace(/\D/g, '').slice(0, 6))}
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
                    checked={form.isWhatsapp}
                    onChange={(event) => updateField('isWhatsapp', event.target.checked)}
                  />
                  <span>Esse telefone do motorista é WhatsApp</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button className="action-button primary" disabled={saving} type="submit">
                <UserPlus2 size={16} />
                {saving ? 'Salvando...' : 'Cadastrar motorista'}
              </button>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
          {message ? <p className="table-note">{message}</p> : null}
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
                    <p className="table-note">Veiculo: {driver.vehicleName}</p>
                    <p className="table-note">{driver.isWhatsapp ? 'Contato via WhatsApp disponivel' : 'Contato telefonico padrao'}</p>
                  </article>
                ))}
                {drivers.length === 0 ? <p className="table-note">Nenhum motorista cadastrado ainda.</p> : null}
              </div>
            )}
          </article>
        </aside>
      </section>
    </div>
  )
}
