import { useMemo, useState } from 'react'
import type { TimeEntry } from '@nuvolau/shared'
import { decimalHours, entryMinutes, formatDuration } from '@nuvolau/shared'
import { useDeleteEntry, useEntries } from '../api/hooks'
import { currentMonthKey, formatDayLabel, formatMonthLabel, monthKeyToRange, shiftMonthKey, romeNow } from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { TimerCard } from '../components/TimerCard'
import { EntryDialog } from '../components/EntryDialog'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorNote,
  Spinner,
  type ConfirmState,
} from '../components/ui'
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/icons'

export function EmployeePage() {
  const { t, lang } = useT()
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const range = useMemo(() => monthKeyToRange(monthKey), [monthKey])
  const entriesQuery = useEntries(range.from, range.to)
  const deleteEntry = useDeleteEntry()

  const [entryDialog, setEntryDialog] = useState<{ mode: 'create' | TimeEntry; defaultDate?: string } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const entries = entriesQuery.data?.entries ?? []
  const today = romeNow().date

  const totalMinutes = entries.reduce((sum, entry) => (entry.endTime ? sum + entryMinutes(entry.startTime, entry.endTime) : sum), 0)

  const groups = useMemo(() => {
    const byDate = new Map<string, TimeEntry[]>()
    for (const entry of [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const list = byDate.get(entry.workDate) ?? []
      list.push(entry)
      byDate.set(entry.workDate, list)
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  const dayLabel = (date: string): string =>
    date === today ? t.employee.today : date === previousOf(today) ? t.employee.yesterday : formatDayLabel(date, lang)
  const previousOf = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    const previous = new Date(Date.UTC(y!, m! - 1, d! - 1))
    return previous.toISOString().slice(0, 10)
  }

  const confirmDelete = (entry: TimeEntry) => {
    setConfirm({
      title: t.employee.deleteEntryTitle,
      body: t.employee.deleteEntryBody,
      confirmLabel: t.delete,
      danger: true,
      onConfirm: () => deleteEntry.mutate(entry.id, { onSettled: () => setConfirm(null) }),
    })
  }

  return (
    <div className="space-y-4">
      <TimerCard />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
            className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            aria-label="previous month"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h2 className="text-[15px] font-semibold capitalize">{formatMonthLabel(monthKey, lang)}</h2>
          <button
            onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
            className="grid size-10 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            aria-label="next month"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-stone-100 pt-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">{t.employee.monthTotal}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{formatDuration(totalMinutes)}</p>
            <p className="text-xs text-stone-400">
              {decimalHours(totalMinutes)} {t.employee.decimalHours}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEntryDialog({ mode: 'create', defaultDate: today })}>
            <PlusIcon className="size-4" />
            {t.employee.addEntry}
          </Button>
        </div>
      </Card>

      {entriesQuery.isPending && (
        <div className="grid place-items-center py-10 text-stone-400">
          <Spinner />
        </div>
      )}
      <ErrorNote error={entriesQuery.error} />

      {groups.length === 0 && !entriesQuery.isPending && (
        <p className="py-8 text-center text-sm text-stone-400">{t.employee.noEntries}</p>
      )}

      <div className="space-y-4">
        {groups.map(([date, dayEntries]) => {
          const dayTotal = dayEntries.reduce((sum, entry) => (entry.endTime ? sum + entryMinutes(entry.startTime, entry.endTime) : sum), 0)
          return (
            <section key={date} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-stone-600">{dayLabel(date)}</h3>
                <span className="font-mono text-xs text-stone-400 tabular-nums">{formatDuration(dayTotal)}</span>
              </div>
              {dayEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEntryDialog({ mode: entry })}
                  onDelete={() => confirmDelete(entry)}
                />
              ))}
            </section>
          )
        })}
      </div>

      {entryDialog && (
        <EntryDialog
          mode={entryDialog.mode === 'create' ? { kind: 'create', defaultDate: entryDialog.defaultDate } : { kind: 'edit', entry: entryDialog.mode as TimeEntry }}
          onClose={() => setEntryDialog(null)}
        />
      )}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useT()
  const rowButton =
    'grid size-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700'
  return (
    <Card className="flex items-center gap-2 !py-2.5">
      <div className="flex min-w-0 items-center gap-2.5 font-mono text-[15px] tabular-nums">
        <span>
          {entry.startTime} – {entry.endTime ?? '…'}
        </span>
        <Badge tone={entry.endTime ? 'neutral' : 'good'}>
          {entry.endTime ? formatDuration(entryMinutes(entry.startTime, entry.endTime)) : t.employee.running}
        </Badge>
        <span className="sr-only">{t.employee[entry.source === 'manual' ? 'manualEntry' : 'timerEntry']}</span>
      </div>
      <div className="ml-auto flex items-center">
        <button onClick={onEdit} className={rowButton} aria-label={t.edit}>
          <PencilIcon className="size-4" />
        </button>
        <button onClick={onDelete} className={rowButton} aria-label={t.delete}>
          <TrashIcon className="size-4" />
        </button>
      </div>
    </Card>
  )
}
