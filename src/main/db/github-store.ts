import { BrowserWindow, ipcMain } from 'electron'
import { desc, eq, inArray } from 'drizzle-orm'
import {
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  type BugStatus,
  type GithubAuthStatus,
  type GithubPullRequest,
  type GithubRepository,
  type GithubSettings,
  type GithubSnapshot,
  type GithubSyncState,
} from '../../shared/github'
import {
  bugRowToPrBug,
  detectBugRows,
  parseStoredSettings,
  prToRow,
  rowToPr,
  type BugRow,
} from '../../shared/db/github-store'
import type { AppDatabase } from './client'
import {
  githubAuthStateTable,
  githubPullRequestsTable,
  githubRepositoriesTable,
  githubSettingsTable,
  githubSyncStateTable,
  prBugsTable,
} from './schema'

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  setBugStatus: 'github:set-bug-status',
} as const

const BUG_STATUS_ALL: BugStatus[] = ['todo', 'resolved', 'ignored', 'in-progress']
const SINGLETON_ID = 'singleton'

export class GithubStoreService {
  private handlersRegistered = false

  constructor(private readonly database: AppDatabase) {}

  async init(): Promise<void> {
    this.registerIpcHandlers()
  }

  getSnapshot(): GithubSnapshot {
    const pullRequestRows = this.database.db
      .select()
      .from(githubPullRequestsTable)
      .orderBy(desc(githubPullRequestsTable.updatedAt))
      .all()

    const repositories = this.database.db
      .select()
      .from(githubRepositoriesTable)
      .orderBy(desc(githubRepositoriesTable.updatedAt))
      .all()

    const syncRow = this.database.db
      .select()
      .from(githubSyncStateTable)
      .where(eq(githubSyncStateTable.id, SINGLETON_ID))
      .get()

    const authRow = this.database.db
      .select()
      .from(githubAuthStateTable)
      .where(eq(githubAuthStateTable.id, SINGLETON_ID))
      .get()

    const settingsRow = this.database.db
      .select()
      .from(githubSettingsTable)
      .where(eq(githubSettingsTable.id, SINGLETON_ID))
      .get()

    const bugRows = this.database.db.select().from(prBugsTable).all()

    const sync: GithubSyncState = syncRow
      ? {
          isRefreshing: syncRow.isRefreshing,
          lastRefreshedAt: syncRow.lastRefreshedAt ?? null,
          lastUpdateDetectedAt: syncRow.lastUpdateDetectedAt ?? null,
          lastError: syncRow.lastError ?? null,
        }
      : EMPTY_GITHUB_SNAPSHOT.sync

    const auth = authRow
      ? {
          isAuthenticated: authRow.isAuthenticated,
          activeLogin: authRow.activeLogin ?? null,
        }
      : EMPTY_GITHUB_SNAPSHOT.auth

    const settings = settingsRow
      ? parseStoredSettings(settingsRow.settingsJson, DEFAULT_GITHUB_SETTINGS)
      : DEFAULT_GITHUB_SETTINGS

    return {
      auth,
      repositories,
      pullRequests: pullRequestRows.map((row) => rowToPr(row)),
      bugs: bugRows.map((row) => bugRowToPrBug(row as BugRow)),
      settings,
      sync,
      localRepoStatuses: {},
    }
  }

  hasStoredSettings(): boolean {
    const row = this.database.db
      .select({ id: githubSettingsTable.id })
      .from(githubSettingsTable)
      .where(eq(githubSettingsTable.id, SINGLETON_ID))
      .get()

    return row !== undefined
  }

  loadSettings(defaults: GithubSettings = DEFAULT_GITHUB_SETTINGS): GithubSettings {
    const row = this.database.db
      .select({ settingsJson: githubSettingsTable.settingsJson })
      .from(githubSettingsTable)
      .where(eq(githubSettingsTable.id, SINGLETON_ID))
      .get()

    if (!row) return defaults
    return parseStoredSettings(row.settingsJson, defaults)
  }

  commitSyncStarted(): void {
    const existing = this.database.db
      .select()
      .from(githubSyncStateTable)
      .where(eq(githubSyncStateTable.id, SINGLETON_ID))
      .get()

    this.database.db
      .insert(githubSyncStateTable)
      .values({
        id: SINGLETON_ID,
        isRefreshing: true,
        lastRefreshedAt: null,
        lastUpdateDetectedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: githubSyncStateTable.id,
        set: {
          isRefreshing: true,
          lastRefreshedAt: existing?.lastRefreshedAt ?? null,
          lastUpdateDetectedAt: existing?.lastUpdateDetectedAt ?? null,
          lastError: null,
        },
      })
      .run()

    void this.broadcastSnapshot()
  }

  commitSync(data: {
    pullRequests: GithubPullRequest[]
    repositories: GithubRepository[]
    auth: GithubAuthStatus
    lastRefreshedAt: number
    lastUpdateDetectedAt: number | null
  }): void {
    const pullRequestRows = data.pullRequests.map(prToRow)

    this.database.db.transaction((tx) => {
      const currentPrIds = tx
        .select({ id: githubPullRequestsTable.id })
        .from(githubPullRequestsTable)
        .all()
        .map((row) => row.id)

      const nextPrIds = new Set(pullRequestRows.map((row) => row.id))
      const stalePrIds = currentPrIds.filter((id) => !nextPrIds.has(id))
      const existingBugRows = tx.select().from(prBugsTable).all() as BugRow[]
      const detectedBugRows = detectBugRows(pullRequestRows, existingBugRows)

      for (const row of pullRequestRows) {
        tx.insert(githubPullRequestsTable)
          .values(row)
          .onConflictDoUpdate({
            target: githubPullRequestsTable.id,
            set: row,
          })
          .run()
      }

      if (stalePrIds.length > 0) {
        tx.delete(githubPullRequestsTable)
          .where(inArray(githubPullRequestsTable.id, stalePrIds))
          .run()
        tx.delete(prBugsTable).where(inArray(prBugsTable.prId, stalePrIds)).run()
      }

      tx.delete(prBugsTable).run()

      for (const bug of detectedBugRows) {
        tx.insert(prBugsTable)
          .values(bug)
          .onConflictDoUpdate({
            target: prBugsTable.id,
            set: bug,
          })
          .run()
      }

      for (const repository of data.repositories) {
        tx.insert(githubRepositoriesTable)
          .values(repository)
          .onConflictDoUpdate({
            target: githubRepositoriesTable.id,
            set: repository,
          })
          .run()
      }

      tx.insert(githubAuthStateTable)
        .values({
          id: SINGLETON_ID,
          isAuthenticated: data.auth.isAuthenticated,
          activeLogin: data.auth.activeLogin,
        })
        .onConflictDoUpdate({
          target: githubAuthStateTable.id,
          set: {
            isAuthenticated: data.auth.isAuthenticated,
            activeLogin: data.auth.activeLogin,
          },
        })
        .run()

      tx.insert(githubSyncStateTable)
        .values({
          id: SINGLETON_ID,
          isRefreshing: false,
          lastRefreshedAt: data.lastRefreshedAt,
          lastUpdateDetectedAt: data.lastUpdateDetectedAt ?? null,
          lastError: null,
        })
        .onConflictDoUpdate({
          target: githubSyncStateTable.id,
          set: {
            isRefreshing: false,
            lastRefreshedAt: data.lastRefreshedAt,
            lastUpdateDetectedAt: data.lastUpdateDetectedAt ?? null,
            lastError: null,
          },
        })
        .run()
    })

    void this.broadcastSnapshot()
  }

  commitSyncFailed(data: { error: string; auth: GithubAuthStatus }): void {
    this.database.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(githubSyncStateTable)
        .where(eq(githubSyncStateTable.id, SINGLETON_ID))
        .get()

      tx.insert(githubSyncStateTable)
        .values({
          id: SINGLETON_ID,
          isRefreshing: false,
          lastRefreshedAt: existing?.lastRefreshedAt ?? null,
          lastUpdateDetectedAt: existing?.lastUpdateDetectedAt ?? null,
          lastError: data.error,
        })
        .onConflictDoUpdate({
          target: githubSyncStateTable.id,
          set: {
            isRefreshing: false,
            lastRefreshedAt: existing?.lastRefreshedAt ?? null,
            lastUpdateDetectedAt: existing?.lastUpdateDetectedAt ?? null,
            lastError: data.error,
          },
        })
        .run()

      tx.insert(githubAuthStateTable)
        .values({
          id: SINGLETON_ID,
          isAuthenticated: data.auth.isAuthenticated,
          activeLogin: data.auth.activeLogin,
        })
        .onConflictDoUpdate({
          target: githubAuthStateTable.id,
          set: {
            isAuthenticated: data.auth.isAuthenticated,
            activeLogin: data.auth.activeLogin,
          },
        })
        .run()

      if (!data.auth.isAuthenticated) {
        tx.delete(githubPullRequestsTable).run()
        tx.delete(githubRepositoriesTable).run()
        tx.delete(prBugsTable).run()
      }
    })

    void this.broadcastSnapshot()
  }

  commitSettings(settings: GithubSettings): void {
    const settingsJson = JSON.stringify(settings)

    this.database.db
      .insert(githubSettingsTable)
      .values({ id: SINGLETON_ID, settingsJson })
      .onConflictDoUpdate({
        target: githubSettingsTable.id,
        set: { settingsJson },
      })
      .run()

    void this.broadcastSnapshot()
  }

  commitBugStatusSet(payload: { commentId: string; status: BugStatus; manual: boolean }): void {
    if (!BUG_STATUS_ALL.includes(payload.status)) return

    this.database.db
      .update(prBugsTable)
      .set({ status: payload.status, manualStatus: payload.manual })
      .where(eq(prBugsTable.id, payload.commentId))
      .run()

    void this.broadcastSnapshot()
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
  }

  private registerIpcHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true

    ipcMain.handle(GITHUB_CHANNELS.snapshot, () => this.getSnapshot())
    ipcMain.handle(
      GITHUB_CHANNELS.setBugStatus,
      (_event, payload: { commentId: string; status: BugStatus; manual: boolean }) => {
        this.commitBugStatusSet(payload)
        return this.getSnapshot()
      },
    )
  }

  private unregisterIpcHandlers(): void {
    if (!this.handlersRegistered) return
    this.handlersRegistered = false

    ipcMain.removeHandler(GITHUB_CHANNELS.snapshot)
    ipcMain.removeHandler(GITHUB_CHANNELS.setBugStatus)
  }

  private broadcastSnapshot(): void {
    const snapshot = this.getSnapshot()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(GITHUB_CHANNELS.changed, snapshot)
    }
  }
}
