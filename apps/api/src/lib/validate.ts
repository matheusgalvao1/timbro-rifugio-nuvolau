import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { errValidation } from './errors'

/** Like zValidator, but fails with our `{ error: { code, message } }` shape. */
export const validateJson = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (result) => {
    if (!result.success) throw errValidation()
  })

export const validateQuery = <T extends z.ZodType>(schema: T) =>
  zValidator('query', schema, (result) => {
    if (!result.success) throw errValidation()
  })
