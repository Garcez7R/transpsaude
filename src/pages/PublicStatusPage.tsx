import { Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicRequest } from '../lib/api'
import type { PublicRequestDetails } from '../types'

export function PublicStatusPage() {
  const [protocol, setProtocol] = useState('TS-2026-000124')
  const [pin, setPin] = useState('4821')
  const [request, setRequest] = useState<PublicRequestDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await fetchPublicRequest(protocol, pin)
      setRequest(data)
    } catch {
      setRequest(null)
      setError('Nao encontramos uma solicitacao com esse protocolo e PIN.')
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
          <strong>Consulta publica municipal</strong>
          <span>Acompanhamento de solicitacoes de transporte para tratamento</span>
        </div>
      </section>

      <header className="public-header">
        <div className="eyebrow">
          <ShieldCheck size={16} />
          Consulta do cidadao
        </div>
        <h1>Acompanhe sua solicitacao de viagem</h1>
        <p>
          Informe o protocolo entregue no atendimento e o PIN de consulta. Esse fluxo pode virar o
          PWA oficial da prefeitura no celular.
        </p>
      </header>

      <div className="public-layout">
        <article className="public-card">
          <h2>Consultar status</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="protocol">Protocolo</label>
                <input
                  id="protocol"
                  value={protocol}
                  onChange={(event) => setProtocol(event.target.value)}
                  placeholder="TS-2026-000124"
                />
              </div>
              <div className="field">
                <label htmlFor="pin">PIN</label>
                <input
                  id="pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  inputMode="numeric"
                  placeholder="4821"
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="action-button primary" disabled={loading} type="submit">
                <Search size={16} />
                {loading ? 'Consultando...' : 'Consultar solicitacao'}
              </button>
              <Link className="action-button secondary" to="/operador">
                Ir para painel interno
              </Link>
            </div>
          </form>
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        {request ? (
          <>
            <article className="request-card">
              <div className="status-pill-row">
                <span className={`status-badge ${request.status}`}>{request.statusLabel}</span>
                <span className="status-pill">Protocolo {request.protocol}</span>
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
                  <dd>{request.protocolPinHint}</dd>
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
            <h2>Consulta pronta para uso</h2>
            <p>
              O layout ja esta preparado para virar PWA. No MVP, o acesso pode ser so por protocolo
              e PIN, sem exigir conta do cidadao.
            </p>
          </article>
        )}
      </div>
    </div>
  )
}
