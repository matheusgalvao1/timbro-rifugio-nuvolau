import { useEffect, useState, type FormEvent } from 'react'
import { userCreateSchema, type UserPublic } from '@nuvolau/shared'
import { useCreateUser, useUpdateUser } from '../api/hooks'
import { slugUsername } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Dialog, ErrorNote, Field, Input } from './ui'

export type UserDialogMode = { kind: 'create' } | { kind: 'edit'; user: UserPublic } | null

/** Create an employee (returns the generated password) or rename one. */
export function UserDialog({
  mode,
  onReveal,
  onClose,
}: {
  mode: UserDialogMode
  onReveal: (reveal: { displayName: string; username: string; password: string }) => void
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateUser()
  const update = useUpdateUser()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (!mode) return
    if (mode.kind === 'edit') {
      setDisplayName(mode.user.displayName)
      setUsername(mode.user.username)
    } else {
      setDisplayName('')
      setUsername('')
    }
  }, [mode])

  if (!mode) return null

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (mode.kind === 'create') {
      const parsed = userCreateSchema.safeParse({ displayName, username })
      if (!parsed.success) return
      create.mutate(parsed.data, {
        onSuccess: (data) => {
          onReveal({
            displayName: data.user.displayName,
            username: data.user.username,
            password: data.password,
          })
          onClose()
        },
      })
    } else {
      const input: { displayName: string; username: string } = { displayName, username }
      update.mutate(
        { userId: mode.user.id, input },
        { onSuccess: () => onClose() },
      )
    }
  }

  const busy = mode.kind === 'create' ? create.isPending : update.isPending

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode.kind === 'create' ? t.owner.addEmployee : t.owner.editEmployee}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t.displayName}>
          <Input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              if (mode.kind === 'create') setUsername(slugUsername(e.target.value))
            }}
            autoCapitalize="words"
            required
          />
        </Field>
        <Field label={t.username} hint={mode.kind === 'create' ? 'a–z 0–9 . - _' : undefined}>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </Field>
        <ErrorNote error={mode.kind === 'create' ? create.error : update.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" busy={busy}>
            {t.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
