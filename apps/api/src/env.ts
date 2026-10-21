import type { UserRow } from '@nuvolau/db'
import type { Db } from './lib/d1'

export type Env = {
  DB: D1Database
  ASSETS: Fetcher
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
}

export type HonoEnv = {
  Bindings: Env
  Variables: {
    db: Db
    user: UserRow
    tokenHash: string
  }
}
