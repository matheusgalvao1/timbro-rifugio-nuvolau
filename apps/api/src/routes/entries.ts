import { Hono } from 'hono'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { z } from 'zod'
import {
  MIDNIGHT,
  compareDates,
  compareTimes,
  dateSchema,
  entryCreateSchema,
  entryUpdateSchema,
  monthDaysRange,
  timerStartSchema,
  timerStopSchema,
  type TimeEntry,
} from '@nuvolau/shared'
import { timeEntries, type TimeEntryRow } from '@nuvolau/db'
import { validateJson, validateQuery } from '../lib/validate'
import { AppError, errNotFound, errValidation } from '../lib/errors'
import { romeNow } from '../lib/rome'
import { requireAuth, requireEmployee } from '../middleware/auth'
import { assertNoOverlap, getRunningEntry, splitAcrossDays } from '../services/entries'
import type { HonoEnv } from '../env'

const rangeQuery = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

function futureTime(message: string): AppError {
  return new AppError('FUTURE_TIME', 400, message)
}

function toApi(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    workDate: row.workDate,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
    source: row.source,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export const entriesRoutes = new Hono<HonoEnv>()

entriesRoutes.get('/', requireAuth, validateQuery(rangeQuery), async (c) => {
  const user = c.get('user')
  const { from, to } = c.req.valid('query')
  const today = romeNow().date
  const month = monthDaysRange(today)
  const fromDate = from ?? month.from
  const toDate = to ?? month.to
  if (fromDate > toDate) throw errValidation('from must be on or before to')
  const rows = await c
    .get('db')
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        gte(timeEntries.workDate, fromDate),
        lte(timeEntries.workDate, toDate),
      ),
    )
    .orderBy(desc(timeEntries.workDate), desc(timeEntries.startTime))
  return c.json({ entries: rows.map(toApi), from: fromDate, to: toDate })
})

entriesRoutes.get('/running', requireEmployee, async (c) => {
  const row = await getRunningEntry(c.get('db'), c.get('user').id)
  return c.json({ entry: row ? toApi(row) : null })
})

entriesRoutes.post('/', requireEmployee, validateJson(entryCreateSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  const today = romeNow().date
  if (compareDates(body.workDate, today) > 0) {
    throw futureTime('Cannot log time for a future day')
  }
  await assertNoOverlap(db, user.id, body.workDate, body.startTime, body.endTime)
  const now = new Date()
  const [row] = await db
    .insert(timeEntries)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      workDate: body.workDate,
      startTime: body.startTime,
      endTime: body.endTime,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return c.json({ entry: toApi(row!) })
})

entriesRoutes.patch('/:id', requireEmployee, validateJson(entryUpdateSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const entryId = c.req.param('id')
  const body = c.req.valid('json')
  const [row] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, user.id)))
  if (!row) throw errNotFound('Entry not found')

  const workDate = body.workDate ?? row.workDate
  const startTime = body.startTime ?? row.startTime
  const endTime = body.endTime ?? row.endTime
  const today = romeNow().date
  if (compareDates(workDate, today) > 0) throw futureTime('Cannot log time for a future day')
  if (endTime) {
    if (compareTimes(endTime, startTime) < 0) {
      throw errValidation('End time must be after the start time')
    }
    await assertNoOverlap(db, user.id, workDate, startTime, endTime, row.id)
  } else {
    // Still running: reserve the rest of the day from its start.
    await assertNoOverlap(db, user.id, workDate, startTime, MIDNIGHT, row.id)
  }
  const [updated] = await db
    .update(timeEntries)
    .set({ workDate, startTime, endTime, updatedAt: new Date() })
    .where(eq(timeEntries.id, row.id))
    .returning()
  return c.json({ entry: toApi(updated!) })
})

entriesRoutes.delete('/:id', requireEmployee, async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const entryId = c.req.param('id')
  const rows = await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, user.id)))
    .returning({ id: timeEntries.id })
  if (rows.length === 0) throw errNotFound('Entry not found')
  return c.json({ ok: true })
})

entriesRoutes.post('/start', requireEmployee, validateJson(timerStartSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  if (await getRunningEntry(db, user.id)) {
    throw new AppError('RUNNING_EXISTS', 409, 'A timer is already running')
  }
  const { date: today, time: nowTime } = romeNow()
  const workDate = body.workDate ?? today
  const startTime = body.startTime ?? nowTime
  if (compareDates(workDate, today) > 0) throw futureTime('Cannot start in the future')
  if (workDate === today && compareTimes(startTime, nowTime) > 0) {
    throw futureTime('Cannot start in the future')
  }
  // While it runs, reserve start..24:00 so nothing new overlaps it.
  await assertNoOverlap(db, user.id, workDate, startTime, MIDNIGHT)
  const now = new Date()
  const [row] = await db
    .insert(timeEntries)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      workDate,
      startTime,
      endTime: null,
      source: 'timer',
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return c.json({ entry: toApi(row!) })
})

entriesRoutes.post('/stop', requireEmployee, validateJson(timerStopSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  const running = await getRunningEntry(db, user.id)
  if (!running) throw new AppError('RUNNING_MISSING', 409, 'No timer is running')
  const { date: today, time: nowTime } = romeNow()
  const endDate = body.endDate ?? today
  const endTime = body.endTime ?? nowTime
  if (compareDates(endDate, running.workDate) < 0) {
    throw errValidation('The timer started after that; set an earlier start on the entry instead')
  }
  if (compareDates(endDate, today) > 0) throw futureTime('Cannot stop in the future')
  if (endDate === today && compareTimes(endTime, nowTime) > 0) {
    throw futureTime('Cannot stop in the future')
  }
  const segments = splitAcrossDays(running.workDate, running.startTime, endDate, endTime)
  for (const [index, segment] of segments.entries()) {
    await assertNoOverlap(
      db,
      user.id,
      segment.workDate,
      segment.startTime,
      segment.endTime,
      index === 0 ? running.id : undefined,
    ).catch(() => {
      throw new AppError(
        'OVERLAP',
        409,
        'The timer ran across days that already have logged hours. Stop it on its start day (set that date in the stop dialog), or remove the conflicting entries first.',
      )
    })
  }
  const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    db
      .update(timeEntries)
      .set({ endTime: segments[0]!.endTime, updatedAt: new Date() })
      .where(eq(timeEntries.id, running.id)),
  ]
  const now = new Date()
  for (const segment of segments.slice(1)) {
    statements.push(
      db.insert(timeEntries).values({
        id: crypto.randomUUID(),
        userId: user.id,
        workDate: segment.workDate,
        startTime: segment.startTime,
        endTime: segment.endTime,
        source: running.source,
        createdAt: now,
        updatedAt: now,
      }),
    )
  }
  await db.batch(statements)
  return c.json({ ok: true })
})
