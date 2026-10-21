import { Hono } from 'hono'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { z } from 'zod'
import {
  dateSchema,
  entryMinutes,
  monthDaysRange,
  type ReportDetailRow,
  type ReportSummaryRow,
} from '@nuvolau/shared'
import { timeEntries, users, type UserRow } from '@nuvolau/db'
import { validateQuery } from '../lib/validate'
import { errValidation } from '../lib/errors'
import { romeNow } from '../lib/rome'
import { requireOwner } from '../middleware/auth'
import type { HonoEnv } from '../env'

const reportQuery = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  /** Comma-separated user ids; when omitted, all active employees. */
  users: z.string().max(2000).optional(),
})

type Query = { from?: string; to?: string; users?: string }

async function resolve(db: HonoEnv['Variables']['db'], q: Query) {
  const today = romeNow().date
  const month = monthDaysRange(today)
  const from = q.from ?? month.from
  const to = q.to ?? month.to
  if (from > to) throw errValidation('from must be on or before to')
  let targets: UserRow[]
  if (q.users !== undefined) {
    const ids = [...new Set(q.users.split(',').map((id) => id.trim()).filter(Boolean))]
    targets = ids.length
      ? await db.select().from(users).where(inArray(users.id, ids))
      : []
  } else {
    targets = await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'employee'), eq(users.isActive, true)))
  }
  return { from, to, targets }
}

export const reportsRoutes = new Hono<HonoEnv>()

reportsRoutes.use('*', requireOwner)

/** Totals per employee for the range (missing end = still running, excluded). */
reportsRoutes.get('/summary', validateQuery(reportQuery), async (c) => {
  const db = c.get('db')
  const q = c.req.valid('query')
  const { from, to, targets } = await resolve(db, q)
  const ids = targets.map((user) => user.id)
  const entryRows = ids.length
    ? await db
        .select()
        .from(timeEntries)
        .where(
          and(
            gte(timeEntries.workDate, from),
            lte(timeEntries.workDate, to),
            inArray(timeEntries.userId, ids),
          ),
        )
    : []

  const stats = new Map<string, { totalMinutes: number; entryCount: number; days: Set<string> }>()
  for (const user of targets) stats.set(user.id, { totalMinutes: 0, entryCount: 0, days: new Set() })
  for (const entry of entryRows) {
    const stat = stats.get(entry.userId)
    if (!stat) continue
    stat.entryCount += 1
    stat.days.add(entry.workDate)
    // Only work entries are payable; pauses are recorded but unpaid.
    if (entry.endTime && entry.kind === 'work') {
      stat.totalMinutes += entryMinutes(entry.startTime, entry.endTime)
    }
  }
  const summary: ReportSummaryRow[] = targets
    .map((user) => {
      const stat = stats.get(user.id)!
      return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        isActive: user.isActive,
        totalMinutes: stat.totalMinutes,
        entryCount: stat.entryCount,
        dayCount: stat.days.size,
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
  return c.json({ from, to, summary })
})

/** Flat read-only list of entries — CSV and drill-down source. */
reportsRoutes.get('/detail', validateQuery(reportQuery), async (c) => {
  const db = c.get('db')
  const q = c.req.valid('query')
  const { from, to, targets } = await resolve(db, q)
  const ids = targets.map((user) => user.id)
  if (ids.length === 0) return c.json({ rows: [] })
  const rows = await db
    .select({ entry: timeEntries, user: users })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(
      and(
        gte(timeEntries.workDate, from),
        lte(timeEntries.workDate, to),
        inArray(timeEntries.userId, ids),
      ),
    )
  const detail: ReportDetailRow[] = rows
    .map(({ entry, user }) => ({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      entryId: entry.id,
      workDate: entry.workDate,
      startTime: entry.startTime,
      endTime: entry.endTime ?? null,
      minutes: entry.endTime ? entryMinutes(entry.startTime, entry.endTime) : null,
      kind: entry.kind,
    }))
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName) ||
        a.workDate.localeCompare(b.workDate) ||
        a.startTime.localeCompare(b.startTime),
    )
  return c.json({ rows: detail })
})
