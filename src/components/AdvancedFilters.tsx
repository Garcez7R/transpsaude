import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type AdvancedFiltersProps = {
  children: ReactNode
  label?: string
  defaultOpen?: boolean
  onClear?: () => void
  hasActiveFilters?: boolean
}

export function AdvancedFilters({
  children,
  label = 'Filtros avançados',
  defaultOpen = false,
  onClear,
  hasActiveFilters = false,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="advanced-filters">
      <button
        className="advanced-filters-toggle"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="advanced-filters-content"
      >
        <Filter size={16} />
        <span>{label}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {hasActiveFilters && onClear && (
        <button
          className="advanced-filters-clear"
          type="button"
          onClick={onClear}
          title="Limpar filtros"
        >
          <X size={16} />
          <span>Limpar</span>
        </button>
      )}

      {isOpen && (
        <div id="advanced-filters-content" className="advanced-filters-content">
          {children}
        </div>
      )}
    </div>
  )
}