import { useState } from 'react'
import { formatDuration, monthDaysRange } from '@nuvolau/shared'
import { useReportSummary } from '../api/hooks'
import { monthKeyToRange, romeNow, shiftMonthKey } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Card, ErrorNote, Field, Input, Spinner } from './ui'

/**
 * Totals panel under the timesheet grid: the owner picks any date range (a
 * payroll period's edges are whatever she says) and sees each employee's
 * worked hours. Exports and per-employee filtering come later, once the
 * foundations settle.
 */
export function TotalsPanel() {
  const { t } = useT()
  const [today] = useState(() => romeNow().date)
  const [from, setFrom] = useState(() => monthDaysRange(today).from)
  const [to, setTo] = useState(() => monthDaysRange(today).to)

  const summary = useReportSummary({ from, to })
  const rows = summary.data?.summary ?? []

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

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700">{t.owner.totalsTitle}</h2>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMonth(today.slice(0, 7))} className={chipClass(isPreset(today.slice(0, 7)))}>
            {t.owner.thisMonth}
          </button>
          <button
            onClick={() => setMonth(shiftMonthKey(today.slice(0, 7), -1))}
            className={chipClass(isPreset(shiftMonthKey(today.slice(0, 7), -1)))}
          >
            {t.owner.lastMonth}
          </button>
        </div>
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
                <tr key={row.userId}>
                  <td className="max-w-[10rem] truncate px-3 py-2">{row.displayName}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{row.dayCount}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {formatDuration(row.totalMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ErrorNote error={summary.error} />
    </Card>
  )
}
