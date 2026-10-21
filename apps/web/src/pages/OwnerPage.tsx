import { useState } from 'react'
import { useUsers } from '../api/hooks'
import { useT } from '../i18n/i18n'
import { ErrorNote, Spinner } from '../components/ui'
import { EmployeesTab } from '../components/EmployeesTab'
import { ReportTab } from '../components/ReportTab'

export function OwnerPage() {
  const { t } = useT()
  const usersQuery = useUsers()
  const [tab, setTab] = useState<'report' | 'employees'>('report')

  const tabButton = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
    }`

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
    <div className="space-y-4">
      <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-stone-200/70 p-1">
        <button onClick={() => setTab('report')} className={tabButton(tab === 'report')}>
          {t.owner.reportTab}
        </button>
        <button onClick={() => setTab('employees')} className={tabButton(tab === 'employees')}>
          {t.owner.employeesTab}
        </button>
      </div>
      <p className="text-xs text-stone-400">{t.owner.ownerReadonly}</p>

      {tab === 'report' ? <ReportTab users={usersQuery.data.users} /> : <EmployeesTab users={usersQuery.data.users} />}
    </div>
  )
}
