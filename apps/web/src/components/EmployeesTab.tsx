import { useState } from 'react'
import type { UserPublic } from '@nuvolau/shared'
import { useResetPassword, useUpdateUser } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { Button, Card, ConfirmDialog, ErrorNote, type ConfirmState } from './ui'
import { PasswordRevealDialog, type PasswordReveal } from './PasswordRevealDialog'
import { UserDialog, type UserDialogMode } from './UserDialog'
import { PencilIcon, PowerIcon, PlusIcon, KeyIcon } from './icons'

export function EmployeesTab({ users }: { users: UserPublic[] }) {
  const { t } = useT()
  const updateUser = useUpdateUser()
  const resetPassword = useResetPassword()

  const [dialogMode, setDialogMode] = useState<UserDialogMode>(null)
  const [reveal, setReveal] = useState<PasswordReveal | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const employees = users
    .filter((user) => user.role === 'employee')
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const confirmReset = (user: UserPublic) => {
    setConfirm({
      title: t.owner.resetPassword,
      body: `${user.displayName} — ${t.owner.resetConfirm}`,
      confirmLabel: t.owner.resetPassword,
      busy: resetPassword.isPending,
      onConfirm:
        () =>
        resetPassword.mutate(user.id, {
          onSuccess: (data) => {
            setConfirm(null)
            setReveal({ displayName: user.displayName, username: user.username, password: data.password })
          },
          onError: () => setConfirm(null),
        }),
    })
  }

  const confirmDeactivate = (user: UserPublic) => {
    const deactivating = user.isActive
    setConfirm({
      title: deactivating ? t.owner.deactivate : t.owner.reactivate,
      body: deactivating ? `${user.displayName} — ${t.owner.deactivateConfirm}` : user.displayName,
      confirmLabel: deactivating ? t.owner.deactivate : t.owner.reactivate,
      danger: deactivating,
      busy: updateUser.isPending,
      onConfirm: () =>
        updateUser.mutate(
          { userId: user.id, input: { isActive: !deactivating } },
          { onSettled: () => setConfirm(null) },
        ),
    })
  }

  const actionButton =
    'grid size-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.owner.employeesTab}</h2>
        <Button size="sm" onClick={() => setDialogMode({ kind: 'create' })}>
          <PlusIcon className="size-4" />
          {t.owner.addEmployee}
        </Button>
      </div>
      <ErrorNote error={updateUser.error ?? resetPassword.error} />

      <div className="space-y-2">
        {employees.map((user) => (
          <Card key={user.id} className="flex items-center gap-3 !py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {user.displayName}
                {!user.isActive && (
                  <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    {t.owner.inactive}
                  </span>
                )}
              </p>
              <p className="truncate font-mono text-xs text-stone-400">{user.username}</p>
            </div>
            <div className="ml-auto flex items-center">
              <button onClick={() => setDialogMode({ kind: 'edit', user })} className={actionButton} aria-label={t.edit}>
                <PencilIcon className="size-4" />
              </button>
              <button
                onClick={() => confirmReset(user)}
                className={actionButton}
                aria-label={t.owner.resetPassword}
                title={t.owner.resetPassword}
              >
                <KeyIcon className="size-4" />
              </button>
              <button
                onClick={() => confirmDeactivate(user)}
                className={`${actionButton} ${user.isActive ? 'hover:text-red-600' : 'text-brand-600'}`}
                aria-label={user.isActive ? t.owner.deactivate : t.owner.reactivate}
              >
                <PowerIcon className="size-4" />
              </button>
            </div>
          </Card>
        ))}
        {employees.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">{t.owner.emptySummary}</p>
        )}
      </div>

      <UserDialog
        mode={dialogMode}
        onReveal={(value) => setReveal(value)}
        onClose={() => setDialogMode(null)}
      />
      <PasswordRevealDialog reveal={reveal} onClose={() => setReveal(null)} />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
