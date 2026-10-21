import { useEffect, useState, type FormEvent } from 'react'
import type { UserPublic } from '@nuvolau/shared'
import { ApiError } from '../api/client'
import { useChangePassword, useMe, useUpdateMe } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { Button, Card, ErrorNote, Field, Input } from '../components/ui'

export function SettingsPage() {
  const { t, lang, setLang } = useT()
  const me = useMe()
  const user = me.data?.user as UserPublic | undefined
  const updateMe = useUpdateMe()
  const changePassword = useChangePassword()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
      setUsername(user.username)
    }
  }, [user])

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    setProfileSaved(false)
    updateMe.mutate(
      { displayName, username },
      { onSuccess: () => setProfileSaved(true) },
    )
  }

  const savePassword = (event: FormEvent) => {
    event.preventDefault()
    setPasswordSaved(false)
    if (next !== again) return
    changePassword.mutate(
      { current, next },
      {
        onSuccess: () => {
          setPasswordSaved(true)
          setCurrent('')
          setNext('')
          setAgain('')
        },
      },
    )
  }

  if (!user) return null
  const passwordError = (() => {
    if (!changePassword.error) return null
    if (next !== again) return new Error(t.errors.VALIDATION)
    const error = changePassword.error
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
      return new Error(t.settingsPage.wrongCurrent)
    }
    return error
  })()

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">{t.settingsPage.title}</h1>

      {user.role === 'owner' && (
        <p className="rounded-xl bg-stone-200/70 px-3 py-2 text-xs text-stone-500">{t.settingsPage.readonlyNote}</p>
      )}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{t.settingsPage.profileTitle}</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label={t.displayName}>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoCapitalize="words" required />
          </Field>
          <Field label={t.username}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" required />
          </Field>
          {profileSaved && <p className="text-sm font-medium text-brand-600">{t.settingsPage.saved}</p>}
          <ErrorNote error={updateMe.error} />
          <Button type="submit" busy={updateMe.isPending}>
            {t.save}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{t.settingsPage.passwordTitle}</h2>
        <form onSubmit={savePassword} className="space-y-4">
          <Field label={t.settingsPage.currentPassword}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label={t.settingsPage.newPassword}>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label={t.password}>
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </Field>
          {passwordSaved && <p className="text-sm font-medium text-brand-600">{t.settingsPage.saved}</p>}
          <ErrorNote error={passwordError} />
          <Button type="submit" busy={changePassword.isPending}>
            {t.save}
          </Button>
        </form>
      </Card>

      <Card className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-600">{t.language}</span>
        <div className="flex gap-1 rounded-lg bg-stone-200/70 p-1">
          {(['en', 'it'] as const).map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                lang === code ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              {code === 'en' ? 'English' : 'Italiano'}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
