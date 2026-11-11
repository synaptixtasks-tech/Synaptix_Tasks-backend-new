import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { and, eq, gt } from 'drizzle-orm'
import { authMiddleware } from '../middleware'
import { runQuery, serializeTask, type AppEnv } from '../http'
import {
  idParamSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskUpdateSchema,
  validator,
} from '../models'
import { tasks } from '../schema'

export const taskRoutes = new Hono<AppEnv>()

taskRoutes.use('/tasks', authMiddleware)
taskRoutes.use('/tasks/*', authMiddleware)

taskRoutes.post(
  '/tasks',
  validator('json', taskCreateSchema),
  async (c) => {
    const user = c.get('user')
    const data = c.req.valid('json')
    const now = new Date()
    const [task] = await runQuery(c, 'Task already exists', ['task.id'], () =>
      c.get('db')
        .insert(tasks)
        .values({
          id: data.id ?? crypto.randomUUID(),
          title: data.title,
          description: data.description ?? null,
          completed: data.completed,
          dateCreated: now,
          updatedAt: now,
          isDeleted: false,
          userId: user.id,
        })
        .returning(),
    )
    return c.json(serializeTask(task))
  },
)

taskRoutes.get(
  '/tasks',
  validator('query', taskListQuerySchema),
  async (c) => {
    const { lastSync } = c.req.valid('query')

    const conditions = [eq(tasks.userId, c.get('user').id), eq(tasks.isDeleted, false)]
    if (lastSync) conditions.push(gt(tasks.updatedAt, lastSync))
    const rows = await c.get('db').select().from(tasks).where(and(...conditions))
    return c.json(rows.map(serializeTask))
  },
)

taskRoutes.get(
  '/tasks/:id',
  validator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const [task] = await c
      .get('db')
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, c.get('user').id)))
    if (!task) throw new HTTPException(404, { res: c.json({ error: 'Task not found' }, 404) })
    return c.json(serializeTask(task))
  },
)

taskRoutes.put(
  '/tasks/:id',
  validator('param', idParamSchema),
  validator('json', taskUpdateSchema),
  async (c) => {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const [updated] = await runQuery(c, 'Task already exists', ['task.id'], () =>
      c.get('db')
        .update(tasks)
        .set({
          updatedAt: new Date(),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.completed !== undefined ? { completed: data.completed } : {}),
          ...(data.id ? { id: data.id } : {}),
        })
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .returning(),
    )
    if (!updated) throw new HTTPException(404, { res: c.json({ error: 'Task not found' }, 404) })
    return c.json(serializeTask(updated))
  },
)

taskRoutes.delete(
  '/tasks/:id',
  validator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const [deleted] = await c
      .get('db')
      .update(tasks)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, c.get('user').id)))
      .returning({ id: tasks.id })
    if (!deleted) throw new HTTPException(404, { res: c.json({ error: 'Task not found' }, 404) })
    return c.json({ message: 'Task deleted' })
  },
)
