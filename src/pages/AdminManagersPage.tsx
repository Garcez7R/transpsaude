import { ArrowLeft, ShieldCheck, UserPlus2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessAdmin, isValidInternalRole } from '../lib/access'
import { createManager, createOperator, loginAdmin } from '../lib/api'
import { clearAdminSession, saveAdminSession } from '../lib/admin-session'
import { clearManagerSession } from '../lib/manager-session'
import { clearAdminAreaSession, getAdminAreaSession, saveAdminAreaSession } from '../lib/admin-area-session'
import type { CreateManagerInput, CreateOperatorInput } from '../types'

const initialForm: CreateManagerInput = {
  name: '',
  cpf: '',
  email: '',
  password: '',
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function AdminManagersPage() {
  const session = typeof window !== 'undefined' ? getAdminAreaSession() : null
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [form, setForm] = useState(initialForm)
  const [operatorForm, setOperatorForm] = useState<CreateOperatorInput>({
    name: '',
    cpf: '',
    email: '',
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingOperator, setSavingOperator] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function updateField<K extends keyof CreateManagerInput>(key: K, value: CreateManagerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateOperatorField<K extends keyof CreateOperatorInput>(key: K, value: CreateOperatorInput[K]) {
    setOperatorForm((current) => ({ ...current, [key]: value }))
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const result = await loginAdmin(cpf, password)

      if (!isValidInternalRole(result.session.role) || !canAccessAdmin(result.session)) {
        setAuthError('Somente o administrador pode acessar esta área.')
        return
      }

      saveAdminSession(result.session)
      saveAdminAreaSession(result.session)
      setCpf('')
      setPassword('')
      window.location.reload()
    } catch {
      setAuthError('Não foi possível autenticar esse acesso administrativo.')
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
      const result = await createManager(form)
      setMessage(result.message)
      setForm(initialForm)
    } catch {
      setError('Não foi possível cadastrar esse gerente.')
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
      const result = await createOperator(operatorForm)
      setMessage(result.message)
      setOperatorForm({
        name: '',
        cpf: '',
        email: '',
        password: '',
      })
    } catch {
      setError('Não foi possível cadastrar esse operador.')
    } finally {
      setSavingOperator(false)
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
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="content-card">
          <h2>Novo gerente</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="manager-name">Nome do gerente</label>
                <input
                  id="manager-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
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
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="gerencia@prefeitura.rs.gov.br"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="manager-password-register">Senha inicial</label>
                <input
                  id="manager-password-register"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Senha inicial"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={saving} type="submit">
                <UserPlus2 size={16} />
                {saving ? 'Salvando...' : 'Cadastrar gerente'}
              </button>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
          {message ? <p className="table-note">{message}</p> : null}
        </article>

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
                  onChange={(event) => updateOperatorField('email', event.target.value)}
                  placeholder="operador@prefeitura.rs.gov.br"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="operator-password-register">Senha inicial</label>
                <input
                  id="operator-password-register"
                  value={operatorForm.password}
                  onChange={(event) => updateOperatorField('password', event.target.value)}
                  placeholder="Senha inicial"
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="action-button primary" disabled={savingOperator} type="submit">
                <UserPlus2 size={16} />
                {savingOperator ? 'Salvando...' : 'Cadastrar operador'}
              </button>
            </div>
          </form>
        </article>

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Permissões por perfil</h2>
            <ul className="check-list">
              <li>Administrador cria gerente e operador</li>
              <li>Gerente e administrador criam motorista e operador</li>
              <li>Somente administrador cria novos gerentes</li>
              <li>O painel do admin concentra a governança dos acessos internos</li>
            </ul>
          </article>
          <article className="content-card">
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                clearAdminSession()
                clearAdminAreaSession()
                clearManagerSession()
                window.location.reload()
              }}
            >
              Sair do admin
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
