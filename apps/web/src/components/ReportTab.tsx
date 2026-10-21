import { useState } from 'react'
import type { ReportDetailRow, ReportSummaryRow, UserPublic } from '@nuvolau/shared'
import { decimalHours, formatDuration } from '@nuvolau/shared'
import {
  fetchReportDetail,
  useReportDetail,
  useReportSummary,
} from '../api/hooks'
import {
  currentMonthKey,
  formatDayLabel,
  formatMonthLabel,
  monthKeyToRange,
  shiftMonthKey,
} from '../lib/dateUtils'
import {
  detailCsvTable,
  downloadCsv,
  summaryCsvTable,
  type DetailCsvLabels,
  type SummaryCsvLabels,
} from '../lib/csv'
import { useT } from '../i18n/i18n'
import { Spinner } from './ui'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'

function csvLabels(t: ReturnType<typeof useT>['t']): SummaryCsvLabels {
  return {
    name: t.owner.colName,
    username: t.username,
    days: t.owner.colDays,
    entries: t.owner.colEntries,
    hours: `${t.owner.colHours} (h:mm)`,
    decimal: `${t.owner.colDecimal} h`,
  }
}

function csvDetailLabels(t: ReturnType<typeof useT>['t']): DetailCsvLabels {
  return { ...csvLabels(t), date: t.date }
}

/** Laptop-first report: period + employee chips + CSV exports. */
export function ReportTab({ users }: { users: UserPublic[] }) {
  const { t, lang } = useT()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const range = monthKeyToRange(monthKey)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [includeDeactivated, setIncludeDeactivated] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const visibleUsers = users.filter(
    (user) => user.role === 'employee' && (user.isActive || includeDeactivated),
  )
  const summary = useReportSummary({
    from: range.from,
    to: range.to,
    users: selected ? [...selected] : undefined,
  })
  const detail = useReportDetail(
    { from: range.from, to: range.to, users: expandedId ? [expandedId] : undefined },
    expandedId !== null,
  )
  const labels = csvLabels(t)
  const summaryRows = summary.data?.summary ?? []
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

  const exportTotals = () => {
    if (!summary.data) return
    downloadCsv(`nuvolau-hours-${range.from}_${range.to}.csv`, summaryCsvTable(summary.data.summary, labels))
  }

  const exportEntries = async () => {
    const data = await fetchReportDetail({
      from: range.from,
      to: range.to,
      users: selected ? [...selected] : undefined,
    })
    downloadCsv(`nuvolau-entries-${range.from}_${range.to}.csv`, detailCsvTable(data.rows, csvDetailLabels(t)))
  }

  const iconButton = 'grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-200/70'
  const csvButton =
    'inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} className={iconButton} aria-label="previous month">
            <ChevronLeftIcon className="size-5" />
          </button>
          <h2 className="w-44 text-center text-[15px] font-semibold capitalize">
            {formatMonthLabel(monthKey, lang)}
          </h2>
          <button onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} className={iconButton} aria-label="next month">
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportTotals} disabled={summary.isPending || summaryRows.length === 0} className={csvButton}>
            {t.owner.exportTotals}
          </button>
          <button onClick={() => void exportEntries()} disabled={summary.isPending} className={csvButton}>
            {t.owner.exportEntries}
          </button>
        </div>
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

      {summary.isPending ? (
        <LoadingPanel />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-2.5 font-medium">{t.owner.colName}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.owner.colDays}</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">{t.owner.colEntries}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.owner.colHours}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.owner.colDecimal}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <SummaryRowDesktop
                    key={row.userId}
                    row={row}
                    expanded={expandedId === row.userId}
                    onToggle={() => setExpandedId((id) => (id === row.userId ? null : row.userId))}
                  />
                ))}
                {summaryRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                      {t.owner.emptySummary}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 md:hidden">
            {summaryRows.map((row) => (
              <SummaryCardMobile
                key={row.userId}
                row={row}
                expanded={expandedId === row.userId}
                onToggle={() => setExpandedId((id) => (id === row.userId ? null : row.userId))}
                detailRows={detail.data?.rows ?? []}
                detailLoading={detail.isPending}
              />
            ))}
            {summaryRows.length === 0 && (
              <p className="py-8 text-center text-sm text-stone-400">{t.owner.emptySummary}</p>
            )}
          </div>

          {expandedId && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
              <DetailRows rows={detail.data?.rows ?? []} loading={detail.isPending} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function chipClass(on: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    on ? 'bg-brand-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50'
  }`
}

function SummaryRowDesktop({
  row,
  expanded,
  onToggle,
}: {
  row: ReportSummaryRow
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useT()
  return (
    <tr className="hover:bg-stone-50/50">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {row.displayName}
          {!row.isActive && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500">
              {t.owner.inactive}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{row.dayCount}</td>
      <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{row.entryCount}</td>
      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{formatDuration(row.totalMinutes)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{decimalHours(row.totalMinutes)}</td>
      <td className="px-2 py-2.5 text-right">
        <button
          onClick={onToggle}
          className="grid size-8 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label={expanded ? t.owner.hideDays : t.owner.viewDays}
        >
          <ChevronDownIcon className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </td>
    </tr>
  )
}

function SummaryCardMobile({
  row,
  expanded,
  onToggle,
  detailRows,
  detailLoading,
}: {
  row: ReportSummaryRow
  expanded: boolean
  onToggle: () => void
  detailRows: ReportDetailRow[]
  detailLoading: boolean
}) {
  const { t } = useT()
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
      <button className="flex w-full items-center justify-between gap-3" onClick={onToggle}>
        <div className="text-left">
          <p className="font-semibold">
            {row.displayName}
            {!row.isActive && (
              <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                {t.owner.inactive}
              </span>
            )}
          </p>
          <p className="text-xs text-stone-400">
            {row.dayCount} {t.owner.colDays.toLowerCase()} · {row.entryCount} {t.owner.colEntries.toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-semibold tabular-nums">{formatDuration(row.totalMinutes)}</p>
          <p className="text-xs tabular-nums text-stone-400">
            {decimalHours(row.totalMinutes)} {t.owner.colDecimal.toLowerCase()}
          </p>
        </div>
      </button>
      {expanded && <DetailRows rows={detailRows} loading={detailLoading} />}
    </div>
  )
}

/** Read-only day rows — shared by the desktop drill-down and mobile cards. */
function DetailRows({
  rows,
  loading,
}: {
  rows: ReportDetailRow[]
  loading: boolean
}) {
  const { lang } = useT()
  if (loading) return <Spinner className="mx-auto my-3 size-5 text-stone-300" />
  return (
    <div className="mt-3 w-full">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.entryId} className="border-b border-stone-100 last:border-0">
              <td className="py-1.5 pr-3 text-stone-500">{formatDayLabel(row.workDate, lang)}</td>
              <td className="py-1.5 font-mono tabular-nums">
                {row.startTime} – {row.endTime ?? '…'}
              </td>
              <td className="py-1.5 text-right font-mono font-medium tabular-nums">
                {row.minutes === null ? '' : formatDuration(row.minutes)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-3 text-center text-stone-400">—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="grid place-items-center rounded-2xl bg-white py-10 shadow-sm ring-1 ring-stone-200/70">
      <Spinner className="size-6 text-stone-300" />
    </div>
  )
}
