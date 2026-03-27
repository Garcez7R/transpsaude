import { Check, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary'
type Status = 'idle' | 'loading' | 'success'

interface AsyncActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode
  loading?: boolean
  success?: boolean
  loadingLabel?: string
  successLabel?: string
  variant?: Variant
  icon?: LucideIcon
}

export function AsyncActionButton({
  children,
  loading = false,
  success = false,
  loadingLabel,
  successLabel,
  variant = 'primary',
  className = '',
  icon: Icon,
  disabled,
  ...props
}: AsyncActionButtonProps) {
  const status: Status = loading ? 'loading' : success ? 'success' : 'idle'
  const computedClassName = `action-button ${variant} async-action-button ${status !== 'idle' ? `is-${status}` : ''} ${className}`.trim()

  return (
    <button className={computedClassName} disabled={disabled || loading} {...props}>
      {status === 'loading' ? (
        <>
          <LoaderCircle className="async-action-icon spinning" size={16} />
          {loadingLabel ?? children}
        </>
      ) : status === 'success' ? (
        <>
          <Check className="async-action-icon" size={16} />
          {successLabel ?? children}
        </>
      ) : (
        <>
          {Icon ? <Icon className="async-action-icon" size={16} /> : null}
          {children}
        </>
      )}
    </button>
  )
}
