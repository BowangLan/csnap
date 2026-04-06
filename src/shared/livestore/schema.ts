import { Events, Schema, State, makeSchema } from '@livestore/livestore'

export const tables = {
  todos: State.SQLite.table({
    name: 'todos',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      text: State.SQLite.text(),
      completed: State.SQLite.boolean({ default: false }),
      createdAt: State.SQLite.integer(),
      deletedAt: State.SQLite.integer({ nullable: true }),
    },
  }),
}

export const events = {
  todoCreated: Events.synced({
    name: 'v1.TodoCreated',
    schema: Schema.Struct({
      id: Schema.String,
      text: Schema.String,
      createdAt: Schema.Number,
    }),
  }),
  todoCompletionSet: Events.synced({
    name: 'v1.TodoCompletionSet',
    schema: Schema.Struct({
      id: Schema.String,
      completed: Schema.Boolean,
    }),
  }),
  todoDeleted: Events.synced({
    name: 'v1.TodoDeleted',
    schema: Schema.Struct({
      id: Schema.String,
      deletedAt: Schema.Number,
    }),
  }),
}

const materializers = State.SQLite.materializers(events, {
  'v1.TodoCreated': ({ id, text, createdAt }) =>
    tables.todos.insert({ id, text, createdAt, completed: false, deletedAt: null }),
  'v1.TodoCompletionSet': ({ id, completed }) => tables.todos.update({ completed }).where({ id }),
  'v1.TodoDeleted': ({ id, deletedAt }) => tables.todos.update({ deletedAt }).where({ id }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const todoSchema = makeSchema({ events, state })
