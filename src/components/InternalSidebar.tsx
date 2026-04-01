import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type SidebarItem = {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

type InternalSidebarProps = {
  title: string
  subtitle: string
  sessionName: string
  sessionRole: string
  items: SidebarItem[]
  actions?: ReactNode
}

export function InternalSidebar({ title, subtitle, sessionName, sessionRole, items, actions }: InternalSidebarProps) {
  return (
    <aside className="saas-sidebar">
      <div className="saas-sidebar-panel">
        <div className="saas-sidebar-brand">
          <div className="crest-mark saas-sidebar-crest" aria-hidden="true">
            <span />
          </div>
          <div className="saas-sidebar-copy">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>

        <div className="saas-sidebar-session">
          <span className="subtle-label">Sessão ativa</span>
          <strong>{sessionName}</strong>
          <p>{sessionRole}</p>
        </div>

        <nav className="saas-sidebar-nav" aria-label="Navegação interna">
          {items.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                className={({ isActive }) => `saas-nav-link ${isActive ? 'active' : ''}`}
                end={item.exact}
                to={item.to}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {actions ? <div className="saas-sidebar-actions">{actions}</div> : null}
      </div>
    </aside>
  )
}
