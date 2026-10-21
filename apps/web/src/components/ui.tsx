import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { useT } from '../i18n/i18n'
import { XIcon } from './icons'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  busy?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-stone-600 hover:bg-stone-200/60',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-2.5 text-sm',
  md: 'h-11 gap-2 rounded-xl px-4 text-[15px]',
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Button({ variant = 'primary', size = 'md', busy, className = '', children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {busy && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70 ${className}`}>
      {children}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'muted'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-brand-50 text-brand-700',
    good: 'bg-emerald-100 text-emerald-800',
    muted: 'bg-stone-200 text-stone-600',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const { t } = useT()
  if (!error) return null
  let message: string
  if (error instanceof ApiError) {
    message = t.errors[error.code] ?? error.message
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = t.somethingWentWrong
  }
  return <p className="text-sm text-red-600">{message}</p>
}

export function CenteredSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center text-stone-400">
      <Spinner className="size-8" />
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-3xl sm:pb-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <button
            onClick={onClose}
            className="-mt-1 -mr-1 rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
            aria-label="close"
          >
            <XIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface ConfirmState {
  title: string
  body: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const { t } = useT()
  if (!state) return null
  return (
    <Dialog open onClose={onClose} title={state.title}>
      <p className="mb-5 text-sm text-stone-600">{state.body}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button
          variant={state.danger ? 'danger' : 'primary'}
          busy={state.busy}
          onClick={() => {
            state.onConfirm()
          }}
        >
          {state.confirmLabel ?? t.confirm}
        </Button>
      </div>
    </Dialog>
  )
}
