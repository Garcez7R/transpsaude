import { KeyRound, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activateCitizenPin, loginCitizen } from '../lib/api'
import type { CitizenAccessResponse, PublicRequestDetails } from '../types'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function PublicStatusPage() {
  const [cpf, setCpf] = useState('248.903.120-31')
  const [password, setPassword] = useState('0000')
  const [newPin, setNewPin] = useState('')
  const [access, setAccess] = useState<CitizenAccessResponse | null>(null)
  const [request, setRequest] = useState<PublicRequestDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await loginCitizen(cpf, password)
      setAccess(data)
      setRequest(data.request)
    } catch {
      setAccess(null)
      setRequest(null)
      setError('Nao encontramos acesso para esse CPF e senha/PIN.')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivatePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await activateCitizenPin(cpf, newPin)
      setAccess(data)
      setRequest(data.request)
      setPassword(newPin)
      setNewPin('')
    } catch {
      setError('Nao foi possivel ativar o novo PIN. Confira se ele tem 4 digitos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="public-shell">
      <section className="institutional-bar institutional-bar-inner">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Consulta pública da Prefeitura de Capão do Leão</strong>
          <span>Acompanhamento de solicitações de transporte para tratamento</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Consulta do cidadao
        </div>
        <h1>Acompanhe sua solicitacao de viagem</h1>
        <p>
          Informe seu CPF e a senha atual. No primeiro acesso, o cidadão entra com a senha
          temporária <strong>0000</strong> e já define um PIN numérico de 4 dígitos.
        </p>
      </header>

      <div className="public-layout">
        <article className="public-card">
          <h2>Acessar acompanhamento</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  value={cpf}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="field">
                <label htmlFor="password">Senha atual ou PIN</label>
                <input
                  id="password"
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
                {loading ? 'Entrando...' : 'Entrar e acompanhar'}
              </button>
              <Link className="action-button secondary" to="/operador">
                Ir para painel interno
              </Link>
            </div>
          </form>
          <p className="table-note">
            Primeiro acesso: use o CPF cadastrado pelo operador e a senha temporária <strong>0000</strong>.
          </p>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        {access?.mustChangePin ? (
          <article className="public-card">
            <div className="eyebrow">
              <KeyRound size={16} />
              Primeiro acesso
            </div>
            <h2>Cadastre seu novo PIN numérico</h2>
            <p>
              {access.patientName}, para proteger seu acompanhamento, troque agora a senha
              temporária {access.temporaryPasswordLabel} por um PIN de 4 dígitos.
            </p>
            <form onSubmit={handleActivatePin}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="new-pin">Novo PIN de 4 dígitos</label>
                  <input
                    id="new-pin"
                    value={newPin}
                    onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    placeholder="1234"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={loading || newPin.length !== 4} type="submit">
                  {loading ? 'Ativando...' : 'Salvar novo PIN'}
                </button>
              </div>
            </form>
          </article>
        ) : null}

        {request ? (
          <>
            <article className="request-card">
              <div className="status-pill-row">
                <span className={`status-badge ${request.status}`}>{request.statusLabel}</span>
                <span className="status-pill">Protocolo {request.protocol}</span>
                {access ? <span className="status-pill">CPF {access.cpfMasked}</span> : null}
              </div>
              <h2>{request.patientName}</h2>
              <dl className="request-summary">
                <div>
                  <dt>Destino</dt>
                  <dd>
                    {request.destinationCity}/{request.destinationState}
                  </dd>
                </div>
                <div>
                  <dt>Unidade</dt>
                  <dd>{request.treatmentUnit}</dd>
                </div>
                <div>
                  <dt>Especialidade</dt>
                  <dd>{request.specialty}</dd>
                </div>
                <div>
                  <dt>Data prevista</dt>
                  <dd>{request.travelDate}</dd>
                </div>
                <div>
                  <dt>Acompanhante</dt>
                  <dd>{request.companionRequired ? 'Necessario' : 'Nao necessario'}</dd>
                </div>
                <div>
                  <dt>Orientacao</dt>
                  <dd>{request.loginHint}</dd>
                </div>
              </dl>
            </article>

            <article className="public-card">
              <h2>Historico recente</h2>
              <ol className="status-history">
                {request.history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong> em {entry.updatedAt}
                    {entry.note ? ` - ${entry.note}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          </>
        ) : (
          <article className="empty-state">
            <Search size={28} />
            <h2>Acesso cidadão pronto para uso</h2>
            <p>
              O layout já está preparado para o cidadão acessar com CPF e senha temporária 0000 no
              primeiro login, trocando em seguida para um PIN de 4 dígitos.
            </p>
          </article>
        )}
      </div>
    </div>
  )
}
