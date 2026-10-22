import { useState } from 'react'
import { monthDaysRange, type UserPublic } from '@nuvolau/shared'
import { fetchReportDetail, fetchReportSummary, type ReportFilter } from '../api/hooks'
import {
  detailCsvTable,
  downloadCsv,
  summaryCsvTable,
  type DetailCsvLabels,
  type SummaryCsvLabels,
} from '../lib/csv'
import { romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { Button, Dialog, ErrorNote, Field, Input } from './ui'

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
 * CSV export without a reports page: pick a period and (optionally) a subset
 * of employees, download totals or every entry. Launched from the day view.
 */
export function ReportExportDialog({
  open,
  users,
  onClose,
}: {
  open: boolean
  users: UserPublic[]
  onClose: () => void
}) {
  const { t } = useT()
  const [currentMonth] = useState(() => monthDaysRange(romeNow().date))
  const [from, setFrom] = useState(currentMonth.from)
  const [to, setTo] = useState(currentMonth.to)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [includeDeactivated, setIncludeDeactivated] = useState(false)
  const [busy, setBusy] = useState<'totals' | 'entries' | null>(null)
  const [error, setError] = useState<unknown>(null)

  if (!open) return null

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

  const run = async (kind: 'totals' | 'entries') => {
    setBusy(kind)
    setError(null)
    try {
      const filter: ReportFilter = { from, to, users: selected ? [...selected] : undefined }
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

  const chipClass = (on: boolean): string =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      on ? 'bg-brand-600 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50'
    }`

  return (
    <Dialog open onClose={onClose} title={t.owner.csvButton}>
      <div className="space-y-4">
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

        <ErrorNote error={error} />
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
