import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from './database'
import type { AppEnv } from './http'
import { users } from './schema'

export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('db', getDb(c.env.DB))
  await next()
})

function unauthorized(c: Context<AppEnv>, detail: string): never {
  throw new HTTPException(401, {
    res: c.json({ detail }, 401, { 'WWW-Authenticate': 'Bearer' }),
  })
}

function splitAuthorization(header: string): [string, string] {
  const index = header.indexOf(' ')
  if (index === -1) return [header, '']
  return [header.slice(0, index), header.slice(index + 1)]
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization) unauthorized(c, 'Not authenticated')
  const [scheme, token] = splitAuthorization(authorization)
  if (scheme.toLowerCase() !== 'bearer') unauthorized(c, 'Not authenticated')

  let payload: Record<string, unknown>
  try {
    payload = (await verify(token, c.env.SECRET_KEY, c.env.ALGORITHM as 'HS256')) as Record<
      string,
      unknown
    >
  } catch {
    unauthorized(c, 'Invalid authentication credentials')
  }

  const sub = payload['sub']
  if (sub === undefined || sub === null) unauthorized(c, 'Invalid authentication credentials')

  const [user] = await c.get('db').select().from(users).where(eq(users.id, String(sub)))
  if (!user) unauthorized(c, 'Invalid authentication credentials')
  c.set('user', user)
  await next()
})
