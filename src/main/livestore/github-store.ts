import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { makeAdapter } from '@livestore/adapter-node'
import { createStorePromise, queryDb, type Store } from '@livestore/livestore'
import {
  githubSchema,
  githubEvents,
  githubTables,
  prToRow,
  rowToPr,
  bugRowToPrBug,
  parseStoredSettings,
} from '../../shared/livestore/github-schema'
import {
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  type BugStatus,
  type GithubPullRequest,
  type GithubRepository,
  type GithubSettings,
  type GithubSnapshot,
  type GithubSyncState,
  type GithubAuthStatus,
  type PrBug,
} from '../../shared/github'

// ─── IPC channels (duplicated from github-sync-service to avoid circular dep) ─

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  setBugStatus: 'github:set-bug-status',
} as const

const BUG_STATUS_ALL: BugStatus[] = ['todo', 'resolved', 'ignored', 'in-progress']

const STORE_ID = 'github'

// ─── Live queries ─────────────────────────────────────────────────────────────

const pullRequests$ = queryDb(
  githubTables.pullRequests.orderBy([{ col: 'updatedAt', direction: 'desc' }]),
  {
    label: 'githubPullRequests',
    map: (rows) => rows.map(rowToPr),
  },
)

const repositories$ = queryDb(
  githubTables.repositories.orderBy([{ col: 'updatedAt', direction: 'desc' }]),
  { label: 'githubRepositories' },
)

const syncState$ = queryDb(
  githubTables.syncState.where({ id: 'singleton' }).first({ fallback: () => null }),
  { label: 'githubSyncState' },
)

const authState$ = queryDb(
  githubTables.authState.where({ id: 'singleton' }).first({ fallback: () => null }),
  { label: 'githubAuthState' },
)

const settingsRow$ = queryDb(
  githubTables.settings.where({ id: 'singleton' }).first({ fallback: () => null }),
  { label: 'githubSettings' },
)

const bugs$ = queryDb(githubTables.bugs, {
  label: 'prBugs',
  map: (rows) => rows.map(bugRowToPrBug),
})

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * LiveStore-backed store for GitHub data.
 *
 * Responsibilities:
 *  - Own the LiveStore SQLite database for all GitHub state
 *  - Expose `commitSync`, `commitSyncStarted`, `commitSyncFailed`,
 *    `commitSettings` for the GithubSyncService to call after API fetches
 *  - Maintain an in-memory `GithubSnapshot` derived from the live queries
 *  - Broadcast the snapshot to all renderer windows when it changes
 *  - Handle the `github:snapshot` IPC read
 *
 * The GithubSyncService remains the sole owner of *fetching* and
 * notification/sound logic.  This service is the *storage* layer.
 */
export class GithubStoreService {
  private store: Store<typeof githubSchema> | null = null
  private snapshot: GithubSnapshot = EMPTY_GITHUB_SNAPSHOT
  private handlersRegistered = false

  async init(): Promise<void> {
    if (this.store) return

    const adapter = makeAdapter({
      storage: {
        type: 'fs',
        baseDirectory: join(app.getPath('userData'), 'livestore'),
      },
    })

    this.store = await createStorePromise({
      schema: githubSchema,
      adapter,
      storeId: STORE_ID,
      disableDevtools: true,
    })

    this.rebuildSnapshot()

    // Snapshot + IPC broadcast run synchronously in each `commit*` helper after
    // `store.commit` — not via subscribe microtasks — so `getSnapshot()` and
    // `github:changed` always match materialized rows (including `prBugs`).

    this.registerIpcHandlers()
  }

  getSnapshot(): GithubSnapshot {
    return this.snapshot
  }

  /**
   * Returns true if settings have been persisted (i.e. not a fresh installation).
   * Used by GithubSyncService to decide whether to migrate from the legacy JSON file.
   */
  hasStoredSettings(): boolean {
    return this.requireStore().query(settingsRow$) !== null
  }

  /**
   * Load persisted settings from the store, falling back to `defaults`.
   */
  loadSettings(defaults: GithubSettings = DEFAULT_GITHUB_SETTINGS): GithubSettings {
    const store = this.requireStore()
    const row = store.query(settingsRow$)
    if (!row) return defaults
    return parseStoredSettings(row.settingsJson, defaults)
  }

  // ─── Commit helpers ─────────────────────────────────────────────────────────

  /**
   * Mark the start of a refresh so the UI immediately shows a loading
   * indicator without waiting for the GitHub API to respond.
   */
  commitSyncStarted(): void {
    this.requireStore().commit(githubEvents.githubSyncStarted({}))
    this.flushGithubSnapshot()
  }

  /**
   * Persist the result of a successful full refresh.
   * `previousPullRequests` is passed so the caller can compare before/after
   * for notification/sound logic without needing to query the store again.
   */
  commitSync(data: {
    pullRequests: GithubPullRequest[]
    repositories: GithubRepository[]
    auth: GithubAuthStatus
    lastRefreshedAt: number
    lastUpdateDetectedAt: number | null
  }): void {
    this.requireStore().commit(
      githubEvents.githubDataSynced({
        pullRequestRows: data.pullRequests.map(prToRow),
        repositories: data.repositories,
        isAuthenticated: data.auth.isAuthenticated,
        activeLogin: data.auth.activeLogin,
        lastRefreshedAt: data.lastRefreshedAt,
        lastUpdateDetectedAt: data.lastUpdateDetectedAt ?? null,
      }),
    )
    this.flushGithubSnapshot()
  }

  /**
   * Record a failed refresh (auth error or network error).
   */
  commitSyncFailed(data: { error: string; auth: GithubAuthStatus }): void {
    this.requireStore().commit(
      githubEvents.githubSyncFailed({
        error: data.error,
        isAuthenticated: data.auth.isAuthenticated,
        activeLogin: data.auth.activeLogin,
      }),
    )
    this.flushGithubSnapshot()
  }

  /**
   * Persist changed settings.
   */
  commitSettings(settings: GithubSettings): void {
    this.requireStore().commit(
      githubEvents.githubSettingsUpdated({ settingsJson: JSON.stringify(settings) }),
    )
    this.flushGithubSnapshot()
  }

  /**
   * User-set bug status (or clear manual override so the next sync uses GitHub-derived status).
   */
  commitBugStatusSet(payload: { commentId: string; status: BugStatus; manual: boolean }): void {
    if (!BUG_STATUS_ALL.includes(payload.status)) return
    this.requireStore().commit(
      githubEvents.githubBugStatusSet({
        commentId: payload.commentId,
        status: payload.status,
        manual: payload.manual,
      }),
    )
    this.flushGithubSnapshot()
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()

    if (!this.store) return
    await this.store.shutdown()
    this.store = null
  }

  broadcastSnapshot(): void {
    const snapshot = this.getSnapshot()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(GITHUB_CHANNELS.changed, snapshot)
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private flushGithubSnapshot(): void {
    this.rebuildSnapshot()
    this.broadcastSnapshot()
  }

  private rebuildSnapshot(): void {
    const store = this.requireStore()

    const pullRequests = store.query(pullRequests$)
    const repositoryRows = store.query(repositories$)
    const syncRow = store.query(syncState$)
    const authRow = store.query(authState$)
    const settingsStoredRow = store.query(settingsRow$)
    const bugs: PrBug[] = store.query(bugs$)

    const sync: GithubSyncState = syncRow
      ? {
          isRefreshing: syncRow.isRefreshing,
          lastRefreshedAt: syncRow.lastRefreshedAt ?? null,
          lastUpdateDetectedAt: syncRow.lastUpdateDetectedAt ?? null,
          lastError: syncRow.lastError ?? null,
        }
      : EMPTY_GITHUB_SNAPSHOT.sync

    const auth: GithubAuthStatus = authRow
      ? { isAuthenticated: authRow.isAuthenticated, activeLogin: authRow.activeLogin ?? null }
      : EMPTY_GITHUB_SNAPSHOT.auth

    const settings: GithubSettings = settingsStoredRow
      ? parseStoredSettings(settingsStoredRow.settingsJson, DEFAULT_GITHUB_SETTINGS)
      : DEFAULT_GITHUB_SETTINGS

    const repositories: GithubRepository[] = repositoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      nameWithOwner: row.nameWithOwner,
      url: row.url,
      isPrivate: row.isPrivate,
      defaultBranch: row.defaultBranch ?? null,
      updatedAt: row.updatedAt ?? null,
      pushedAt: row.pushedAt ?? null,
      openPullRequestCount: row.openPullRequestCount,
    }))

    this.snapshot = {
      auth,
      repositories,
      pullRequests,
      bugs,
      settings,
      sync,
      localRepoStatuses: this.snapshot.localRepoStatuses,
    }
  }

  private registerIpcHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true
    ipcMain.handle(GITHUB_CHANNELS.snapshot, () => this.getSnapshot())
    ipcMain.handle(
      GITHUB_CHANNELS.setBugStatus,
      (
        _event,
        payload: { commentId: string; status: BugStatus; manual: boolean },
      ): GithubSnapshot => {
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

  private requireStore(): Store<typeof githubSchema> {
    if (!this.store) throw new Error('GithubStoreService has not been initialized.')
    return this.store
  }
}
