import { useMemo } from 'react'
import {
  addDays,
  compareDates,
  entryMinutes,
  formatDuration,
  monthDaysRange,
} from '@nuvolau/shared'

/** Minimal shape both TimeEntry and report detail rows satisfy. */
export interface CalendarEntry {
  workDate: string
  startTime: string
  endTime: string | null
  kind: 'work' | 'pause'
}

/**
 * Monday-first month grid. Days with entries are shaded and show their
 * work total; a tiny amber dot marks pause activity. Future days are inert.
 */
export function MonthCalendar({
  monthKey,
  lang,
  today,
  selected,
  entries,
  onPick,
}: {
  monthKey: string
  lang: string
  today: string
  selected?: string
  entries: CalendarEntry[]
  onPick: (date: string) => void
}) {
  const { from, to } = monthDaysRange(`${monthKey}-01`)
  const [y = 1970, m = 1] = monthKey.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay() // 0 = Sunday
  const offset = (firstWeekday + 6) % 7 // Monday-first

  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map((index) =>
    // UTC: these are pure date-literal labels; local zones shift the day.
    new Date(Date.UTC(2024, 0, 1 + index)).toLocaleDateString(locale(lang), {
      weekday: 'short',
      timeZone: 'UTC',
    }),
  )

  const stats = useMemo(() => {
    const map = new Map<string, { minutes: number; hasAny: boolean; hasPause: boolean }>()
    for (const entry of entries) {
      if (compareDates(entry.workDate, from) < 0 || compareDates(entry.workDate, to) > 0) continue
      const stat = map.get(entry.workDate) ?? { minutes: 0, hasAny: false, hasPause: false }
      stat.hasAny = true
      if (entry.kind === 'pause') stat.hasPause = true
      if (entry.endTime && entry.kind === 'work') {
        stat.minutes += entryMinutes(entry.startTime, entry.endTime)
      }
      map.set(entry.workDate, stat)
    }
    return map
  }, [entries, from, to])

  const days: string[] = []
  let day = from
  while (compareDates(day, to) <= 0) {
    days.push(day)
    day = addDays(day, 1)
  }

  const cellBase =
    'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition'
  const cellTone = (date: string): string => {
    if (compareDates(date, today) > 0) return 'pointer-events-none opacity-25 text-stone-400'
    if (date === selected) return 'bg-brand-600 text-white'
    if (date === today) return 'ring-2 ring-brand-500/70 text-stone-700'
    if (stats.get(date)?.hasAny) return 'bg-brand-50 text-brand-700 hover:bg-brand-100'
    return 'text-stone-600 hover:bg-stone-100'
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdayLabels.map((label, index) => (
        <div
          key={`${label}-${index}`}
          className="grid aspect-square place-items-center text-[10px] uppercase tracking-wide text-stone-400"
        >
          {label}
        </div>
      ))}
      {Array.from({ length: offset }, (_, index) => (
        <div key={`pad-${index}`} />
      ))}
      {days.map((date) => {
        const stat = stats.get(date)
        const minutes = stat?.minutes ?? 0
        return (
          <button key={date} onClick={() => onPick(date)} className={`${cellBase} ${cellTone(date)}`}>
            <span className="leading-none">{Number(date.slice(8, 10))}</span>
            {minutes > 0 && (
              <span className="font-mono text-[10px] leading-none opacity-80">
                {formatDuration(minutes)}
              </span>
            )}
            {stat?.hasPause && <span className="absolute right-1.5 top-1.5 size-1 rounded-full bg-amber-400" />}
          </button>
        )
      })}
    </div>
  )
}

function locale(lang: string): string {
  return lang === 'it' ? 'it-IT' : 'en-GB'
}
