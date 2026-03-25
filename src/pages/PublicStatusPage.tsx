import { CalendarClock, Copy, KeyRound, Phone, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { institutionContact } from '../config/institution'
import { activateCitizenPin, confirmCitizenRequest, createCitizenRequestMessage, loginCitizen, markCitizenRequestViewed } from '../lib/api'
import { toInstitutionalText } from '../lib/text-format'
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

function formatDisplayTime(value?: string) {
  return value || 'A definir'
}

function formatDisplayTimestamp(value?: string | null) {
  if (!value) {
    return ''
  }

  const normalized = value.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)

  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]} às ${match[4]}:${match[5]}`
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
    .replace(
      /^viagem direcionada para .* consulta às (.+) e saída prevista às (.+)\.?$/i,
      'Consulta prevista para $1 e saída organizada para $2.',
    )
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

function getGreetingName(value?: string | null) {
  return isMeaningfulValue(value) ? String(value).trim() : ''
}

const statusSupportText: Record<PublicRequestDetails['status'], string> = {
  recebida: 'Sua solicitação foi registrada pela equipe e aguarda os próximos encaminhamentos.',
  em_analise: 'A equipe está conferindo os dados e a necessidade do transporte.',
  aguardando_documentos: 'Ainda faltam documentos ou informações para concluir a análise.',
  aprovada: 'A solicitação foi aprovada e aguarda a organização final da viagem.',
  agendada: 'Sua viagem já está organizada e disponível para acompanhamento.',
  cancelada: 'Esta solicitação foi cancelada. Em caso de dúvida, procure a equipe responsável.',
  concluida: 'Esta viagem já foi concluída.',
}

export function PublicStatusPage() {
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [access, setAccess] = useState<CitizenAccessResponse | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmingRequest, setConfirmingRequest] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [citizenMessageTitle, setCitizenMessageTitle] = useState('')
  const [citizenMessageBody, setCitizenMessageBody] = useState('')

  const requests = useMemo(
    () =>
      [...(access?.requests ?? [])].sort((left, right) => {
        const leftKey = `${left.travelDate ?? ''} ${left.departureTime ?? ''}`.trim()
        const rightKey = `${right.travelDate ?? ''} ${right.departureTime ?? ''}`.trim()
        return rightKey.localeCompare(leftKey)
      }),
    [access?.requests],
  )
  const request =
    requests.find((entry) => entry.id === selectedRequestId) ??
    access?.request ??
    null
  const greetingName = getGreetingName(access?.patientName || request?.patientName)
  const driverPhoneVisible =
    !!request?.showDriverPhoneToPatient &&
    isMeaningfulValue(request?.assignedDriverPhone)
  const latestTeamMessage = request?.messages.find((entry) => entry.createdByRole !== 'patient') ?? null

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

  async function handleCitizenMessageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!request) {
      return
    }

    setSendingMessage(true)
    setError('')
    setMessage('')

    try {
      const result = await createCitizenRequestMessage({
        cpf,
        password,
        requestId: request.id,
        title: citizenMessageTitle,
        body: citizenMessageBody,
      })

      const refreshed = await loginCitizen(cpf, password)
      setAccess(refreshed)
      setSelectedRequestId(request.id)
      setCitizenMessageTitle('')
      setCitizenMessageBody('')
      setMessage(result.message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem para a equipe.')
    } finally {
      setSendingMessage(false)
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

  async function handleCopyDriverPhone() {
    if (!request?.assignedDriverPhone || typeof navigator === 'undefined' || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(request.assignedDriverPhone)
    setCopyMessage('Telefone do motorista copiado.')
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
            {requests.length > 0 ? (
              <article className="public-card">
                <h2>{greetingName ? `Olá, ${greetingName}.` : 'Seus agendamentos de transporte em saúde'}</h2>
                <p className="table-note">Selecione abaixo a agenda que deseja consultar.</p>
                <div className="request-list scroll-list">
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
                      {entry.appointmentTime ? <span>Consulta às {entry.appointmentTime}</span> : null}
                      <span>{getDisplayValue(`${entry.destinationCity}/${entry.destinationState}`, 'Destino a definir')}</span>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            <article className="request-card">
              <div className="status-pill-row">
                <span className={`status-badge ${request.status}`}>{request.statusLabel}</span>
                <span className="status-pill">Protocolo {request.protocol}</span>
              </div>
              <h2>Organização da viagem</h2>
              <div className="travel-overview-grid">
                <article className="travel-overview-card">
                  <span>Embarque</span>
                  <strong>{getBoardingLocation(request)}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Motorista</span>
                  <strong>{getDisplayValue(request.assignedDriverName, 'A definir')}</strong>
                </article>
                <article className="travel-overview-card">
                  <span>Telefone do motorista</span>
                  <strong>
                    {request.showDriverPhoneToPatient && request.assignedDriverPhone
                      ? request.assignedDriverPhone
                      : 'Contato não liberado'}
                  </strong>
                </article>
                <article className="travel-overview-card">
                  <span>Veículo da viagem</span>
                  <strong>{request.assignedVehicleName || 'A definir'}</strong>
                </article>
              </div>

              <div className="request-section-stack">
                <section className="detail-section-card">
                  <h3>Informações principais</h3>
                  <dl className="request-summary">
                    <div>
                      <dt>Data prevista</dt>
                      <dd>{formatDisplayDate(request.travelDate)}</dd>
                    </div>
                    <div>
                      <dt>Horário da consulta</dt>
                      <dd>{formatDisplayTime(request.appointmentTime)}</dd>
                    </div>
                    <div>
                      <dt>Horário de saída</dt>
                      <dd>{request.departureTime || 'A definir'}</dd>
                    </div>
                    <div>
                      <dt>Acompanhante</dt>
                      <dd>{request.companionRequired ? 'Necessário' : 'Não necessário'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="detail-section-card">
                  <h3>Dados do atendimento</h3>
                  <dl className="request-summary">
                    {isMeaningfulValue(request.patientName) ? (
                      <div>
                        <dt>Paciente</dt>
                        <dd>{request.patientName}</dd>
                      </div>
                    ) : null}
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
                  </dl>
                </section>
              </div>
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
                Resumo da viagem
              </div>
              <h2>{formatDisplayDateTime(request.travelDate, request.departureTime)}</h2>
              <p>
                Consulta:
                {' '}
                <strong>{formatDisplayTime(request.appointmentTime)}</strong>.
              </p>
              <p>
                Embarque:
                {' '}
                <strong>{getBoardingLocation(request)}</strong>.
              </p>
              <div className="travel-actions">
                {isMeaningfulValue(request.boardingLocationLabel || request.addressLine) ? (
                  <a className="action-button secondary" href={buildMapsUrl(getBoardingLocation(request))} rel="noreferrer" target="_blank">
                    Abrir no mapa
                  </a>
                ) : null}
                {driverPhoneVisible ? (
                  <a className="action-button secondary" href={`tel:${String(request.assignedDriverPhone).replace(/\D/g, '')}`}>
                    <Phone size={16} />
                    Ligar para o motorista
                  </a>
                ) : null}
                {request.messages.length > 0 ? (
                  <a className="action-button secondary" href="#orientacoes-equipe">
                    Ver mensagens
                  </a>
                ) : null}
                <a className="action-button secondary" href="#mensagens-equipe">
                  Falar com a equipe
                </a>
                {driverPhoneVisible ? (
                  <button className="action-button secondary" type="button" onClick={() => void handleCopyDriverPhone()}>
                    <Copy size={16} />
                    Copiar telefone
                  </button>
                ) : null}
              </div>
              {copyMessage ? <p className="table-note">{copyMessage}</p> : null}
            </article>

            <article className="public-card public-status-card">
              <div className="eyebrow">
                <CalendarClock size={16} />
                Situação da viagem
              </div>
              <h2>{request.statusLabel}</h2>
              <p>{statusSupportText[request.status]}</p>
            </article>

            {latestTeamMessage ? (
              <article className="public-card message-highlight">
                <div className="eyebrow">
                  <ShieldCheck size={16} />
                  Nova orientação da equipe
                </div>
                <h2>{latestTeamMessage.title || 'Atualização da solicitação'}</h2>
                <p>{latestTeamMessage.body}</p>
              </article>
            ) : null}

            <article className="public-card" id="orientacoes-equipe">
              <h2>Orientações da equipe</h2>
              {request.messages.length > 0 ? (
                <ol className="status-history">
                  {request.messages.map((entry) => (
                    <li key={`public-message-${entry.id}`}>
                      <strong>{entry.title || 'Atualização da solicitação'}</strong> em {formatDisplayTimestamp(entry.createdAt)}
                      {' '}por {entry.createdByRole === 'patient' ? 'você' : entry.createdByName}
                      <br />
                      {entry.body}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="table-note">No momento, não há novas orientações para esta viagem.</p>
              )}
            </article>

            <article className="public-card" id="mensagens-equipe">
              <h2>Enviar mensagem para a equipe</h2>
              <p className="table-note">Use este espaço para informar dúvida, alteração ou dificuldade relacionada a esta agenda.</p>
              <form onSubmit={handleCitizenMessageSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="citizen-message-title">Assunto</label>
                    <input
                      id="citizen-message-title"
                      value={citizenMessageTitle}
                      onChange={(event) => setCitizenMessageTitle(toInstitutionalText(event.target.value))}
                      placeholder="Ex.: Dúvida sobre horário"
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor="citizen-message-body">Mensagem</label>
                    <textarea
                      id="citizen-message-body"
                      rows={4}
                      value={citizenMessageBody}
                      onChange={(event) => setCitizenMessageBody(toInstitutionalText(event.target.value))}
                      placeholder="Descreva o que você precisa informar para a equipe."
                      required
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="action-button primary" disabled={sendingMessage || !citizenMessageBody.trim()} type="submit">
                    {sendingMessage ? 'Enviando...' : 'Enviar mensagem'}
                  </button>
                </div>
              </form>
            </article>

            <article className="public-card">
              <h2>Acompanhamento</h2>
              <ol className="status-history">
                {request.history.map((entry) => (
                  <li key={`${entry.status}-${entry.updatedAt}`}>
                    <strong>{entry.label}</strong> em {formatDisplayTimestamp(entry.updatedAt)}
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
            <p>Depois do atendimento presencial, esta área passa a mostrar suas agendas, orientações da equipe e dados da viagem.</p>
            <p className="table-note">Se precisar de ajuda, procure a equipe responsável pelo transporte em saúde.</p>
          </article>
        )}

        <article className="public-card public-privacy-card">
          <h2>Contato da secretaria</h2>
          <p>
            Em caso de dúvida, alteração importante ou impossibilidade de comparecimento,
            procure a equipe responsável pelo transporte em saúde.
          </p>
          <ul className="check-list compact-list">
            <li>Telefone institucional: {institutionContact.phone || 'A definir pela prefeitura'}</li>
            <li>WhatsApp institucional: {institutionContact.whatsapp || 'A definir pela prefeitura'}</li>
            <li>Horário de atendimento: {institutionContact.hours}</li>
          </ul>
        </article>

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
