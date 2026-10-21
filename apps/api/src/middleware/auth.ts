import { createMiddleware } from 'hono/factory'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import { sessions, users, type UserRow } from '@nuvolau/db'
import { randomToken, sha256Hex } from '../lib/crypto'
import { errForbidden, errUnauth } from '../lib/errors'
import type { HonoEnv } from '../env'

export const SESSION_COOKIE = 'nuvolau_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000

export function setSessionCookie(c: Context<HonoEnv>, token: string, expiresAt: Date): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context<HonoEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function createSessionToken(): { token: string; expiresAt: Date } {
  return { token: randomToken(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
}

/** Resolves the signed-in user from the session cookie (throws 401 otherwise). */
export async function loadUser(c: Context<HonoEnv>): Promise<UserRow> {
  const db = c.get('db')
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) throw errUnauth()
  const tokenHash = await sha256Hex(token)
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
  if (!row) throw errUnauth()

  // Expired sessions are treated as signed out.
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
    throw errUnauth()
  }
  if (!row.user.isActive) {
    throw errForbidden('This account is deactivated; ask the owner to reactivate it')
  }

  // Sliding renewal: phones should stay signed in like an installed app.
  if (row.session.expiresAt.getTime() - Date.now() < RENEW_BELOW_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.tokenHash, tokenHash))
    setSessionCookie(c, token, expiresAt)
  }

  c.set('user', row.user)
  c.set('tokenHash', tokenHash)
  return row.user
}

export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  await loadUser(c)
  await next()
})

export const requireOwner = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await loadUser(c)
  if (user.role !== 'owner') throw errForbidden('Owner account required')
  await next()
})

/** Owner accounts deliberately cannot log time; their role is view-only. */
export const requireEmployee = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await loadUser(c)
  if (user.role !== 'employee') throw errForbidden('Owner accounts view hours but do not log them')
  await next()
})
