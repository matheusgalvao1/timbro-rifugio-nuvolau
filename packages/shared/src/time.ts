/**
 * All work times live in a single wall-clock timezone (the rifugio's).
 * Entries are stored as `YYYY-MM-DD` + `HH:mm` strings — never timestamps —
 * so DST shifts and off-by-one day problems don't exist by construction.
 */
export const TIMEZONE = 'Europe/Rome'

/** Sentinel end-of-day time produced when a timer split across midnight. */
export const MIDNIGHT = '24:00'
const MIDNIGHT_MINUTES = 24 * 60

export function isMidnight(t: string): boolean {
  return t === MIDNIGHT
}

export function hhmmToMinutes(t: string): number {
  if (t === MIDNIGHT) return MIDNIGHT_MINUTES
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Duration as `H:MM` (e.g. `132:40`), how the app displays totals. */
export function formatDuration(minutes: number): string {
  return minutesToHHmm(Math.max(0, minutes))
}

/** Decimal hours with 2 decimals (e.g. `132.67`), for CSV/payroll math. */
export function decimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function entryMinutes(start: string, end: string): number {
  return hhmmToMinutes(end) - hhmmToMinutes(start)
}

export function compareTimes(a: string, b: string): number {
  return hhmmToMinutes(a) - hhmmToMinutes(b)
}

/**
 * Date literals are ordered lexicographically; we keep the helper so call
 * sites read intent instead of raw `<`/`>` on strings.
 */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function addDays(date: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function monthDaysRange(date: string): { from: string; to: string } {
  const [y = 1970, m = 1] = date.split('-').map(Number)
  const from = `${date.slice(0, 7)}-01`
  const last = new Date(Date.UTC(y, m, 0))
  const to = `${date.slice(0, 7)}-${String(last.getUTCDate()).padStart(2, '0')}`
  return { from, to }
}
