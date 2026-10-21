import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { and, eq, ne } from 'drizzle-orm'
import {
  changePasswordSchema,
  loginSchema,
  updateProfileSchema,
  type UserPublic,
} from '@nuvolau/shared'
import { sessions, users, type UserRow } from '@nuvolau/db'
import { validateJson } from '../lib/validate'
import { hashPassword, sha256Hex, verifyPassword } from '../lib/crypto'
import { AppError, errConflict, errInvalidCredentials } from '../lib/errors'
import { ensureOwner } from '../lib/owner'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  setSessionCookie,
} from '../middleware/auth'
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

export const authRoutes = new Hono<HonoEnv>()

authRoutes.post('/login', validateJson(loginSchema), async (c) => {
  const db = c.get('db')
  await ensureOwner(db, c.env)
  const { username, password } = c.req.valid('json')
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()))
  if (!row || !(await verifyPassword(password, row.passwordHash))) throw errInvalidCredentials()
  if (!row.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 403, 'This account is deactivated; ask the owner')
  }
  const { token, expiresAt } = createSessionToken()
  await db.insert(sessions).values({
    tokenHash: await sha256Hex(token),
    userId: row.id,
    expiresAt,
    createdAt: new Date(),
  })
  setSessionCookie(c, token, expiresAt)
  return c.json({ user: publicUser(row) })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    await c.get('db').delete(sessions).where(eq(sessions.tokenHash, await sha256Hex(token)))
  }
  clearSessionCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', requireAuth, (c) => c.json({ user: publicUser(c.get('user')) }))

authRoutes.patch('/me', requireAuth, validateJson(updateProfileSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = c.req.valid('json')
  if (body.username && body.username !== user.username) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, body.username))
    if (taken) throw errConflict('Username already taken')
  }
  const patch: { username?: string; displayName?: string } = {}
  if (body.username !== undefined) patch.username = body.username
  if (body.displayName !== undefined) patch.displayName = body.displayName
  const [updated] = Object.keys(patch).length
    ? await db.update(users).set(patch).where(eq(users.id, user.id)).returning()
    : [user]
  return c.json({ user: publicUser(updated!) })
})

authRoutes.patch('/password', requireAuth, validateJson(changePasswordSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const { current, next } = c.req.valid('json')
  if (!(await verifyPassword(current, user.passwordHash))) throw errInvalidCredentials()
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id))
  // Keep this device signed in, revoke every other session.
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, c.get('tokenHash'))))
  return c.json({ ok: true })
})
