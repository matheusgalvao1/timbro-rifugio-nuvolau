import { useState } from 'react'
import { formatDuration, monthDaysRange, type UserPublic } from '@nuvolau/shared'
import { fetchReportDetail, fetchReportSummary, useReportSummary, type ReportFilter } from '../api/hooks'
import {
  detailCsvTable,
  downloadCsv,
  summaryCsvTable,
  type DetailCsvLabels,
  type SummaryCsvLabels,
} from '../lib/csv'
import { monthKeyToRange, romeNow, shiftMonthKey } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Dialog, ErrorNote, Field, Input, Spinner } from './ui'

/** CSV column-head labels, shared by both exports. */
export function csvLabels(t: ReturnType<typeof useT>['t']): SummaryCsvLabels {
  return {
    name: t.owner.colName,
    username: t.username,
    days: t.owner.colDays,
    entries: t.owner.colEntries,
    hours: `${t.owner.colHours} (h:mm)`,
    decimal: `${t.owner.colDecimal} h`,
  }
}

export function csvDetailLabels(t: ReturnType<typeof useT>['t']): DetailCsvLabels {
  return {
    ...csvLabels(t),
    date: t.date,
    start: t.employee.start,
    end: t.employee.end,
    type: t.owner.csvType,
    pause: t.owner.csvPause,
  }
}

/**
 * Totals for any period — the owner's payroll calculator: pick the range (the
 * pay period's edges are whatever she says), see each employee's hours and the
 * combined total on screen, then download the same numbers as CSV.
 */
export function TotalsDialog({
  open,
  users,
  onClose,
}: {
  open: boolean
  users: UserPublic[]
  onClose: () => void
}) {
  const { t } = useT()
  const [today] = useState(() => romeNow().date)
  const [currentMonth] = useState(() => monthDaysRange(today))
  const [from, setFrom] = useState(currentMonth.from)
  const [to, setTo] = useState(currentMonth.to)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [includeDeactivated, setIncludeDeactivated] = useState(false)
  const [busy, setBusy] = useState<'totals' | 'entries' | null>(null)
  const [error, setError] = useState<unknown>(null)

  const visibleUsers = users.filter(
    (user) => user.role === 'employee' && (user.isActive || includeDeactivated),
  )
  const isSelected = (userId: string) => !!selected && selected.has(userId)
  const toggleUser = (userId: string) => {
    setSelected((current) => {
      if (!current) {
        return new Set(visibleUsers.filter((user) => user.id !== userId).map((user) => user.id))
      }
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // The preview shows exactly what the CSV will contain.
  const filter: ReportFilter = { from, to, users: selected ? [...selected] : undefined }
  const summary = useReportSummary(filter, open)
  const rows = summary.data?.summary ?? []
  const grandTotal = rows.reduce((sum, row) => sum + row.totalMinutes, 0)

  const chipClass = (on: boolean): string =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      on ? 'bg-brand-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50'
    }`
  const setMonth = (key: string) => {
    const range = monthKeyToRange(key)
    setFrom(range.from)
    setTo(range.to)
  }
  const isPreset = (key: string) => {
    const range = monthKeyToRange(key)
    return from === range.from && to === range.to
  }

  const run = async (kind: 'totals' | 'entries') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'totals') {
        const data = await fetchReportSummary(filter)
        downloadCsv(`nuvolau-hours-${from}_${to}.csv`, summaryCsvTable(data.summary, csvLabels(t)))
      } else {
        const data = await fetchReportDetail(filter)
        downloadCsv(`nuvolau-entries-${from}_${to}.csv`, detailCsvTable(data.rows, csvDetailLabels(t)))
      }
      onClose()
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <Dialog open onClose={onClose} title={t.owner.totalsTitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setMonth(today.slice(0, 7))} className={chipClass(isPreset(today.slice(0, 7)))}>
            {t.owner.thisMonth}
          </button>
          <button onClick={() => setMonth(shiftMonthKey(today.slice(0, 7), -1))} className={chipClass(isPreset(shiftMonthKey(today.slice(0, 7), -1)))}>
            {t.owner.lastMonth}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.owner.from}>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                const value = e.target.value
                if (value) setFrom(value)
              }}
            />
          </Field>
          <Field label={t.owner.to}>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                const value = e.target.value
                if (value) setTo(value)
              }}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setSelected(null)} className={chipClass(!selected)}>
            {t.owner.allActive}
          </button>
          <button onClick={() => setIncludeDeactivated((on) => !on)} className={chipClass(includeDeactivated)}>
            {t.owner.includeDeactivated}
          </button>
          {visibleUsers.map((user) => (
            <button key={user.id} onClick={() => toggleUser(user.id)} className={chipClass(isSelected(user.id))}>
              {user.displayName}
            </button>
          ))}
        </div>

        {/* Live preview of the totals the CSV will contain */}
        {summary.isPending ? (
          <div className="grid place-items-center py-6">
            <Spinner className="size-6 text-stone-300" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">{t.owner.emptySummary}</p>
        ) : (
          <div className="overflow-hidden rounded-xl ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-3 py-2 font-medium">{t.owner.colName}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.owner.colDays}</th>
                  <th className="px-3 py-2 text-right font-medium">{t.owner.colHours}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr key={row.userId} className={row.isActive ? '' : 'text-stone-400'}>
                    <td className="max-w-[10rem] truncate px-3 py-2">
                      {row.displayName}
                      {!row.isActive && (
                        <span className="ml-2 text-[11px]">{t.owner.inactive}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{row.dayCount}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                      {formatDuration(row.totalMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 bg-stone-50">
                  <td colSpan={2} className="px-3 py-2 font-medium">
                    {t.owner.allEmployees}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {formatDuration(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <ErrorNote error={error ?? summary.error} />

        <div className="flex flex-col gap-2">
          <Button busy={busy === 'totals'} disabled={busy !== null} onClick={() => void run('totals')}>
            {t.owner.exportTotals}
          </Button>
          <Button
            variant="secondary"
            busy={busy === 'entries'}
            disabled={busy !== null}
            onClick={() => void run('entries')}
          >
            {t.owner.exportEntries}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
