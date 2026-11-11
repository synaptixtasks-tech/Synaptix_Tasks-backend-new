import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const epochMsDefault = sql`(unixepoch() * 1000)`

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  dateCreated: integer('date_created', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(epochMsDefault),
})

export const tasks = sqliteTable(
  'task',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    completed: integer('completed', { mode: 'boolean' }).notNull(),
    dateCreated: integer('date_created', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(epochMsDefault),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('ix_task_title').on(table.title),
    index('ix_task_updated_at').on(table.updatedAt),
    index('ix_task_user_id').on(table.userId),
  ],
)

export type UserRow = typeof users.$inferSelect
export type TaskRow = typeof tasks.$inferSelect
