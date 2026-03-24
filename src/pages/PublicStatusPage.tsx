import { KeyRound, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { activateCitizenPin, confirmCitizenRequest, loginCitizen, markCitizenRequestViewed } from '../lib/api'
import type { CitizenAccessResponse, PublicRequestDetails } from '../types'

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function hasVisibleUpdate(request: PublicRequestDetails) {
  if (request.messages.length > 0) {
    return true
  }

  return request.history.some((entry) => {
    const text = `${entry.label} ${entry.note ?? ''}`.toLowerCase()
    return (
      text.includes('reagendada') ||
      text.includes('direcionada para') ||
      text.includes('saída prevista') ||
      text.includes('embarque') ||
      text.includes('alter')
    )
  })
}

function getUpdateSummary(request: PublicRequestDetails) {
  const latestMessage = request.messages[0]

  if (latestMessage) {
    return latestMessage.title || latestMessage.body
  }

  const latestHistory = [...request.history].reverse().find((entry) => {
    const text = `${entry.label} ${entry.note ?? ''}`.toLowerCase()
    return (
      text.includes('reagendada') ||
      text.includes('direcionada para') ||
      text.includes('saída prevista') ||
      text.includes('embarque') ||
      text.includes('alter')
    )
  })

  if (!latestHistory) {
    return ''
  }

  return latestHistory.note || latestHistory.label
}

function formatDisplayDate(value?: string) {
  if (!value) {
    return 'A definir'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatDisplayDateTime(date?: string, time?: string) {
  const formattedDate = formatDisplayDate(date)

  if (!time) {
    return formattedDate
  }

  return `${formattedDate} às ${time}`
}

function formatCitizenHistory(entry: PublicRequestDetails['history'][number]) {
  const note = entry.note?.trim()

  if (!note) {
    return ''
  }

  return note
    .replace(/^solicitacao cadastrada pelo painel interno\.?$/i, 'Solicitação registrada pela equipe responsável.')
    .replace(/^viagem direcionada para .* com saida prevista as (.+)\.?$/i, 'Motorista definido e saída prevista para $1.')
    .replace(/^viagem direcionada para .* com saída prevista às (.+)\.?$/i, 'Motorista definido e saída prevista para $1.')
}

function isMeaningfulValue(value?: string | null) {
  const text = String(value ?? '').trim()

  if (!text) {
    return false
  }

  if (/^\d{1,2}$/.test(text)) {
    return false
  }

  return true
}

function getDisplayValue(value?: string | null, fallback = 'Não informado') {
  return isMeaningfulValue(value) ? String(value).trim() : fallback
}

function getBoardingLocation(request: PublicRequestDetails) {
  return getDisplayValue(request.boardingLocationLabel || request.addressLine, 'A definir')
}

function buildMapsUrl(label: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}

export function PublicStatusPage() {
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [access, setAccess] = useState<CitizenAccessResponse | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmingRequest, setConfirmingRequest] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const requests = access?.requests ?? []
  const request =
    requests.find((entry) => entry.id === selectedRequestId) ??
    access?.request ??
    null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

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
    setMessage('')

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

  async function handleConfirmRequest() {
    if (!request) {
      return
    }

    setConfirmingRequest(true)
    setError('')
    setMessage('')

    try {
      const data = await confirmCitizenRequest(cpf, password, request.id)
      setAccess(data)
      setSelectedRequestId(request.id)
      setMessage(data.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível confirmar esta agenda.')
    } finally {
      setConfirmingRequest(false)
    }
  }

  useEffect(() => {
    if (!request || !cpf || !password || access?.mustChangePin) {
      return
    }

    void markCitizenRequestViewed(cpf, password, request.id).catch(() => {
      // O acompanhamento continua funcionando mesmo sem o registro de leitura.
    })
  }, [access?.mustChangePin, cpf, password, request])

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
          Transporte em saúde
        </div>
        <h1>Consultar minha solicitação</h1>
        <p>Informe CPF e PIN para acompanhar data, horário, local de embarque e eventuais atualizações.</p>
      </header>

      <div className="public-layout">
        <article className="public-card public-access-card">
          <div className="public-access-copy">
            <h2>Acesso ao acompanhamento</h2>
            <p>Use o CPF informado no atendimento e o PIN de acesso para consultar suas solicitações registradas.</p>
          </div>
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
                {loading ? 'Validando acesso...' : 'Consultar'}
              </button>
            </div>
          </form>
          <p className="public-helper-text">Primeiro acesso: utilize a senha temporária 0000 e depois cadastre um novo PIN numérico de 4 dígitos.</p>
          {message ? <p className="table-note">{message}</p> : null}
          {error ? <p className="table-note">{error}</p> : null}
        </article>

        <article className="public-card public-info-card">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Aviso importante
          </div>
          <h2>Confirme os dados antes da viagem</h2>
          <p>Consulte novamente esta tela algumas horas antes da saída para verificar horário, local de embarque e novas orientações.</p>
        </article>

        {access?.mustChangePin ? (
          <article className="public-card public-activation-card">
            <div className="eyebrow">
              <KeyRound size={16} />
              Primeiro acesso
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
            <article className="public-card public-greeting-card">
              <h2>Olá, {getDisplayValue(access?.patientName || request.patientName)}.</h2>
              <p>Confira abaixo seus agendamentos de transporte em saúde.</p>
            </article>

            {requests.length > 1 ? (
              <article className="public-card">
                <h2>Solicitações vinculadas a este acesso</h2>
                <p className="table-note">Selecione abaixo a agenda que deseja consultar.</p>
                <div className="request-list">
                  {requests.map((entry) => (
                    <button
                      key={entry.id}
                      className={`request-list-item ${entry.id === request.id ? 'active' : ''}`}
                      onClick={() => setSelectedRequestId(entry.id)}
                      type="button"
                    >
                      <div className="request-list-header">
                        <span className={`status-badge ${entry.status}`}>{entry.statusLabel}</span>
                        <div className="request-list-flags">
                          {entry.patientConfirmedAt ? <span className="confirmed-badge">Confirmada</span> : null}
                          {hasVisibleUpdate(entry) ? <span className="update-badge">Atualizada</span> : null}
                        </div>
                      </div>
                      <strong>{entry.protocol}</strong>
                      <span>{formatDisplayDateTime(entry.travelDate, entry.departureTime)}</span>
                      <span>{getDisplayValue(`${entry.destinationCity}/${entry.destinationState}`, 'Destino a definir')}</span>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {hasVisibleUpdate(request) ? (
              <article className="public-card update-highlight">
                <div className="eyebrow">
                  <ShieldCheck size={16} />
                  Atualização da solicitação
                </div>
                <h2>Há uma atualização importante neste agendamento</h2>
                <p>{getUpdateSummary(request)}</p>
              </article>
            ) : null}

            <article className="public-card departure-highlight">
              <div className="eyebrow">
                <ShieldCheck size={16} />
                Saída prevista
              </div>
              <h2>{formatDisplayDateTime(request.travelDate, request.departureTime)}</h2>
              <p>
                Embarque:
                {' '}
                <strong>{getBoardingLocation(request)}</strong>.
              </p>
              {isMeaningfulValue(request.boardingLocationLabel || request.addressLine) ? (
                <div className="form-actions">
                  <a className="action-button secondary" href={buildMapsUrl(getBoardingLocation(request))} rel="noreferrer" target="_blank">
                    Abrir no mapa
                  </a>
                </div>
              ) : null}
            </article>

            <article className={`public-card ${request.patientConfirmedAt ? 'confirmation-highlight' : ''}`}>
              <div className="eyebrow">
                <ShieldCheck size={16} />
                Confirmação da agenda
              </div>
              <h2>{request.patientConfirmedAt ? 'Agenda já confirmada' : 'Confirme o recebimento desta agenda'}</h2>
              <p>
                {request.patientConfirmedAt
                  ? `Confirmação registrada em ${request.patientConfirmedAt}.`
                  : 'Se os dados estiverem corretos, confirme o recebimento para ajudar a equipe a acompanhar sua programação.'}
              </p>
              {!request.patientConfirmedAt ? (
                <div className="form-actions">
                  <button className="action-button primary" disabled={confirmingRequest} onClick={handleConfirmRequest} type="button">
                    {confirmingRequest ? 'Confirmando...' : 'Confirmar recebimento da agenda'}
                  </button>
                </div>
              ) : null}
            </article>

            <article className="request-card">
              <div className="status-pill-row">
                <span className={`status-badge ${request.status}`}>{request.statusLabel}</span>
                <span className="status-pill">Protocolo {request.protocol}</span>
              </div>
              <h2>Detalhes da viagem</h2>
              <dl className="request-summary">
                <div>
                  <dt>Paciente</dt>
                  <dd>{getDisplayValue(request.patientName)}</dd>
                </div>
                <div>
                  <dt>CPF de acesso</dt>
                  <dd>{access?.cpfMasked ?? request.accessCpfMasked ?? 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>{getDisplayValue(`${request.destinationCity}/${request.destinationState}`, 'Destino a definir')}</dd>
                </div>
                {isMeaningfulValue(request.treatmentUnit) ? (
                  <div>
                    <dt>Unidade</dt>
                    <dd>{request.treatmentUnit}</dd>
                  </div>
                ) : null}
                {isMeaningfulValue(request.specialty) ? (
                  <div>
                    <dt>Especialidade</dt>
                    <dd>{request.specialty}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Data prevista</dt>
                  <dd>{formatDisplayDate(request.travelDate)}</dd>
                </div>
                <div>
                  <dt>Horário de saída</dt>
                  <dd>{request.departureTime || 'A definir'}</dd>
                </div>
                <div>
                  <dt>Local de embarque</dt>
                  <dd>{getBoardingLocation(request)}</dd>
                </div>
                <div>
                  <dt>Acompanhante</dt>
                  <dd>{request.companionRequired ? 'Necessário' : 'Não necessário'}</dd>
                </div>
                <div>
                  <dt>Motorista responsável</dt>
                  <dd>{getDisplayValue(request.assignedDriverName, 'A definir')}</dd>
                </div>
                <div>
                  <dt>Telefone do motorista</dt>
                  <dd>
                    {request.showDriverPhoneToPatient && request.assignedDriverPhone
                      ? request.assignedDriverPhone
                      : 'Não informado'}
                  </dd>
                </div>
                <div>
                  <dt>Veículo da viagem</dt>
                  <dd>{request.assignedVehicleName || 'A definir'}</dd>
                </div>
              </dl>
            </article>

            <article className="public-card">
              <h2>Orientações da equipe</h2>
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
                <p className="table-note">No momento, não há novas orientações para esta viagem.</p>
              )}
            </article>

            <article className="public-card">
              <h2>Acompanhamento</h2>
              <ol className="status-history">
                {request.history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong> em {entry.updatedAt}
                    {formatCitizenHistory(entry) ? ` - ${formatCitizenHistory(entry)}` : ''}
                  </li>
                ))}
              </ol>
            </article>
          </>
        ) : (
          <article className="empty-state">
            <Search size={28} />
            <h2>Nenhuma consulta realizada ainda</h2>
            <p>Após o atendimento presencial, utilize esta área para acompanhar suas solicitações de transporte em saúde.</p>
          </article>
        )}

        <article className="public-card public-privacy-card">
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
