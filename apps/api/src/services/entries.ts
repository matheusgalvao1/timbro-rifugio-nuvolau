import { and, eq, isNull } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { timeEntries, type TimeEntryRow } from '@nuvolau/db'
import {
  MIDNIGHT,
  addDays,
  compareDates,
  compareTimes,
  hhmmToMinutes,
} from '@nuvolau/shared'
import { AppError } from '../lib/errors'
import type { Db } from '../lib/d1'

export function overlapError(existing: { startTime: string; endTime: string | null }): AppError {
  return new AppError(
    'OVERLAP',
    409,
    `Overlaps an existing entry (${existing.startTime}–${existing.endTime ?? 'still running'})`,
  )
}

/** The single entry still open for a user — work day or pause, at most one. */
export async function getRunningEntry(db: Db, userId: string): Promise<TimeEntryRow | undefined> {
  const [row] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endTime)))
  return row
}

/**
 * Rejects a candidate `start–end` span on `workDate` that overlaps another
 * entry of the same person. A still-running entry occupies start…23:59.
 */
export async function assertNoOverlap(
  db: Db,
  userId: string,
  workDate: string,
  start: string,
  end: string,
  ignoreEntryId?: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), eq(timeEntries.workDate, workDate)))
  const candidateStart = hhmmToMinutes(start)
  const candidateEnd = hhmmToMinutes(end)
  for (const row of rows) {
    if (row.id === ignoreEntryId) continue
    const rowStart = hhmmToMinutes(row.startTime)
    const rowEnd = row.endTime ? hhmmToMinutes(row.endTime) : hhmmToMinutes('23:59')
    if (candidateStart < rowEnd && rowStart < candidateEnd) throw overlapError(row)
  }
}

export type Segment = { workDate: string; startTime: string; endTime: string }

/**
 * Splits a span that may cross midnight into per-day rows, ending each day at
 * `24:00` so no minute is lost. `endDate` must be >= `startDate`.
 */
export function splitAcrossDays(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): Segment[] {
  if (compareDates(endDate, startDate) < 0) {
    throw new AppError('VALIDATION', 400, 'End cannot be before the start')
  }
  if (endDate === startDate) {
    if (compareTimes(endTime, startTime) < 0) {
      throw new AppError('VALIDATION', 400, 'End time must be after the start time')
    }
    return [{ workDate: startDate, startTime, endTime }]
  }
  const segments: Segment[] = [{ workDate: startDate, startTime, endTime: MIDNIGHT }]
  let day = addDays(startDate, 1)
  while (day < endDate) {
    segments.push({ workDate: day, startTime: '00:00', endTime: MIDNIGHT })
    day = addDays(day, 1)
  }
  if (endTime !== '00:00') {
    segments.push({ workDate: endDate, startTime: '00:00', endTime })
  }
  return segments
}

export type OpenRunningInput = {
  workDate: string
  startTime: string
  kind: 'work' | 'pause'
  source: 'manual' | 'timer'
}

/** Opens a new running entry; rejects if one is already open or it overlaps. */
export async function openRunningEntry(
  db: Db,
  userId: string,
  input: OpenRunningInput,
): Promise<TimeEntryRow> {
  if (await getRunningEntry(db, userId)) {
    throw new AppError('RUNNING_EXISTS', 409, 'An entry is already running')
  }
  // While it runs, reserve start..24:00 so nothing new overlaps it.
  await assertNoOverlap(db, userId, input.workDate, input.startTime, MIDNIGHT)
  const now = new Date()
  const [row] = await db
    .insert(timeEntries)
    .values({
      id: crypto.randomUUID(),
      userId,
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: null,
      kind: input.kind,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return row!
}

/**
 * Closes a running entry at the given instant, splitting per-day if needed;
 * inherits the entry's kind/source for the extra day rows.
 */
export async function closeRunningAt(
  db: Db,
  userId: string,
  running: TimeEntryRow,
  endDate: string,
  endTime: string,
): Promise<void> {
  const segments = splitAcrossDays(running.workDate, running.startTime, endDate, endTime)
  for (const [index, segment] of segments.entries()) {
    await assertNoOverlap(
      db,
      userId,
      segment.workDate,
      segment.startTime,
      segment.endTime,
      index === 0 ? running.id : undefined,
    )
  }
  const now = new Date()
  const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    db
      .update(timeEntries)
      .set({ endTime: segments[0]!.endTime, updatedAt: now })
      .where(eq(timeEntries.id, running.id)),
  ]
  for (const segment of segments.slice(1)) {
    statements.push(
      db.insert(timeEntries).values({
        id: crypto.randomUUID(),
        userId,
        workDate: segment.workDate,
        startTime: segment.startTime,
        endTime: segment.endTime,
        kind: running.kind,
        source: running.source,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }
  await db.batch(statements)
}
