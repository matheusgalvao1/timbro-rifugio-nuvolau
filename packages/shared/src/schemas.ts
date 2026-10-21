import { z } from 'zod'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const TIME_OR_MIDNIGHT = /^(24:00|([01]\d|2[0-3]):[0-5]\d)$/

export const dateSchema = z.string().regex(DATE, 'date must be YYYY-MM-DD')
export const timeSchema = z.string().regex(TIME, 'time must be HH:mm')
export const endTimeSchema = z
  .string()
  .regex(TIME_OR_MIDNIGHT, 'time must be HH:mm (24:00 means midnight)')

export const loginSchema = z.object({
  username: z.string().min(1).max(24),
  password: z.string().min(1).max(128),
})

export const changePasswordSchema = z.object({
  current: z.string().min(1).max(128),
  next: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_.-]+$/i, 'Use letters, numbers, dots, dashes or underscores')
  .transform((v) => v.toLowerCase())

const displayNameSchema = z.string().trim().min(1).max(60)

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
})

export const entryCreateSchema = z.object({
  workDate: dateSchema,
  startTime: timeSchema,
  endTime: endTimeSchema,
})

export const entryUpdateSchema = entryCreateSchema.partial()

export const timerStartSchema = z.object({
  workDate: dateSchema.optional(),
  startTime: timeSchema.optional(),
})

export const timerStopSchema = z.object({
  endDate: dateSchema.optional(),
  endTime: timeSchema.optional(),
})

export const userCreateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
})

export const userUpdateSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
  isActive: z.boolean().optional(),
})

export type Role = 'owner' | 'employee'

/** Everything the UI ever needs to render about a user. No password data. */
export type UserPublic = {
  id: string
  username: string
  displayName: string
  role: Role
  isActive: boolean
  createdAt: number
}

export type TimeEntry = {
  id: string
  workDate: string
  startTime: string
  endTime: string | null
  source: 'manual' | 'timer'
  createdAt: number
  updatedAt: number
}

export type ReportSummaryRow = {
  userId: string
  username: string
  displayName: string
  isActive: boolean
  totalMinutes: number
  entryCount: number
  dayCount: number
}

export type ReportDetailRow = {
  userId: string
  username: string
  displayName: string
  entryId: string
  workDate: string
  startTime: string
  /** null = the timer for this entry is still running */
  endTime: string | null
  minutes: number | null
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OVERLAP'
  | 'RUNNING_EXISTS'
  | 'RUNNING_MISSING'
  | 'FUTURE_TIME'
  | 'WEAK_PASSWORD'
  | 'INTERNAL'

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } }
