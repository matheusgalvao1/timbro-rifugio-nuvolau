import { useUsers } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { EmployeesTab } from '../components/EmployeesTab'
import { ErrorNote, Spinner } from '../components/ui'

/** Owner's employee management, reached from the top-bar button. */
export function EmployeesPage() {
  const { t } = useT()
  const usersQuery = useUsers()

  if (usersQuery.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner className="size-7 text-stone-300" />
      </div>
    )
  }
  if (usersQuery.error) {
    return <ErrorNote error={usersQuery.error} />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EmployeesTab users={usersQuery.data.users} />
    </div>
  )
}
