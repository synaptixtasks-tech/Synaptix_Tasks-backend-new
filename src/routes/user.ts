import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { createAccessToken, DUMMY_PASSWORD_HASH, getPasswordHash, verifyPassword } from '../auth'
import { authMiddleware } from '../middleware'
import { runQuery, serializeUser, type AppEnv } from '../http'
import { loginSchema, userSchema, userUpdateSchema, validator } from '../models'
import { users } from '../schema'

export const authRoutes = new Hono<AppEnv>()

authRoutes.post(
  '/register',
  validator('json', userSchema),
  async (c) => {
    const { username, password } = c.req.valid('json')
    const now = new Date()
    const [user] = await runQuery(c, 'Username already registered', ['user.username'], async () =>
      c.get('db')
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          username,
          hashedPassword: await getPasswordHash(password),
          dateCreated: now,
          updatedAt: now,
        })
        .returning(),
    )
    return c.json({
      accessToken: await createAccessToken(c.env, { sub: user.id }),
      tokenType: 'Bearer',
    })
  },
)

authRoutes.post(
  '/login',
  validator('json', loginSchema),
  async (c) => {
    const { username, password } = c.req.valid('json')
    const [user] = await c
      .get('db')
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
    const valid = await verifyPassword(password, user?.hashedPassword ?? DUMMY_PASSWORD_HASH)
    if (!user || !valid) {
      throw new HTTPException(401, {
        res: c.json({ error: 'Invalid username or password' }, 401, { 'WWW-Authenticate': 'Bearer' }),
      })
    }
    return c.json({
      accessToken: await createAccessToken(c.env, { sub: user.id }),
      tokenType: 'Bearer',
    })
  },
)

export const accountRoutes = new Hono<AppEnv>()

accountRoutes.use('/user', authMiddleware)

accountRoutes.get('/user', (c) => c.json(serializeUser(c.get('user'))))

accountRoutes.put(
  '/user',
  validator('json', userUpdateSchema),
  async (c) => {
    const data = c.req.valid('json')
    const [updated] = await runQuery(c, 'Username already registered', ['user.username'], async () =>
      c.get('db')
        .update(users)
        .set({
          updatedAt: new Date(),
          ...(data.username !== undefined ? { username: data.username } : {}),
          ...(data.password !== undefined
            ? { hashedPassword: await getPasswordHash(data.password) }
            : {}),
        })
        .where(eq(users.id, c.get('user').id))
        .returning(),
    )
    return c.json(serializeUser(updated))
  },
)

accountRoutes.delete('/user', async (c) => {
  await c.get('db').delete(users).where(eq(users.id, c.get('user').id))
  return c.json({ message: 'User deleted' })
})
