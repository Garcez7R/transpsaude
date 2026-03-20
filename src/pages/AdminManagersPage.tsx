import { ArrowLeft, ShieldCheck, UserPlus2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccessAdmin } from '../lib/access'
import { createManager } from '../lib/api'
import { getAdminSession } from '../lib/admin-session'
import type { CreateManagerInput } from '../types'

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
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function updateField<K extends keyof CreateManagerInput>(key: K, value: CreateManagerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
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
      setError('Nao foi possivel cadastrar esse gerente.')
    } finally {
      setSaving(false)
    }
  }

  if (!session || !canAccessAdmin(session)) {
    return (
      <div className="dashboard-shell">
        <article className="content-card">
          <h2>Acesso restrito ao admin</h2>
          <p>Somente o administrador pode criar novos gerentes.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/operador">
              Ir para operador
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
          <strong>Area administrativa do sistema</strong>
          <span>Cadastro de gerentes com permissao de gestao total</span>
        </div>
      </section>

      <header className="topbar">
        <div className="page-title-block">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Admin
          </div>
          <h1>Cadastrar gerente</h1>
          <p>Somente o administrador pode criar novos acessos de gerente para o sistema.</p>
        </div>

        <div className="page-actions">
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
                <label htmlFor="manager-email">Email institucional</label>
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

        <aside className="dashboard-side">
          <article className="content-card">
            <h2>Permissoes do gerente</h2>
            <ul className="check-list">
              <li>Acesso ao operador, gerencia e area funcional de motoristas</li>
              <li>Atribuicao de motorista, embarque e reagendamento</li>
              <li>Cadastro de veiculos e consulta de viagens por motorista</li>
              <li>Sem permissão para criar outros gerentes</li>
            </ul>
          </article>
        </aside>
      </section>
    </div>
  )
}
