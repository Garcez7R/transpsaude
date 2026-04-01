import { ArrowLeft, FilePlus2, Route, Search, ShieldCheck, UserRoundSearch, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InternalSidebar } from '../components/InternalSidebar'
import { canAccessOperator, getInternalRoleLabel } from '../lib/access'
import { fetchPatients, logoutSession } from '../lib/api'
import { clearAdminSession, getAdminSession } from '../lib/admin-session'
import { clearAdminAreaSession } from '../lib/admin-area-session'
import { clearManagerSession, getManagerSession } from '../lib/manager-session'
import { clearOperatorSession, getOperatorSession } from '../lib/operator-session'
import { toInstitutionalText } from '../lib/text-format'
import type { AdminSession, PatientRecord } from '../types'

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function getSessionContext() {
  const adminSession = typeof window !== 'undefined' ? getAdminSession() : null
  const managerSession = typeof window !== 'undefined' ? getManagerSession() : null
  const operatorSession = typeof window !== 'undefined' ? getOperatorSession() : null

  const internalSession = adminSession ?? managerSession

  if (internalSession && canAccessOperator(internalSession)) {
    return {
      session: internalSession,
      accessMode: 'internal' as const,
      backTo: internalSession.role === 'admin' ? '/admin' : '/gerente',
    }
  }

  if (operatorSession && canAccessOperator(operatorSession)) {
    return {
      session: operatorSession,
      accessMode: 'operator' as const,
      backTo: '/operador',
    }
  }

  return {
    session: null as AdminSession | null,
    accessMode: 'operator' as const,
    backTo: '/operador',
  }
}

export function PatientsDirectoryPage() {
  const [sessionContext, setSessionContext] = useState(() => getSessionContext())
  const { session, accessMode, backTo } = sessionContext
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [addressFilter, setAddressFilter] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [whatsappOnly, setWhatsappOnly] = useState(false)
  const [responsibleOnly, setResponsibleOnly] = useState(false)

  useEffect(() => {
    if (!session) {
      return
    }

    let active = true

    async function loadPatientsDirectory() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchPatients(accessMode)

        if (active) {
          setPatients(data)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a base de pacientes.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadPatientsDirectory()

    return () => {
      active = false
    }
  }, [accessMode, session])

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const generalSearch = normalizeText(search)
      const patientText = normalizeText(
        [
          patient.fullName,
          patient.cpfMasked,
          patient.accessCpfMasked,
          patient.phone,
          patient.addressLine,
          patient.responsibleName,
          patient.responsibleCpfMasked,
          patient.cns,
        ]
          .filter(Boolean)
          .join(' '),
      )

      if (generalSearch) {
        const matchesText = patientText.includes(generalSearch)
        const matchesDigits = normalizeDigits(
          [patient.cpfMasked, patient.accessCpfMasked, patient.phone, patient.responsibleCpfMasked]
            .filter(Boolean)
            .join(' '),
        ).includes(normalizeDigits(search))

        if (!matchesText && !matchesDigits) {
          return false
        }
      }

      if (phoneFilter && !normalizeDigits(patient.phone).includes(normalizeDigits(phoneFilter))) {
        return false
      }

      if (addressFilter && !normalizeText(patient.addressLine).includes(normalizeText(addressFilter))) {
        return false
      }

      if (responsibleFilter) {
        const responsibleText = normalizeText(`${patient.responsibleName ?? ''} ${patient.responsibleCpfMasked ?? ''}`)
        if (!responsibleText.includes(normalizeText(responsibleFilter))) {
          return false
        }
      }

      if (whatsappOnly && !patient.isWhatsapp) {
        return false
      }

      if (responsibleOnly && !patient.useResponsibleCpfForAccess) {
        return false
      }

      return true
    })
  }, [addressFilter, patients, phoneFilter, responsibleFilter, responsibleOnly, search, whatsappOnly])

  const withResponsibleCount = patients.filter((patient) => patient.useResponsibleCpfForAccess).length
  const withWhatsappCount = patients.filter((patient) => patient.isWhatsapp).length

  async function handleLogout() {
    if (session?.token) {
      try {
        await logoutSession(session.token)
      } catch {
        // A limpeza local continua mesmo se a API não responder.
      }
    }

    clearOperatorSession()
    clearManagerSession()
    clearAdminAreaSession()
    clearAdminSession()
    setSessionContext({ session: null, accessMode: 'operator', backTo: '/operador' })
  }

  if (!session || !canAccessOperator(session)) {
    return (
      <div className="dashboard-shell internal-shell">
        <section className="institutional-bar institutional-bar-inner">
          <div className="crest-mark" aria-hidden="true">
            <span />
          </div>
          <div className="institutional-copy">
            <strong>Base de pacientes</strong>
            <span>Consulta interna do transporte em saúde</span>
          </div>
        </section>

        <article className="content-card">
          <h2>Sessão interna necessária</h2>
          <p>Entre primeiro em uma área interna autorizada para consultar a base de pacientes.</p>
          <div className="form-actions">
            <Link className="action-button primary" to="/operador">
              Ir para o operador
            </Link>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="dashboard-shell internal-shell">
      <div className="saas-app-shell">
        <InternalSidebar
          actions={
            <>
              <Link className="action-button secondary" to={backTo}>
                <ArrowLeft size={16} />
                Voltar
              </Link>
              <Link className="action-button primary" to="/operador/cadastro">
                <FilePlus2 size={16} />
                Nova solicitação
              </Link>
              <button className="action-button secondary" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          }
          items={[
            { to: backTo, label: backTo === '/gerente' || backTo === '/admin' ? 'Painel principal' : 'Operador', icon: ArrowLeft, exact: true },
            { to: '/operador/pacientes', label: 'Base de pacientes', icon: UserRoundSearch, exact: true },
            { to: '/operador/cadastro', label: 'Nova solicitação', icon: FilePlus2 },
            ...(session.role === 'manager' || session.role === 'admin'
              ? [{ to: '/gerente', label: 'Gerência', icon: Route }]
              : []),
            ...(session.role === 'manager' || session.role === 'admin'
              ? [{ to: '/gerente/equipe', label: 'Equipe e veículos', icon: Users }]
              : []),
            ...(session.role === 'admin'
              ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }]
              : []),
          ]}
          sessionName={session.name}
          sessionRole={getInternalRoleLabel(session.role)}
          subtitle="Consulta refinada e auditoria de cadastros internos"
          title="Base de pacientes"
        />

        <main className="saas-main saas-main--directory">
          <header className="topbar">
            <div className="page-title-block">
              <div className="eyebrow">
                <UserRoundSearch size={16} />
                Base de pacientes
              </div>
              <h1>Consulta e auditoria de cadastros</h1>
              <p>Localize rapidamente pacientes por nome, CPF, telefone, endereço e dados do responsável.</p>
            </div>

            <div className="page-actions">
              <Link className="action-button secondary" to={backTo}>
                <ArrowLeft size={16} />
                Voltar
              </Link>
              <Link className="action-button primary" to="/operador/cadastro">
                Nova solicitação
              </Link>
            </div>
          </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <strong>{patients.length}</strong>
          <p>pacientes na base</p>
        </article>
        <article className="metric-card">
          <strong>{filteredPatients.length}</strong>
          <p>cadastros no filtro atual</p>
        </article>
        <article className="metric-card">
          <strong>{withResponsibleCount}</strong>
          <p>acessos com responsável</p>
        </article>
        <article className="metric-card">
          <strong>{withWhatsappCount}</strong>
          <p>telefones com WhatsApp</p>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-single">
        <div className="content-card">
          <div className="filter-stack">
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="patient-directory-search">Buscar</label>
                <input
                  id="patient-directory-search"
                  value={search}
                  onChange={(event) => setSearch(toInstitutionalText(event.target.value))}
                  placeholder="Nome, CPF, telefone, CPF de acesso, CNS ou responsável..."
                />
              </div>
              <div className="field">
                <label htmlFor="patient-directory-phone">Telefone</label>
                <input
                  id="patient-directory-phone"
                  value={phoneFilter}
                  onChange={(event) => setPhoneFilter(event.target.value)}
                  inputMode="tel"
                  placeholder="(53) 99999-9999"
                />
              </div>
              <div className="field">
                <label htmlFor="patient-directory-address">Endereço</label>
                <input
                  id="patient-directory-address"
                  value={addressFilter}
                  onChange={(event) => setAddressFilter(toInstitutionalText(event.target.value))}
                  placeholder="Rua, bairro ou referência"
                />
              </div>
              <div className="field">
                <label htmlFor="patient-directory-responsible">Responsável</label>
                <input
                  id="patient-directory-responsible"
                  value={responsibleFilter}
                  onChange={(event) => setResponsibleFilter(toInstitutionalText(event.target.value))}
                  placeholder="Nome ou CPF do responsável"
                />
              </div>
              <div className="field checkbox-field checkbox-field-inline">
                <label className="checkbox-row" htmlFor="patient-directory-whatsapp">
                  <input
                    id="patient-directory-whatsapp"
                    type="checkbox"
                    checked={whatsappOnly}
                    onChange={(event) => setWhatsappOnly(event.target.checked)}
                  />
                  <span>Somente com WhatsApp</span>
                </label>
              </div>
              <div className="field checkbox-field checkbox-field-inline">
                <label className="checkbox-row" htmlFor="patient-directory-responsible-only">
                  <input
                    id="patient-directory-responsible-only"
                    type="checkbox"
                    checked={responsibleOnly}
                    onChange={(event) => setResponsibleOnly(event.target.checked)}
                  />
                  <span>Somente com acesso por responsável</span>
                </label>
              </div>
            </div>
          </div>

          <div className="status-line">
            <span className="subtle-label">
              <Search size={14} />
              {loading ? 'Carregando base de pacientes...' : `${filteredPatients.length} cadastro(s) localizado(s)`}
            </span>
            <div className="page-actions">
              {(search || phoneFilter || addressFilter || responsibleFilter || whatsappOnly || responsibleOnly) ? (
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPhoneFilter('')
                    setAddressFilter('')
                    setResponsibleFilter('')
                    setWhatsappOnly(false)
                    setResponsibleOnly(false)
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
              {error ? <span className="status-pill">{error}</span> : null}
            </div>
          </div>

          {loading ? (
            <p className="table-note">Carregando pacientes...</p>
          ) : filteredPatients.length > 0 ? (
            <div className="assignment-list scroll-list">
              {filteredPatients.map((patient) => (
                <article className="assignment-card" key={patient.id}>
                  <div className="assignment-header">
                    <div>
                      <strong>{patient.fullName}</strong>
                      <p className="table-note">{patient.cpfMasked} • Acesso {patient.accessCpfMasked}</p>
                    </div>
                  </div>

                  {patient.isWhatsapp || patient.useResponsibleCpfForAccess ? (
                    <div className="status-pill-row">
                      {patient.isWhatsapp ? <span className="confirmed-badge">WhatsApp</span> : null}
                      {patient.useResponsibleCpfForAccess ? <span className="update-badge">Acesso por responsável</span> : null}
                    </div>
                  ) : null}

                  <div className="request-summary">
                    <div>
                      <dt>Telefone</dt>
                      <dd>{patient.phone}</dd>
                    </div>
                    <div>
                      <dt>CNS</dt>
                      <dd>{patient.cns || 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt>Endereço</dt>
                      <dd>{patient.addressLine || 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt>Responsável</dt>
                      <dd>{patient.responsibleName || patient.responsibleCpfMasked || 'Não informado'}</dd>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="empty-state">
              <ShieldCheck size={28} />
              <h2>Nenhum paciente encontrado neste recorte</h2>
              <p>Refine os filtros para localizar nome, CPF, telefone, endereço ou dados do responsável.</p>
            </article>
          )}
        </div>
      </section>
        </main>
      </div>
    </div>
  )
}
