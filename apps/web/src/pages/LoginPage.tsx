import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useLogin, useMe } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { Button, Card, ErrorNote, Field, Input } from '../components/ui'

export function LoginPage() {
  const { t, lang, setLang } = useT()
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Already signed in? Straight to the right area.
  useEffect(() => {
    const user = me.data?.user
    if (user) navigate(user.role === 'owner' ? '/admin' : '/app', { replace: true })
  }, [me.data, navigate])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ username, password }, { onSuccess: (data) => navigate(data.user.role === 'owner' ? '/admin' : '/app', { replace: true }) })
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
          <p className="mt-1 text-sm text-stone-500">{t.login.title}</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t.username}>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </Field>
            <Field label={t.password}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <ErrorNote error={login.error} />
            <Button type="submit" className="w-full" busy={login.isPending}>
              {t.login.submit}
            </Button>
          </form>
        </Card>
        <div className="text-center">
          <button
            onClick={() => setLang(lang === 'en' ? 'it' : 'en')}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-200/60"
          >
            {lang === 'en' ? 'Italiano' : 'English'}
          </button>
        </div>
      </div>
    </div>
  )
}
