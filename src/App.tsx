import {
  Ambulance,
  Building2,
  ClipboardList,
  MapPinned,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { InstallAppBar } from './components/InstallAppBar'
import { DashboardPage } from './pages/DashboardPage'
import { PublicStatusPage } from './pages/PublicStatusPage'
import { RegisterRequestPage } from './pages/RegisterRequestPage'

const highlights = [
  {
    title: 'Painel do operador',
    description: 'Cadastro presencial de solicitações, revisão rápida de dados e atualização de status.',
    icon: ClipboardList,
  },
  {
    title: 'Consulta pública',
    description: 'PWA simples para o cidadão acompanhar protocolo, deslocamento e pendências.',
    icon: Smartphone,
  },
  {
    title: 'Governança básica',
    description: 'Histórico de status, trilha de auditoria e estrutura preparada para perfis internos.',
    icon: ShieldCheck,
  },
]

function HomePage() {
  return (
    <div className="shell">
      <section className="institutional-bar">
        <div className="crest-mark" aria-hidden="true">
          <span />
        </div>
        <div className="institutional-copy">
          <strong>Prefeitura de Capão do Leão</strong>
          <span>Secretaria Municipal de Saúde • Transporte de Pacientes</span>
        </div>
      </section>

      <header className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">
            <Ambulance size={16} />
            Transporte em Saude
          </div>
          <h1>Agendamento municipal de viagens para tratamento fora do domicilio.</h1>
          <p className="hero-text">
            Plataforma da Prefeitura de Capão do Leão para cadastrar solicitações, acompanhar
            aprovações e permitir que o cidadão veja o andamento pelo celular.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" to="/operador">
              Abrir painel do operador
            </Link>
            <Link className="secondary-link" to="/acompanhar">
              Testar consulta publica
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-top">
            <span className="status-pill status-pill-live">MVP Cloudflare</span>
            <span className="status-pill">D1 only</span>
          </div>
          <div className="public-seal">
            <div className="seal-icon">
              <Building2 size={22} />
            </div>
            <div>
              <strong>Uso institucional</strong>
              <p>Base pensada para o atendimento municipal de Capão do Leão, com consulta pública e linguagem mais oficial.</p>
            </div>
          </div>
          <h2>Escopo inicial recomendado</h2>
          <ul className="check-list">
            <li>Cadastro de pacientes e solicitacoes</li>
            <li>Status operacionais e historico</li>
            <li>Painel interno com filtros</li>
            <li>PWA publico com CPF e PIN</li>
          </ul>
          <div className="mini-metrics">
            <div>
              <strong>2</strong>
              <span>areas principais</span>
            </div>
            <div>
              <strong>7</strong>
              <span>status iniciais</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Cloudflare</span>
            </div>
          </div>
        </div>
      </header>

      <section className="feature-grid">
        {highlights.map(({ title, description, icon: Icon }) => (
          <article className="feature-card" key={title}>
            <div className="feature-icon">
              <Icon size={20} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="journey-panel">
        <div className="journey-copy">
          <span className="section-label">
            <Building2 size={16} />
            Fluxo sugerido
          </span>
          <h2>Do balcao da prefeitura ao celular do paciente.</h2>
        </div>
        <div className="timeline">
          <div className="timeline-item">
            <strong>1. Atendimento</strong>
            <p>Operador registra paciente, destino, especialidade, necessidade de acompanhante e CPF de acesso.</p>
          </div>
          <div className="timeline-item">
            <strong>2. Analise interna</strong>
            <p>Solicitacao recebe protocolo, passa por validacao e o cidadao entra inicialmente com a senha 0000.</p>
          </div>
          <div className="timeline-item">
            <strong>3. Consulta publica</strong>
            <p>O cidadao cria um PIN numerico de 4 digitos no primeiro acesso e acompanha status, data e orientacoes no PWA.</p>
          </div>
        </div>
      </section>

      <section className="institutional-panel">
        <article className="institutional-card">
          <span className="section-label">
            <MapPinned size={16} />
            Identidade do projeto
          </span>
          <h2>Visual mais proximo de portal oficial da prefeitura.</h2>
          <p>
            A interface agora usa verde como base institucional, amarelo para destaques, cinza para
            estados neutros e branco nas superfícies principais da Prefeitura de Capão do Leão.
          </p>
        </article>
      </section>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/operador" element={<DashboardPage />} />
        <Route path="/operador/cadastro" element={<RegisterRequestPage />} />
        <Route path="/acompanhar" element={<PublicStatusPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallAppBar />
    </>
  )
}
