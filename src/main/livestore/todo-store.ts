import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise, nanoid, queryDb, type Store } from '@livestore/livestore'
import { TODO_CHANNELS } from '../../shared/livestore/channels'
import { events, tables, todoSchema } from '../../shared/livestore/schema'
import { Todo } from '../../shared/todo'

const visibleTodos$ = queryDb(tables.todos.where({ deletedAt: null }), {
  label: 'visibleTodos',
  map: (rows) =>
    [...rows]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((row) => ({
        id: row.id,
        text: row.text,
        completed: row.completed,
        createdAt: row.createdAt,
      })),
})

export class TodoStoreService {
  private store: Store<typeof todoSchema> | null = null
  private snapshot: Todo[] = []
  private unsubscribe: (() => void) | null = null

  async init(): Promise<void> {
    if (this.store) return

    const adapter = makeAdapter({
      storage: {
        type: 'fs',
        baseDirectory: join(app.getPath('userData'), 'livestore'),
      },
    })

    this.store = await createStorePromise({
      schema: todoSchema,
      adapter,
      storeId: 'desktop',
      disableDevtools: true,
    })

    this.snapshot = this.store.query(visibleTodos$)
    this.unsubscribe = this.store.subscribe(visibleTodos$, {
      onUpdate: (todos) => {
        this.snapshot = todos
        this.broadcastSnapshot()
      },
    })

    this.registerIpcHandlers()
  }

  getSnapshot(): Todo[] {
    return this.snapshot
  }

  async add(text: string): Promise<void> {
    this.requireStore().commit(
      events.todoCreated({
        id: nanoid(),
        text: text.trim(),
        createdAt: Date.now(),
      }),
    )
  }

  async toggle(id: string): Promise<void> {
    const todo = this.snapshot.find((item) => item.id === id)
    if (!todo) return

    this.requireStore().commit(
      events.todoCompletionSet({
        id,
        completed: !todo.completed,
      }),
    )
  }

  async remove(id: string): Promise<void> {
    this.requireStore().commit(
      events.todoDeleted({
        id,
        deletedAt: Date.now(),
      }),
    )
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
    this.unsubscribe?.()
    this.unsubscribe = null

    if (!this.store) return

    await this.store.shutdown()
    this.store = null
  }

  private registerIpcHandlers(): void {
    this.unregisterIpcHandlers()

    ipcMain.handle(TODO_CHANNELS.snapshot, () => this.getSnapshot())
    ipcMain.handle(TODO_CHANNELS.add, (_event, text: string) => this.add(text))
    ipcMain.handle(TODO_CHANNELS.toggle, (_event, id: string) => this.toggle(id))
    ipcMain.handle(TODO_CHANNELS.remove, (_event, id: string) => this.remove(id))
  }

  private unregisterIpcHandlers(): void {
    for (const channel of Object.values(TODO_CHANNELS)) {
      if (channel !== TODO_CHANNELS.changed) {
        ipcMain.removeHandler(channel)
      }
    }
  }

  private broadcastSnapshot(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(TODO_CHANNELS.changed, this.snapshot)
    }
  }

  private requireStore(): Store<typeof todoSchema> {
    if (!this.store) {
      throw new Error('Todo store has not been initialized yet.')
    }

    return this.store
  }
}
