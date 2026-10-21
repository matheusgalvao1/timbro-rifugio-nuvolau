import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'
import { userCreateSchema, userUpdateSchema, type UserPublic } from '@nuvolau/shared'
import { sessions, users, type UserRow } from '@nuvolau/db'
import { validateJson } from '../lib/validate'
import { hashPassword, randomPassword } from '../lib/crypto'
import { errConflict, errForbidden, errNotFound } from '../lib/errors'
import { requireOwner } from '../middleware/auth'
import type { HonoEnv } from '../env'

function publicUser(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.getTime(),
  }
}

export const usersRoutes = new Hono<HonoEnv>()

usersRoutes.use('*', requireOwner)

usersRoutes.get('/', async (c) => {
  const rows = await c.get('db').select().from(users).orderBy(asc(users.username))
  return c.json({ users: rows.map(publicUser) })
})

/** Creates an employee and returns the generated password exactly once. */
usersRoutes.post('/', validateJson(userCreateSchema), async (c) => {
  const db = c.get('db')
  const body = c.req.valid('json')
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, body.username))
  if (existing) throw errConflict('Username already taken')
  const password = randomPassword()
  const [row] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      username: body.username,
      displayName: body.displayName,
      passwordHash: await hashPassword(password),
      role: 'employee',
      isActive: true,
      createdAt: new Date(),
    })
    .returning()
  return c.json({ user: publicUser(row!), password })
})

usersRoutes.patch('/:id', validateJson(userUpdateSchema), async (c) => {
  const db = c.get('db')
  const targetId = c.req.param('id')
  const body = c.req.valid('json')
  const [target] = await db.select().from(users).where(eq(users.id, targetId))
  if (!target) throw errNotFound('Employee not found')
  if (target.role !== 'employee') {
    throw errForbidden('Use Settings to edit your own owner account')
  }
  if (body.username && body.username !== target.username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, body.username))
    if (taken) throw errConflict('Username already taken')
  }
  const patch: { username?: string; displayName?: string; isActive?: boolean } = {}
  if (body.username !== undefined) patch.username = body.username
  if (body.displayName !== undefined) patch.displayName = body.displayName
  if (body.isActive !== undefined) patch.isActive = body.isActive
  if (Object.keys(patch).length === 0) return c.json({ user: publicUser(target) })
  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, target.id))
    .returning()
  // Deactivation signs them out everywhere (their history stays viewable).
  if (body.isActive === false) {
    await db.delete(sessions).where(eq(sessions.userId, target.id))
  }
  return c.json({ user: publicUser(updated!) })
})

/** Lost password: issue a fresh random one, sign them out everywhere. */
usersRoutes.post('/:id/reset-password', async (c) => {
  const db = c.get('db')
  const targetId = c.req.param('id')
  const [target] = await db.select().from(users).where(eq(users.id, targetId))
  if (!target) throw errNotFound('Employee not found')
  if (target.role !== 'employee') {
    throw errForbidden('Use Settings to change your own password')
  }
  const password = randomPassword()
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, target.id))
  await db.delete(sessions).where(eq(sessions.userId, target.id))
  return c.json({ password })
})
