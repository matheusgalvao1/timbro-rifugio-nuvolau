import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['owner', 'employee'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [uniqueIndex('users_username_unique').on(t.username)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/**
 * One row per work period. A timer left running is a row with NULL end_time.
 * A timer that crosses midnight is stored as one row per calendar day
 * (Europe/Rome), with `24:00` as the boundary end/start sentinel.
 */
export const timeEntries = sqliteTable(
  'time_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workDate: text('work_date').notNull(), // YYYY-MM-DD, Europe/Rome
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time'), // HH:mm or '24:00'; NULL = timer still running
    source: text('source', { enum: ['manual', 'timer'] }).notNull().default('manual'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('time_entries_user_date_idx').on(t.userId, t.workDate)],
)

export type UserRow = typeof users.$inferSelect
export type TimeEntryRow = typeof timeEntries.$inferSelect
export type SessionRow = typeof sessions.$inferSelect
