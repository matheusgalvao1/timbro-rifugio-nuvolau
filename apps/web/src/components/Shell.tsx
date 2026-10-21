import { Link, useNavigate } from 'react-router'
import type { ReactNode } from 'react'
import type { UserPublic } from '@nuvolau/shared'
import { useLogout } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { GearIcon, LogOutIcon } from './icons'

function Logo() {
  return (
    <svg viewBox="0 0 512 512" className="size-6 shrink-0" aria-hidden="true">
      <rect width="512" height="512" rx="96" fill="#1f6f54" />
      <path d="M96 352 L208 216 L288 304 L336 248 L416 352 Z" fill="#f5f5f4" opacity="0.35" />
      <circle cx="256" cy="220" r="108" fill="#f5f5f4" />
      <circle cx="256" cy="220" r="88" fill="none" stroke="#1f6f54" strokeWidth="12" />
      <path d="M256 220 L256 152 M256 220 L308 248" stroke="#1f6f54" strokeWidth="16" strokeLinecap="round" />
      <circle cx="256" cy="220" r="10" fill="#1f6f54" />
    </svg>
  )
}

export function Shell({ user, children }: { user: UserPublic; children: ReactNode }) {
  const { t, lang, setLang } = useT()
  const logout = useLogout()
  const navigate = useNavigate()
  const isOwner = user.role === 'owner'
  const home = isOwner ? '/owner' : '/app'
  const containerWidth = isOwner ? 'mx-auto max-w-5xl px-4' : 'mx-auto max-w-md px-4'
  const iconButton =
    'grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-700'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-100/85 backdrop-blur">
        <div className={`${containerWidth} flex items-center gap-2 py-2.5`}>
          <Link to={home} className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            {t.appName}
          </Link>
          <div className="ml-auto flex items-center gap-0.5" style={{ marginRight: 'env(safe-area-inset-right)' }}>
            <button
              onClick={() => setLang(lang === 'en' ? 'it' : 'en')}
              className={`${iconButton} text-xs font-semibold`}
              title={t.language}
            >
              {lang.toUpperCase()}
            </button>
            <Link to="/settings" className={iconButton} title={t.settings}>
              <GearIcon className="size-5" />
            </Link>
            <button
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
              className={iconButton}
              title={t.signOut}
            >
              <LogOutIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <main className={`${containerWidth} flex-1 pb-24 pt-4`}>{children}</main>
    </div>
  )
}
