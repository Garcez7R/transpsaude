import { KeyRound, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { activateCitizenPin, loginCitizen } from '../lib/api'
import type { CitizenAccessResponse } from '../types'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function PublicStatusPage() {
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [access, setAccess] = useState<CitizenAccessResponse | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requests = access?.requests ?? []
  const request =
    requests.find((entry) => entry.id === selectedRequestId) ??
    access?.request ??
    null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await loginCitizen(cpf, password)
      setAccess(data)
      setSelectedRequestId(data.request?.id ?? data.requests[0]?.id ?? null)
    } catch {
      setAccess(null)
      setSelectedRequestId(null)
      setError('Não foi possível localizar um acesso válido com o CPF e o PIN informados.')
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
      setSelectedRequestId(data.request?.id ?? data.requests[0]?.id ?? null)
      setPassword(newPin)
      setNewPin('')
    } catch {
      setError('Não foi possível concluir o cadastro do novo PIN. Verifique se ele possui 4 dígitos numéricos.')
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
          <strong>Prefeitura Municipal de Capão do Leão</strong>
          <span>Acompanhamento de solicitações de transporte em saúde</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Área do cidadão
        </div>
        <h1>Consultar solicitação de transporte</h1>
        <p>
          Informe seu CPF e o PIN de acesso. No primeiro acesso, utilize a senha temporária
          <strong> 0000 </strong>
          e cadastre, em seguida, um PIN numérico de 4 dígitos para consultas futuras.
        </p>
      </header>

      <div className="public-layout">
        <article className="public-card">
          <h2>Entrar para acompanhar</h2>
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
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="password">PIN de acesso</label>
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
                {loading ? 'Validando acesso...' : 'Consultar solicitação'}
              </button>
            </div>
          </form>
          <p className="table-note">
            Recomendamos consultar esta tela algumas horas antes da viagem para confirmar horário,
            local de embarque e eventuais atualizações.
          </p>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        {access?.mustChangePin ? (
          <article className="public-card">
            <div className="eyebrow">
              <KeyRound size={16} />
              Ativação de acesso
            </div>
            <h2>Cadastrar novo PIN</h2>
            <p>
              {access.patientName}, para maior segurança, substitua agora a senha temporária
              {' '}
              <strong>{access.temporaryPasswordLabel}</strong>
              {' '}
              por um PIN numérico de 4 dígitos.
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
                    autoFocus
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="action-button primary" disabled={loading || newPin.length !== 4} type="submit">
                  {loading ? 'Salvando novo PIN...' : 'Confirmar novo PIN'}
                </button>
              </div>
            </form>
          </article>
        ) : null}

        {request ? (
          <>
            {requests.length > 1 ? (
              <article className="public-card">
                <h2>Solicitações vinculadas a este acesso</h2>
                <div className="request-list">
                  {requests.map((entry) => (
                    <button
                      key={entry.id}
                      className={`request-list-item ${entry.id === request.id ? 'active' : ''}`}
                      onClick={() => setSelectedRequestId(entry.id)}
                      type="button"
                    >
                      <span className={`status-badge ${entry.status}`}>{entry.statusLabel}</span>
                      <strong>{entry.protocol}</strong>
                      <span>
                        {entry.travelDate}
                        {entry.departureTime ? ` às ${entry.departureTime}` : ''}
                      </span>
                      <span>
                        {entry.destinationCity}/{entry.destinationState}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            <article className="public-card departure-highlight">
              <div className="eyebrow">
                <ShieldCheck size={16} />
                Informações principais
              </div>
              <h2>
                {request.travelDate || 'Data a definir'} {request.departureTime ? `às ${request.departureTime}` : ''}
              </h2>
              <p>
                Local de embarque:
                {' '}
                <strong>{request.boardingLocationLabel || request.addressLine || 'a definir'}</strong>.
              </p>
            </article>

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
                  <dt>Horário de saída</dt>
                  <dd>{request.departureTime || 'A definir'}</dd>
                </div>
                <div>
                  <dt>Local de embarque</dt>
                  <dd>{request.boardingLocationLabel || request.addressLine || 'A definir'}</dd>
                </div>
                <div>
                  <dt>Acompanhante</dt>
                  <dd>{request.companionRequired ? 'Necessário' : 'Não necessário'}</dd>
                </div>
                <div>
                  <dt>Motorista responsável</dt>
                  <dd>{request.assignedDriverName || 'A definir'}</dd>
                </div>
                <div>
                  <dt>Orientações</dt>
                  <dd>{request.loginHint}</dd>
                </div>
              </dl>
            </article>

            <article className="public-card">
              <h2>Mensagens e orientações</h2>
              {request.messages.length > 0 ? (
                <ol className="status-history">
                  {request.messages.map((entry) => (
                    <li key={`public-message-${entry.id}`}>
                      <strong>{entry.title || 'Atualização da solicitação'}</strong> em {entry.createdAt}
                      <br />
                      {entry.body}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="table-note">Não há novas orientações registradas para esta solicitação.</p>
              )}
            </article>

            <article className="public-card">
              <h2>Histórico da solicitação</h2>
              <ol className="status-history">
                {request.history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong>
                    {' '}
                    em
                    {' '}
                    {entry.updatedAt}
                    {entry.note ? ` - ${entry.note}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          </>
        ) : (
          <article className="empty-state">
            <Search size={28} />
            <h2>Nenhuma consulta realizada</h2>
            <p>
              Após o atendimento presencial e o registro da solicitação pela equipe da prefeitura,
              utilize esta área para acompanhar o andamento do transporte em saúde.
            </p>
          </article>
        )}

        <article className="public-card">
          <h2>Privacidade e uso das informações</h2>
          <p>
            Os dados informados nesta consulta são utilizados exclusivamente para o acompanhamento
            da solicitação de transporte em saúde, em ambiente institucional da Prefeitura
            Municipal de Capão do Leão.
          </p>
          <p className="table-note">
            O tratamento das informações observa os princípios da Lei Geral de Proteção de Dados
            Pessoais (LGPD) e as garantias aplicáveis do Marco Civil da Internet, com acesso
            restrito às finalidades administrativas e assistenciais do serviço.
          </p>
        </article>
      </div>
    </div>
  )
}
