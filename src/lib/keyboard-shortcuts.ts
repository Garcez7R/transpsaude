/**
 * Gerenciador de atalhos de teclado para melhorar a produtividade
 */

export type ShortcutAction = () => void

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: ShortcutAction
  description: string
  category: string
}

class KeyboardShortcutManager {
  private shortcuts: KeyboardShortcut[] = []
  private enabled = true

  /**
   * Registra um novo atalho de teclado
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.push(shortcut)
  }

  /**
   * Registra múltiplos atalhos
   */
  registerAll(shortcuts: KeyboardShortcut[]): void {
    shortcuts.forEach((s) => this.register(s))
  }

  /**
   * Remove um atalho
   */
  unregister(key: string, ctrlKey = false): void {
    this.shortcuts = this.shortcuts.filter(
      (s) => !(s.key === key && s.ctrlKey === ctrlKey),
    )
  }

  /**
   * Habilita ou desabilita todos os atalhos
   */
  setEnabled(value: boolean): void {
    this.enabled = value
  }

  /**
   * Inicializa o listener global de teclado
   */
  init(): void {
    document.addEventListener('keydown', this.handleKeyDown)
  }

  /**
   * Remove o listener global de teclado
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  /**
   * Retorna todos os atalhos registrados para exibição em ajuda
   */
  getAll(): KeyboardShortcut[] {
    return [...this.shortcuts]
  }

  /**
   * Retorna atalhos por categoria
   */
  getByCategory(category: string): KeyboardShortcut[] {
    return this.shortcuts.filter((s) => s.category === category)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return

    // Ignora se estiver em um input, textarea ou select
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Permite Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X mesmo em inputs
      if (
        event.ctrlKey &&
        ['a', 'c', 'v', 'x', 'z'].includes(event.key.toLowerCase())
      ) {
        return
      }
      return
    }

    const shortcut = this.shortcuts.find((s) => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatch = (s.ctrlKey ?? false) === event.ctrlKey
      const shiftMatch = (s.shiftKey ?? false) === event.shiftKey
      const altMatch = (s.altKey ?? false) === event.altKey
      return keyMatch && ctrlMatch && shiftMatch && altMatch
    })

    if (shortcut) {
      event.preventDefault()
      shortcut.action()
    }
  }
}

// Instância global singleton
export const keyboardShortcuts = new KeyboardShortcutManager()

/**
 * Atalhos padrão da aplicação
 */
export const defaultShortcuts: KeyboardShortcut[] = [
  // Navegação
  {
    key: 'n',
    ctrlKey: true,
    action: () => {
      // Será configurado dinamicamente
    },
    description: 'Nova solicitação',
    category: 'Navegação',
  },
  {
    key: 'g',
    ctrlKey: true,
    action: () => {
      // Ir para painel (será configurado dinamicamente)
    },
    description: 'Ir para painel',
    category: 'Navegação',
  },
  {
    key: 'Escape',
    action: () => {
      // Fechar modal/dialog
    },
    description: 'Fechar modal/dialog',
    category: 'Navegação',
  },

  // Busca
  {
    key: 'f',
    ctrlKey: true,
    action: () => {
      // Focar na busca
    },
    description: 'Focar na busca',
    category: 'Busca',
  },
  {
    key: '/',
    action: () => {
      // Focar na busca (atalho alternativo)
    },
    description: 'Focar na busca (atalho rápido)',
    category: 'Busca',
  },

  // Ações
  {
    key: 's',
    ctrlKey: true,
    action: () => {
      // Salvar formulário
    },
    description: 'Salvar formulário',
    category: 'Ações',
  },
  {
    key: 'e',
    ctrlKey: true,
    action: () => {
      // Editar item selecionado
    },
    description: 'Editar item',
    category: 'Ações',
  },
  {
    key: 'd',
    ctrlKey: true,
    action: () => {
      // Excluir item selecionado
    },
    description: 'Excluir item',
    category: 'Ações',
  },

  // Ajuda
  {
    key: '?',
    action: () => {
      // Mostrar ajuda de atalhos
    },
    description: 'Mostrar atalhos de teclado',
    category: 'Ajuda',
  },
]

/**
 * Hook personalizado para usar atalhos de teclado em componentes
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  // Em um componente React, você usaria useEffect para registrar/desregistrar
  // Esta é uma versão simplificada
  shortcuts.forEach((shortcut) => {
    keyboardShortcuts.register(shortcut)
  })
}