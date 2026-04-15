import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { desc, eq, isNull } from 'drizzle-orm'
import { TODO_CHANNELS } from '../../shared/ipc/channels'
import type { Todo } from '../../shared/todo'
import { todosTable } from './schema'
import type { AppDatabase } from './client'

export class TodoStoreService {
  constructor(private readonly database: AppDatabase) {}

  async init(): Promise<void> {
    this.registerIpcHandlers()
  }

  async getSnapshot(): Promise<Todo[]> {
    return this.database.db
      .select({
        id: todosTable.id,
        text: todosTable.text,
        completed: todosTable.completed,
        createdAt: todosTable.createdAt,
      })
      .from(todosTable)
      .where(isNull(todosTable.deletedAt))
      .orderBy(desc(todosTable.createdAt))
      .all()
  }

  async add(text: string): Promise<void> {
    this.database.db.insert(todosTable).values({
      id: randomUUID(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
      deletedAt: null,
    }).run()
    await this.broadcastSnapshot()
  }

  async toggle(id: string): Promise<void> {
    const existing = this.database.db
      .select({ completed: todosTable.completed })
      .from(todosTable)
      .where(eq(todosTable.id, id))
      .get()

    if (!existing) return

    this.database.db
      .update(todosTable)
      .set({ completed: !existing.completed })
      .where(eq(todosTable.id, id))
      .run()

    await this.broadcastSnapshot()
  }

  async remove(id: string): Promise<void> {
    this.database.db
      .update(todosTable)
      .set({ deletedAt: Date.now() })
      .where(eq(todosTable.id, id))
      .run()

    await this.broadcastSnapshot()
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
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

  private async broadcastSnapshot(): Promise<void> {
    const snapshot = await this.getSnapshot()
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(TODO_CHANNELS.changed, snapshot)
    }
  }
}
