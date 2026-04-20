import { BrowserWindow, ipcMain } from 'electron'
import { desc, eq, inArray } from 'drizzle-orm'
import {
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  type BugStatus,
  type GithubAuthStatus,
  type LocalCommandLog,
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
  localCommandLogsTable,
  prBugsTable,
} from './schema'

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  setBugStatus: 'github:set-bug-status',
} as const

const BUG_STATUS_ALL: BugStatus[] = ['todo', 'resolved', 'ignored', 'in-progress']
const SINGLETON_ID = 'singleton'
const COMMAND_LOG_LIMIT = 50

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
    const commandLogRows = this.database.db
      .select()
      .from(localCommandLogsTable)
      .orderBy(desc(localCommandLogsTable.startedAt))
      .limit(COMMAND_LOG_LIMIT)
      .all()

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
      commandLogs: commandLogRows.map((row) => ({
        id: row.id,
        scope: row.scope as LocalCommandLog['scope'],
        command: row.command,
        args: JSON.parse(row.argsJson) as string[],
        cwd: row.cwd,
        status: row.status as LocalCommandLog['status'],
        output: row.output,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt ?? null,
      })),
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

    })

    void this.broadcastSnapshot()
  }

  commitCommandLog(log: LocalCommandLog): void {
    this.database.db
      .insert(localCommandLogsTable)
      .values({
        id: log.id,
        scope: log.scope,
        command: log.command,
        argsJson: JSON.stringify(log.args),
        cwd: log.cwd,
        status: log.status,
        output: log.output,
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
      })
      .onConflictDoUpdate({
        target: localCommandLogsTable.id,
        set: {
          scope: log.scope,
          command: log.command,
          argsJson: JSON.stringify(log.args),
          cwd: log.cwd,
          status: log.status,
          output: log.output,
          startedAt: log.startedAt,
          finishedAt: log.finishedAt,
        },
      })
      .run()

    void this.broadcastSnapshot(log)
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

  commitReactionToggle(commentId: string, content: string, added: boolean): void {
    const rows = this.database.db.select().from(githubPullRequestsTable).all()

    for (const row of rows) {
      const comments = JSON.parse(row.commentsJson) as GithubPullRequest['comments']
      let changed = false

      for (const comment of comments) {
        if (comment.id !== commentId) continue
        const group = comment.reactionGroups.find((r) => r.content === content)
        if (group) {
          group.viewerHasReacted = added
          group.count = Math.max(0, group.count + (added ? 1 : -1))
        } else if (added) {
          comment.reactionGroups.push({ content, count: 1, viewerHasReacted: true })
        }
        changed = true
        break
      }

      if (changed) {
        this.database.db
          .update(githubPullRequestsTable)
          .set({ commentsJson: JSON.stringify(comments) })
          .where(eq(githubPullRequestsTable.id, row.id))
          .run()
        void this.broadcastSnapshot()
        return
      }
    }
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

  private broadcastSnapshot(commandLog?: LocalCommandLog): void {
    const snapshot = this.getSnapshot()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(GITHUB_CHANNELS.changed, snapshot)
      if (commandLog) {
        win.webContents.send('github:command-output', commandLog)
      }
    }
  }
}
