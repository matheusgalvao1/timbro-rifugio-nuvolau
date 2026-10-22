import { useMemo, useState } from 'react'
import {
  addDays,
  compareDates,
  formatDuration,
  type ReportDetailRow,
} from '@nuvolau/shared'
import { useReportDetail, useUsers } from '../api/hooks'
import { formatDateLabelFull, formatDayParts, romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { TotalsDialog } from '../components/TotalsDialog'
import { Badge, Button, Card, Dialog, ErrorNote, Spinner } from '../components/ui'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from '../components/icons'

interface DrillTarget {
  userId: string
  displayName: string
  date: string
}

/**
 * Owner home: a timesheet grid — one row per employee, seven day columns
 * starting at the chosen day (default: today). The table carries its own
 * navigation: ‹ sits in the sticky name header, › (and a Today reset) at the
 * right edge. Clicking a cell opens that employee's entries for the day; the
 * totals dialog computes any pay period and exports the CSVs.
 */
export function OwnerPage() {
  const { t, lang } = useT()
  const usersQuery = useUsers()
  const today = romeNow().date
  const [weekStart, setWeekStart] = useState(today)
  const [totalsOpen, setTotalsOpen] = useState(false)
  const [drill, setDrill] = useState<DrillTarget | null>(null)

  // All hooks run on every render (React rule); the detail query just stays
  // disabled until the employee list is loaded.
  const employees = useMemo(
    () =>
      (usersQuery.data?.users ?? [])
        .filter((user) => user.role === 'employee')
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [usersQuery.data],
  )
  const employeeIds = employees.map((user) => user.id)
  const weekDetail = useReportDetail(
    { from: weekStart, to: addDays(weekStart, 6), users: employeeIds },
    employeeIds.length > 0,
  )

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  // userId -> workDate -> { work minutes, whether any entries exist that day }
  const matrix = useMemo(() => {
    const map = new Map<string, Map<string, { minutes: number; hasEntries: boolean }>>()
    for (const row of weekDetail.data?.rows ?? []) {
      let perDay = map.get(row.userId)
      if (!perDay) {
        perDay = new Map()
        map.set(row.userId, perDay)
      }
      const cell = perDay.get(row.workDate) ?? { minutes: 0, hasEntries: false }
      // Only work entries are payable; pauses are recorded but unpaid.
      if (row.endTime && row.kind === 'work') cell.minutes += row.minutes ?? 0
      cell.hasEntries = true
      perDay.set(row.workDate, cell)
    }
    return map
  }, [weekDetail.data])

  const navButton =
    'grid size-8 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-30'

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

  const usersWithData = new Set((weekDetail.data?.rows ?? []).map((row) => row.userId))
  // Active employees always; deactivated ones only when the window has their hours.
  const visibleEmployees = employees.filter((user) => user.isActive || usersWithData.has(user.id))

  return (
    <div className="space-y-4">
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-stone-100 bg-white py-2 pl-2 pr-3 text-left">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setWeekStart(addDays(weekStart, -7))}
                      className={navButton}
                      aria-label="previous week"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                      {t.owner.colName}
                    </span>
                  </div>
                </th>
                {days.map((date) => {
                  const parts = formatDayParts(date, lang)
                  const isTodayColumn = date === today
                  return (
                    <th key={date} className={`border-b border-stone-200 px-2 py-2 text-center ${isTodayColumn ? 'bg-brand-50/50' : ''}`}>
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-stone-400">
                        {parts.weekday}
                      </span>
                      <span
                        className={`block whitespace-nowrap text-sm font-semibold tabular-nums ${isTodayColumn ? 'text-brand-700' : 'text-stone-700'}`}
                      >
                        {parts.day} {parts.month}
                      </span>
                    </th>
                  )
                })}
                <th className="w-12 border-b border-stone-200 px-1 py-2">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => setWeekStart(addDays(weekStart, 7))}
                      disabled={compareDates(weekStart, today) >= 0}
                      className={navButton}
                      aria-label="next week"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                    {weekStart !== today && (
                      <button
                        onClick={() => setWeekStart(today)}
                        className="text-[11px] font-medium text-brand-700 hover:underline"
                      >
                        {t.owner.today}
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((user) => {
                const perDay = matrix.get(user.id)
                return (
                  <tr key={user.id} className={user.isActive ? '' : 'text-stone-400'}>
                    <td className="sticky left-0 z-10 max-w-[9rem] truncate border-b border-r border-stone-100 bg-white px-3 py-2 font-medium">
                      {user.displayName}
                      {!user.isActive && <Badge tone="muted">{t.owner.inactive}</Badge>}
                    </td>
                    {days.map((date) => {
                      const cell = perDay?.get(date)
                      const content = cell && cell.minutes > 0 ? formatDuration(cell.minutes) : '—'
                      return (
                        <td key={date} className={`border-b border-stone-100 px-2 py-1.5 text-center ${date === today ? 'bg-brand-50/30' : ''}`}>
                          {cell ? (
                            <button
                              onClick={() =>
                                setDrill({ userId: user.id, displayName: user.displayName, date })
                              }
                              className="w-full rounded-lg px-1 py-1 font-mono text-[13px] tabular-nums text-stone-700 transition hover:bg-brand-100/60"
                              aria-label={`${user.displayName} — ${date}`}
                            >
                              {content}
                            </button>
                          ) : (
                            <span className="font-mono text-[13px] tabular-nums text-stone-300">{content}</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-stone-100" />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Period totals for each employee and everyone combined + CSV export */}
        <div className="px-3 py-2.5">
          <Button variant="secondary" size="sm" onClick={() => setTotalsOpen(true)}>
            <DownloadIcon className="size-4" />
            {t.owner.totalsButton}
          </Button>
        </div>
      </Card>
      <ErrorNote error={weekDetail.error} />
      {visibleEmployees.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-400">{t.owner.emptySummary}</p>
      )}

      {/* Cell drill-down: that employee's entries for that day (read-only) */}
      <Dialog
        open={drill !== null}
        onClose={() => setDrill(null)}
        title={
          drill
            ? `${drill.displayName} · ${formatDateLabelFull(drill.date, lang)}`
            : ''
        }
      >
        {drill && (
          <EntriesList
            rows={(weekDetail.data?.rows ?? []).filter(
              (row) => row.userId === drill.userId && row.workDate === drill.date,
            )}
          />
        )}
      </Dialog>

      <TotalsDialog open={totalsOpen} users={usersQuery.data.users} onClose={() => setTotalsOpen(false)} />
    </div>
  )
}

/** Read-only entry list for the drill-down dialog. */
function EntriesList({ rows }: { rows: ReportDetailRow[] }) {
  const { t } = useT()
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-400">{t.owner.noEntriesDay}</p>
  }
  return (
    <div className="divide-y divide-stone-100">
      {[...rows]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((row) => (
          <div
            key={row.entryId}
            className={`flex items-center gap-2 py-2 text-sm ${row.kind === 'pause' ? 'text-stone-400' : ''}`}
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
  )
}
