import { eq } from 'drizzle-orm'
import { users } from '@nuvolau/db'
import { hashPassword, randomPassword } from './crypto'
import type { Db } from './d1'
import type { Env } from '../env'

let bootstrap: Promise<void> | null = null

/**
 * Creates the owner account on first request if it doesn't exist, using the
 * ADMIN_USERNAME / ADMIN_PASSWORD secrets. resolving once per isolate; a
 * second isolate racing us loses on the username unique index and is fine.
 */
export function ensureOwner(db: Db, env: Env): Promise<void> {
  bootstrap ??= (async () => {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner'))
    if (existing) return
    const username = (env.ADMIN_USERNAME ?? 'admin').toLowerCase()
    const password = env.ADMIN_PASSWORD ?? randomPassword()
    await db.insert(users).values({
      id: crypto.randomUUID(),
      username,
      displayName: 'Owner',
      passwordHash: await hashPassword(password),
      role: 'owner',
      isActive: true,
      createdAt: new Date(),
    })
    if (env.ADMIN_PASSWORD) {
      console.log(`[bootstrap] created owner account "${username}" from ADMIN_* secrets`)
    } else {
      console.log(
        `[bootstrap] ADMIN_PASSWORD not set — created owner "${username}" with random password "${password}". Set the ADMIN_* secrets in production.`,
      )
    }
  })().catch((error) => {
    bootstrap = null
    throw error
  })
  return bootstrap
}
