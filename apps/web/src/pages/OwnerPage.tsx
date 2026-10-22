import { useMemo, useState } from 'react'
import {
  addDays,
  compareDates,
  formatDuration,
  type ReportDetailRow,
} from '@nuvolau/shared'
import { useReportDetail, useUsers } from '../api/hooks'
import {
  formatDateLabelFull,
  formatMonthLabel,
  monthKeyToRange,
  romeNow,
  shiftMonthKey,
} from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { MonthCalendar } from '../components/MonthCalendar'
import { ReportExportDialog } from '../components/ReportExportDialog'
import { Badge, Button, Card, ErrorNote, Spinner } from '../components/ui'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from '../components/icons'

/**
 * Owner home: day by day. Desktop shows the calendar on the left and the
 * selected day's per-employee breakdown on the right; mobile stacks them.
 * CSV export lives in a dialog launched from here.
 */
export function OwnerPage() {
  const { t, lang } = useT()
  const usersQuery = useUsers()
  const today = romeNow().date
  const [date, setDate] = useState(today)
  const [browseMonth, setBrowseMonth] = useState(today.slice(0, 7))
  const [exportOpen, setExportOpen] = useState(false)

  // All hooks run on every render (React rule): the calendar query exists
  // even while the user list is still loading, it just stays disabled.
  const employees = (usersQuery.data?.users ?? []).filter((user) => user.role === 'employee')
  const employeeIds = employees.map((user) => user.id)
  const monthDetail = useReportDetail(
    { from: monthKeyToRange(browseMonth).from, to: monthKeyToRange(browseMonth).to, users: employeeIds },
    employeeIds.length > 0,
  )

  const navButton =
    'grid size-10 place-items-center rounded-full text-stone-500 transition hover:bg-stone-200/70 disabled:opacity-30'
  const go = (delta: number) => {
    const next = addDays(date, delta)
    setDate(next)
    setBrowseMonth(next.slice(0, 7))
  }

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
      <div className="lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Calendar column */}
        <div className="space-y-4">
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} className={navButton} aria-label="previous day">
              <ChevronLeftIcon className="size-5" />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold capitalize">
              {formatDateLabelFull(date, lang)}
            </h2>
            <button
              onClick={() => go(1)}
              disabled={compareDates(date, today) >= 0}
              className={navButton}
              aria-label="next day"
            >
              <ChevronRightIcon className="size-5" />
            </button>
            <button
              onClick={() => {
                setDate(today)
                setBrowseMonth(today.slice(0, 7))
              }}
              disabled={date === today}
              className="h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-30"
            >
              {t.owner.today}
            </button>
          </div>

          <Card>
            <MonthCalendarHeader monthKey={browseMonth} lang={lang} onShift={setBrowseMonth} />
            <MonthCalendar
              monthKey={browseMonth}
              lang={lang}
              today={today}
              selected={date}
              entries={monthDetail.data?.rows ?? []}
              onPick={(picked) => {
                setDate(picked)
                setBrowseMonth(picked.slice(0, 7))
              }}
            />
          </Card>

          <Button variant="secondary" className="w-full" onClick={() => setExportOpen(true)}>
            <DownloadIcon className="size-4" />
            {t.owner.csvButton}
          </Button>
        </div>

        {/* Selected day, per employee */}
        <DayBreakdown employees={employees} date={date} />
      </div>

      <ReportExportDialog open={exportOpen} users={usersQuery.data.users} onClose={() => setExportOpen(false)} />
    </div>
  )
}

function MonthCalendarHeader({
  monthKey,
  lang,
  onShift,
}: {
  monthKey: string
  lang: string
  onShift: (next: string) => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-semibold capitalize text-stone-500">
        {formatMonthLabel(monthKey, lang)}
      </span>
      <div className="flex gap-0.5">
        <button
          onClick={() => onShift(shiftMonthKey(monthKey, -1))}
          className="grid size-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
          aria-label="previous month"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <button
          onClick={() => onShift(shiftMonthKey(monthKey, 1))}
          className="grid size-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
          aria-label="next month"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}

function DayBreakdown({ employees, date }: { employees: { id: string; displayName: string; isActive: boolean }[]; date: string }) {
  const { t } = useT()
  const employeeIds = employees.map((user) => user.id)
  const dayDetail = useReportDetail({ from: date, to: date, users: employeeIds }, employeeIds.length > 0)

  const rows = dayDetail.data?.rows ?? []
  const byUser = useMemo(() => {
    const map = new Map<string, ReportDetailRow[]>()
    for (const row of [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const list = map.get(row.userId) ?? []
      list.push(row)
      map.set(row.userId, list)
    }
    return map
  }, [rows])

  if (dayDetail.isPending) {
    return (
      <div className="mt-4 grid place-items-center py-10 lg:mt-0">
        <Spinner className="size-6 text-stone-300" />
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-2 lg:mt-0">
      <ErrorNote error={dayDetail.error} />
      {employees.map((user) => {
        const userRows = byUser.get(user.id) ?? []
        const minutes = userRows.reduce(
          (sum, row) => (row.endTime && row.kind === 'work' ? sum + (row.minutes ?? 0) : sum),
          0,
        )
        return (
          <Card key={user.id} className="space-y-1.5 !py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-medium">
                {user.displayName}
                {!user.isActive && (
                  <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    {t.owner.inactive}
                  </span>
                )}
              </p>
              <span className="font-mono font-semibold tabular-nums">
                {userRows.length ? formatDuration(minutes) : '—'}
              </span>
            </div>
            {userRows.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {userRows.map((row) => (
                  <div
                    key={row.entryId}
                    className={`flex items-center gap-2 py-1.5 text-sm ${row.kind === 'pause' ? 'text-stone-400' : ''}`}
                  >
                    <span className="font-mono tabular-nums">
                      {row.startTime} – {row.endTime ?? '…'}
                    </span>
                    {row.kind === 'pause' && <Badge tone="muted">{t.owner.pauseBadge}</Badge>}
                    {!row.endTime && <Badge tone="good">{t.employee.running}</Badge>}
                    <span className="ml-auto font-mono text-xs tabular-nums">
                      {row.minutes === null ? '' : formatDuration(row.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-300">{t.owner.noEntriesDay}</p>
            )}
          </Card>
        )
      })}
      {employees.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-400">{t.owner.emptySummary}</p>
      )}
    </div>
  )
}
