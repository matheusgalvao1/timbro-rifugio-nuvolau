import { Hono } from 'hono'
import { AppError } from './lib/errors'
import { createDb } from './lib/d1'
import { authRoutes } from './routes/auth'
import { entriesRoutes } from './routes/entries'
import { usersRoutes } from './routes/users'
import { reportsRoutes } from './routes/reports'
import type { HonoEnv } from './env'

const app = new Hono<HonoEnv>()

app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB))
  // Cookie auth is SameSite=Lax; this is a second line of defense against
  // cross-site state changes (plain GETs and same-origin calls pass through).
  const method = c.req.method
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('Origin')
    if (origin) {
      const requestHost = new URL(c.req.url).host
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        originHost = ''
      }
      if (originHost !== requestHost) {
        throw new AppError('FORBIDDEN', 403, 'Cross-site request blocked')
      }
    }
  }
  await next()
})

app.get('/api/health', (c) => c.json({ ok: true, now: new Date().toISOString() }))

app.route('/api/auth', authRoutes)
app.route('/api/entries', entriesRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/reports', reportsRoutes)

// Unknown API paths answer JSON; everything else is the SPA (assets fallback).
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Unknown API route' } }, 404)
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(
      { error: { code: error.code, message: error.message } },
      error.status as 400 | 401 | 403 | 404 | 409 | 500,
    )
  }
  console.error(error)
  return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, 500)
})

export default app
