import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

export const userSchema = z.object({
  username: z.string().min(4),
  password: z.string().min(8).max(128),
})

export const userUpdateSchema = z
  .object({
    username: z.string().min(4).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((data) => data.username !== undefined || data.password !== undefined, {
    error: 'At least one field is required',
  })

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const taskCreateSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(1),
  description: z.string().nullish(),
  completed: z.boolean().default(false),
})

export const taskUpdateSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  completed: z.boolean().optional(),
})

export const idParamSchema = z.object({ id: z.uuid() })

export const taskListQuerySchema = z.object({
  lastSync: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
})

type ValidationTarget = 'json' | 'query' | 'param'

export function validator<S extends z.ZodType, T extends ValidationTarget>(target: T, schema: S) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: z.flattenError(result.error) }, 400)
  })
}
