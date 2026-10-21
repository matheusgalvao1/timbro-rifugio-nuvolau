import { Hono } from 'hono'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import {
  MIDNIGHT,
  compareDates,
  compareTimes,
  dateSchema,
  entryCreateSchema,
  entryUpdateSchema,
  monthDaysRange,
  pauseSchema,
  resumeSchema,
  timerStartSchema,
  timerStopSchema,
  type TimeEntry,
} from '@nuvolau/shared'
import { timeEntries, type TimeEntryRow } from '@nuvolau/db'
import { validateJson, validateQuery } from '../lib/validate'
import { AppError, errNotFound, errValidation } from '../lib/errors'
import { romeNow } from '../lib/rome'
import { requireAuth, requireEmployee } from '../middleware/auth'
import {
  assertNoOverlap,
  closeRunningAt,
  getRunningEntry,
  openRunningEntry,
} from '../services/entries'
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
    kind: row.kind,
    source: row.source,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

/**
 * The workday state machine behind the four quick actions:
 *   idle          → /start (work) or /pause (direct pause)
 *   work running  → /pause (closes work, opens pause) or /stop (finish day)
 *   pause running → /resume (closes pause, reopens work) or /stop
 * Every action accepts a custom date/time so forgotten clock-ins can be
 * registered correctly after the fact.
 */
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
      kind: body.kind ?? 'work',
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
  const kind = body.kind ?? row.kind
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
    .set({ workDate, startTime, endTime, kind, updatedAt: new Date() })
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

/** Begin the workday (optionally backdated: "I actually started at 8"). */
entriesRoutes.post('/start', requireEmployee, validateJson(timerStartSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { date: today, time: nowTime } = romeNow()
  const workDate = body.workDate ?? today
  const startTime = body.startTime ?? nowTime
  if (compareDates(workDate, today) > 0) throw futureTime('Cannot start in the future')
  if (workDate === today && compareTimes(startTime, nowTime) > 0) {
    throw futureTime('Cannot start in the future')
  }
  const entry = await openRunningEntry(db, user.id, {
    workDate,
    startTime,
    kind: 'work',
    source: 'timer',
  })
  return c.json({ entry: toApi(entry) })
})

/** Start a pause: closes a running workday at that instant, opens a pause. */
entriesRoutes.post('/pause', requireEmployee, validateJson(pauseSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { date: today, time: nowTime } = romeNow()
  const workDate = body.workDate ?? today
  const startTime = body.startTime ?? nowTime
  if (compareDates(workDate, today) > 0) throw futureTime('Cannot pause in the future')
  if (workDate === today && compareTimes(startTime, nowTime) > 0) {
    throw futureTime('Cannot pause in the future')
  }
  const running = await getRunningEntry(db, user.id)
  if (running?.kind === 'pause') {
    throw new AppError('RUNNING_EXISTS', 409, 'The pause is already running')
  }
  if (running) {
    // The pause must begin after the work it interrupts.
    if (compareDates(workDate, running.workDate) < 0) {
      throw errValidation('The pause cannot start before the workday')
    }
    if (workDate === running.workDate && compareTimes(startTime, running.startTime) < 0) {
      throw errValidation('The pause cannot start before the workday')
    }
    await closeRunningAt(db, user.id, running, workDate, startTime)
  }
  const entry = await openRunningEntry(db, user.id, {
    workDate,
    startTime,
    kind: 'pause',
    source: 'timer',
  })
  return c.json({ entry: toApi(entry) })
})

/** End a pause: closes it and resumes the workday from that instant. */
entriesRoutes.post('/resume', requireEmployee, validateJson(resumeSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { date: today, time: nowTime } = romeNow()
  const endDate = body.endDate ?? today
  const endTime = body.endTime ?? nowTime
  if (compareDates(endDate, today) > 0) throw futureTime('Cannot resume in the future')
  if (endDate === today && compareTimes(endTime, nowTime) > 0) {
    throw futureTime('Cannot resume in the future')
  }
  const running = await getRunningEntry(db, user.id)
  if (!running || running.kind !== 'pause') {
    throw new AppError('RUNNING_MISSING', 409, 'No pause is running')
  }
  if (compareDates(endDate, running.workDate) < 0) {
    throw errValidation('The pause cannot end before it started')
  }
  if (endDate === running.workDate && compareTimes(endTime, running.startTime) < 0) {
    throw errValidation('The pause cannot end before it started')
  }
  await closeRunningAt(db, user.id, running, endDate, endTime)
  const entry = await openRunningEntry(db, user.id, {
    workDate: endDate,
    startTime: endTime,
    kind: 'work',
    source: 'timer',
  })
  return c.json({ entry: toApi(entry) })
})

/** Finish the workday: closes whatever is running (work or pause). */
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
  try {
    await closeRunningAt(db, user.id, running, endDate, endTime)
  } catch (error) {
    if (error instanceof AppError && error.code === 'OVERLAP') {
      throw new AppError(
        'OVERLAP',
        409,
        'The timer ran across days that already have logged hours. Stop it on its start day (set that date in the stop dialog), or remove the conflicting entries first.',
      )
    }
    throw error
  }
  return c.json({ ok: true })
})
