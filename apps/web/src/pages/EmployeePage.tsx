import { useMemo, useRef, useState } from 'react'
import {
  addDays,
  compareDates,
  decimalHours,
  entryMinutes,
  formatDuration,
  type TimeEntry,
} from '@nuvolau/shared'
import { useDeleteEntry, useEntries, useRunningTimer } from '../api/hooks'
import {
  absoluteRomeMinutes,
  formatDayLabel,
  formatMonthLabel,
  monthKeyToRange,
  romeNow,
  shiftMonthKey,
} from '../lib/dateUtils'
import { useT } from '../i18n/i18n'
import { DayActions } from '../components/DayActions'
import { EntryDialog } from '../components/EntryDialog'
import { MonthCalendar } from '../components/MonthCalendar'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, ConfirmDialog, ErrorNote, type ConfirmState } from '../components/ui'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons'

function sumWorkMinutes(entries: TimeEntry[]): number {
  return entries.reduce(
    (sum, entry) =>
      entry.endTime && entry.kind === 'work' ? sum + entryMinutes(entry.startTime, entry.endTime) : sum,
    0,
  )
}

/**
 * Employee home: one focused day, swipeable (left = previous day, right =
 * next; today is the rightmost edge), with a calendar for the bigger picture.
 * No ticking timer — the day's entries themselves show what is registered.
 */
export function EmployeePage() {
  const { t, lang } = useT()
  const today = romeNow().date
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<'day' | 'month'>('day')
  const [browseMonth, setBrowseMonth] = useState(today.slice(0, 7))
  const runningTimer = useRunningTimer()
  const running = runningTimer.data?.entry ?? null
  const deleteEntry = useDeleteEntry()
  const [entryDialog, setEntryDialog] = useState<
    { mode: 'create'; defaultDate?: string } | { mode: TimeEntry } | null
  >(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const toast = useToast()

  const selectedMonth = monthKeyToRange(selectedDate.slice(0, 7))
  const selectedMonthQuery = useEntries(selectedMonth.from, selectedMonth.to)
  const browseRange = monthKeyToRange(browseMonth)
  const browseMonthQuery = useEntries(browseRange.from, browseRange.to)

  const go = (delta: number) => {
    const next = addDays(selectedDate, delta)
    if (compareDates(next, today) > 0) return
    setSelectedDate(next)
  }

  // Swipe: left = previous day, right = next day (today is the boundary).
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? -1 : 1)
  }

  const isToday = selectedDate === today
  const dayEntries = useMemo(
    () =>
      (selectedMonthQuery.data?.entries ?? [])
        .filter((entry) => entry.workDate === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [selectedMonthQuery.data, selectedDate],
  )
  const selectedMonthMinutes = sumWorkMinutes(selectedMonthQuery.data?.entries ?? [])
  const browseMonthMinutes = sumWorkMinutes(browseMonthQuery.data?.entries ?? [])

  const navButton =
    'grid size-10 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-30'

  const openCalendar = () => {
    setBrowseMonth(selectedDate.slice(0, 7))
    setView('month')
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

  if (view === 'month') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setBrowseMonth(shiftMonthKey(browseMonth, -1))}
            className={navButton}
            aria-label="previous month"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <h2 className="text-[15px] font-semibold capitalize">{formatMonthLabel(browseMonth, lang)}</h2>
          <button
            onClick={() => setBrowseMonth(shiftMonthKey(browseMonth, 1))}
            className={navButton}
            aria-label="next month"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>

        <Card>
          <MonthCalendar
            monthKey={browseMonth}
            lang={lang}
            today={today}
            selected={selectedDate}
            entries={browseMonthQuery.data?.entries ?? []}
            onPick={(date) => {
              setSelectedDate(date)
              setBrowseMonth(date.slice(0, 7))
              setView('day')
            }}
          />
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">{t.employee.monthTotal}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{formatDuration(browseMonthMinutes)}</p>
            <p className="text-xs text-stone-400">
              {decimalHours(browseMonthMinutes)} {t.employee.decimalHours}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setView('day')}>
            {t.employee.backToDay}
          </Button>
        </Card>

        {toast.node}
        <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      </div>
    )
  }

  const runningElapsed =
    running
      ? Math.max(
          0,
          (() => {
            const now = romeNow()
            return (
              absoluteRomeMinutes(now.date, now.time) -
              absoluteRomeMinutes(running.workDate, running.startTime)
            )
          })(),
        )
      : 0

  return (
    <div className="select-none space-y-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Day navigation */}
      <div className="flex items-center gap-1">
        <button onClick={() => go(-1)} className={navButton} aria-label="previous day">
          <ChevronLeftIcon className="size-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold capitalize">
          {isToday ? `${t.employee.today} · ${formatDayLabel(selectedDate, lang)}` : formatDayLabel(selectedDate, lang)}
        </h2>
        <button onClick={() => go(1)} disabled={isToday} className={navButton} aria-label="next day">
          <ChevronRightIcon className="size-5" />
        </button>
        <button onClick={openCalendar} className={navButton} title={t.employee.viewMonth} aria-label={t.employee.viewMonth}>
          <CalendarIcon className="size-5" />
        </button>
      </div>

      {/* Quick actions — only meaningful on today's view */}
      {isToday && (
        <Card className="space-y-3">
          <DayActions running={running} onRegistered={() => toast.show(t.employee.registered)} />
          {!running && <p className="text-center text-xs text-stone-400">{t.employee.ownerViewNote}</p>}
        </Card>
      )}
      {running && runningElapsed > 16 * 60 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
          {t.employee.longRunning}
        </p>
      )}

      {/* The day's entries — the source of truth */}
      <Card className="!p-0">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-stone-400">{t.employee.monthTotal}</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatDuration(sumWorkMinutes(dayEntries))}
          </span>
        </div>
        {selectedMonthQuery.isPending ? (
          <div className="py-8 text-center text-sm text-stone-400">…</div>
        ) : dayEntries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-400">{t.employee.noEntries}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {dayEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                isToday={isToday}
                onEdit={() => setEntryDialog({ mode: entry })}
                onDelete={() => confirmDelete(entry)}
              />
            ))}
          </div>
        )}
        <div className="border-t border-stone-100 p-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setEntryDialog({ mode: 'create', defaultDate: selectedDate })}
          >
            <PlusIcon className="size-4" />
            {t.employee.addEntry}
          </Button>
        </div>
      </Card>
      <ErrorNote error={selectedMonthQuery.error} />

      {/* Bigger picture: this month at a glance */}
      <button
        onClick={openCalendar}
        className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200/70 transition hover:bg-stone-50"
      >
        <span className="text-sm font-medium text-stone-600 capitalize">
          {formatMonthLabel(selectedDate.slice(0, 7), lang)}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatDuration(selectedMonthMinutes)}
        </span>
      </button>

      {entryDialog && (
        <EntryDialog
          mode={entryDialog.mode === 'create' ? { kind: 'create', defaultDate: entryDialog.defaultDate } : { kind: 'edit', entry: entryDialog.mode as TimeEntry }}
          onClose={() => setEntryDialog(null)}
        />
      )}
      {toast.node}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

function EntryRow({
  entry,
  isToday,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry
  isToday: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useT()
  const rowButton =
    'grid size-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700'
  const isPause = entry.kind === 'pause'
  const isRunning = !entry.endTime
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${isPause ? 'text-stone-400' : ''}`}>
      <div className="flex min-w-0 items-center gap-2.5 font-mono text-[15px] tabular-nums">
        <span>
          {entry.startTime} – {entry.endTime ?? '…'}
        </span>
        {isPause && <Badge tone="muted">{t.employee.pauseBadge}</Badge>}
        {isRunning && <Badge tone="good">{t.employee.running}</Badge>}
      </div>
      <div className="ml-auto flex items-center">
        {isRunning && isToday && (
          <button onClick={onEdit} className="mr-1 rounded-full px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
            {t.employee.startedEarlier}
          </button>
        )}
        <button onClick={onEdit} className={rowButton} aria-label={t.edit}>
          <PencilIcon className="size-4" />
        </button>
        <button onClick={onDelete} className={rowButton} aria-label={t.delete}>
          <TrashIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
