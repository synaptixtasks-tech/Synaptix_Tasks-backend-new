import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import type { Db } from './database'
import type { TaskRow, UserRow } from './schema'

export type Bindings = {
  DB: D1Database
  SECRET_KEY: string
  ALGORITHM: string
  ACCESS_TOKEN_EXPIRE_MINUTES: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: { db: Db; user: UserRow }
}

export function conflict(c: Context<AppEnv>, detail: string): never {
  throw new HTTPException(409, { res: c.json({ error: detail }, 409) })
}

function isUniqueViolation(error: unknown, columns: string[]): boolean {
  for (
    let current = error, depth = 0;
    current instanceof Error && depth < 5;
    depth++, current = current.cause
  ) {
    if (columns.some((column) => current.message.includes(`UNIQUE constraint failed: ${column}`))) {
      return true
    }
  }
  return false
}

export function runQuery<T>(
  c: Context<AppEnv>,
  conflictDetail: string,
  uniqueColumns: string[],
  run: () => Promise<T>,
): Promise<T> {
  return run().catch((err) => {
    if (isUniqueViolation(err, uniqueColumns)) conflict(c, conflictDetail)
    throw err
  })
}

export function serializeUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    dateCreated: user.dateCreated.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

export function serializeTask(task: TaskRow) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    completed: task.completed,
    dateCreated: task.dateCreated.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    isDeleted: task.isDeleted,
    userId: task.userId,
  }
}
