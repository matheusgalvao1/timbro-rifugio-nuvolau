import { TIMEZONE, hhmmToMinutes, monthDaysRange } from '@nuvolau/shared'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Today's date/time at the rifugio, regardless of the visitor's timezone. */
export function romeNow(now = new Date()): { date: string; time: string } {
  return { date: dateFormatter.format(now), time: timeFormatter.format(now) }
}

/** Whole-day index since the epoch — for absolute minute math across days. */
export function dayNumber(date: string): number {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Absolute wall-clock minutes since epoch in Europe/Rome (for elapsed time). */
export function absoluteRomeMinutes(date: string, time: string): number {
  return dayNumber(date) * 1440 + hhmmToMinutes(time)
}

/** Month key like `2026-10` for the month browser state. */
export function currentMonthKey(): string {
  return romeNow().date.slice(0, 7)
}

export function shiftMonthKey(key: string, delta: number): string {
  const [y = 1970, m = 1] = key.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1 + delta, 1))
  return shifted.toISOString().slice(0, 7)
}

export function monthKeyToRange(key: string): { from: string; to: string } {
  return monthDaysRange(`${key}-01`)
}

function locale(lang: string): string {
  return lang === 'it' ? 'it-IT' : 'en-GB'
}

/** e.g. "Wed 22 Oct 2026" — for the owner's day header. */
export function formatDateLabelFull(date: string, lang: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Weekday + day/month for timesheet column headers ("Wed" / "22 Oct"). */
export function formatDayParts(date: string, lang: string): { weekday: string; day: string; month: string } {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  // String-derived date literals are formatted in UTC — local zones shift the day.
  return {
    weekday: utc.toLocaleDateString(locale(lang), { weekday: 'short', timeZone: 'UTC' }),
    day: utc.toLocaleDateString(locale(lang), { day: 'numeric', timeZone: 'UTC' }),
    month: utc.toLocaleDateString(locale(lang), { month: 'short', timeZone: 'UTC' }),
  }
}

export function formatMonthLabel(monthKey: string, lang: string): string {
  const [y = 1970, m = 1] = monthKey.split('-').map(Number)
  // String-derived date literals are formatted in UTC — local zones shift the day.
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(lang), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDayLabel(date: string, lang: string): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** ISO date input min/max/etc helpers use plain strings; no Date objects needed. */
export function slugUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)
}
