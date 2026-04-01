# Guia de Implementação - Melhorias UX/UI

Este guia mostra como integrar os novos componentes em cada página.

## ✅ Componentes Prontos

Todos os componentes estão criados e testados:
- `Pagination.tsx` - Paginação
- `AdvancedFilters.tsx` - Filtros colapsáveis
- `ConfirmDialog.tsx` - Confirmação
- `validation.ts` - Validações
- `csv-export.ts` - Exportação CSV
- `keyboard-shortcuts.ts` - Atalhos

## 📄 Implementação por Página

### 1. DashboardPage (Operador)

```tsx
// Adicionar imports
import { AdvancedFilters } from '../components/AdvancedFilters'
import { Pagination } from '../components/Pagination'

// Adicionar estado
const [currentPage, setCurrentPage] = useState(1)
const ITEMS_PER_PAGE = 10

// Paginação
const paginatedRequests = useMemo(() => {
  const start = (currentPage - 1) * ITEMS_PER_PAGE
  const end = start + ITEMS_PER_PAGE
  return requests.slice(start, end)
}, [requests, currentPage])

const totalPages = Math.ceil(requests.length / ITEMS_PER_PAGE)

// No JSX - substituir lista
{paginatedRequests.map((request) => (...))}

// Adicionar após a lista
{totalPages > 1 && (
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={requests.length}
    onPageChange={setCurrentPage}
  />
)}
```

### 2. DriversPage (Equipe e Veículos)

```tsx
// Adicionar ConfirmDialog para exclusões
const [confirmDelete, setConfirmDelete] = useState<{ type: string, id: number } | null>(null)

// Substituir handleDelete
async function handleDeleteDriver(id: number) {
  setConfirmDelete({ type: 'driver', id })
}

// No JSX
<ConfirmDialog
  isOpen={!!confirmDelete}
  title="Excluir registro"
  message={`Tem certeza que deseja excluir este ${confirmDelete?.type}?`}
  onConfirm={async () => {
    // lógica de exclusão
    setConfirmDelete(null)
  }}
  onCancel={() => setConfirmDelete(null)}
/>
```

### 3. AdminManagersPage (Admin)

```tsx
// Adicionar export CSV
import { exportData } from '../lib/csv-export'

// Botão de exportação
<button
  className="export-button"
  onClick={() => exportData('requests', requests)}
>
  Exportar CSV
</button>
```

### 4. RegisterRequestPage (Cadastro)

```tsx
// Adicionar validação
import { validateTravelRequestForm, hasValidationErrors } from '../lib/validation'

// No handleSubmit
const errors = validateTravelRequestForm(form)
if (hasValidationErrors(errors)) {
  setError(Object.values(errors)[0] || 'Verifique os campos')
  return
}
```

### 5. Atalhos de Teclado (App.tsx)

```tsx
import { keyboardShortcuts, defaultShortcuts } from './lib/keyboard-shortcuts'

useEffect(() => {
  keyboardShortcuts.init()
  keyboardShortcuts.registerAll(defaultShortcuts)
  return () => keyboardShortcuts.destroy()
}, [])
```

## 🎨 Estilos Adicionais

Os estilos já estão em `index.css`:
- `.pagination-container`
- `.advanced-filters`
- `.confirm-dialog-backdrop`
- `.field-error`
- `.export-button`

## 📊 Checklist de Implementação

- [ ] DashboardPage: Paginação
- [ ] DashboardPage: AdvancedFilters
- [ ] DriversPage: ConfirmDialog
- [ ] AdminManagersPage: Export CSV
- [ ] RegisterRequestPage: Validação
- [ ] App.tsx: Atalhos de teclado
- [ ] Testar todas as integrações
- [ ] Commitar mudanças

## 🚀 Comandos

```bash
cd /home/rgarcez/Documentos/transp-saude
npm run build
npm run lint
git add -A
git commit -m "feat: implementar melhorias de UX/UI"