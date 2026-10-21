import { useMemo, useState } from 'react'
import {
  addDays,
  compareDates,
  formatDuration,
  type ReportDetailRow,
  type UserPublic,
} from '@nuvolau/shared'
import { useReportDetail } from '../api/hooks'
import {
  formatDateLabelFull,
  formatMonthLabel,
  monthKeyToRange,
  romeNow,
  shiftMonthKey,
} from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { MonthCalendar } from './MonthCalendar'
import { Badge, Card, ErrorNote, Spinner } from './ui'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/**
 * Owner's default view: one day, all employees. A mini calendar above drives
 * the day; each employee card shows their shifts and pauses for that day.
 */
export function OwnerDayTab({ users }: { users: UserPublic[] }) {
  const { t, lang } = useT()
  const today = romeNow().date
  const [date, setDate] = useState(today)
  const [browseMonth, setBrowseMonth] = useState(today.slice(0, 7))

  const employees = useMemo(() => users.filter((user) => user.role === 'employee'), [users])
  const employeeIds = employees.map((user) => user.id)

  const dayDetail = useReportDetail({ from: date, to: date, users: employeeIds }, employeeIds.length > 0)
  const monthDetail = useReportDetail(
    { from: monthKeyToRange(browseMonth).from, to: monthKeyToRange(browseMonth).to, users: employeeIds },
    employeeIds.length > 0,
  )

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

  const navButton =
    'grid size-10 place-items-center rounded-full text-stone-500 transition hover:bg-stone-200/70 disabled:opacity-30'
  const go = (delta: number) => {
    const next = addDays(date, delta)
    setDate(next)
    setBrowseMonth(next.slice(0, 7))
  }

  return (
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

      <ErrorNote error={dayDetail.error} />

      {dayDetail.isPending ? (
        <div className="grid place-items-center py-10">
          <Spinner className="size-6 text-stone-300" />
        </div>
      ) : (
        <div className="space-y-2">
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
      )}
    </div>
  )
}
