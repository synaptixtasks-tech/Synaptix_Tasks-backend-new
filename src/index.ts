import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { dbMiddleware } from './middleware'
import { accountRoutes, authRoutes } from './routes/user'
import { taskRoutes } from './routes/tasks'

const app = new Hono()

const ALL_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
app.use(
  '*',
  cors({
    origin: (origin) => origin || null,
    allowMethods: ALL_METHODS,
  }),
)
app.use('*', dbMiddleware)

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  return c.text('Internal Server Error', 500)
})

app.notFound((c) => c.json({ detail: 'Not Found' }, 404))

app.get('/', (c) => c.json({ 'Server is running': null }))

app.route('/v1/auth', authRoutes)
app.route('/v1', accountRoutes)
app.route('/v1', taskRoutes)

export default app
