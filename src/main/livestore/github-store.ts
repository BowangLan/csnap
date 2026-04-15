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
  parseStoredSettings,
} from '../../shared/livestore/github-schema'
import {
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  type GithubPullRequest,
  type GithubRepository,
  type GithubSettings,
  type GithubSnapshot,
  type GithubSyncState,
  type GithubAuthStatus,
} from '../../shared/github'

// ─── IPC channels (duplicated from github-sync-service to avoid circular dep) ─

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
} as const

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
  private unsubs: Array<() => void> = []
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

    // Subscribe to every live query that contributes to the snapshot.
    // All four tables are typically updated in a single `githubDataSynced`
    // event commit (one SQLite transaction), so we debounce the broadcast
    // to avoid redundant renders.
    let rebuildScheduled = false
    const scheduleRebuild = () => {
      if (rebuildScheduled) return
      rebuildScheduled = true
      queueMicrotask(() => {
        rebuildScheduled = false
        this.rebuildSnapshot()
        this.broadcastSnapshot()
      })
    }

    const store = this.requireStore()
    this.unsubs = [
      store.subscribe(pullRequests$, { onUpdate: scheduleRebuild }),
      store.subscribe(repositories$, { onUpdate: scheduleRebuild }),
      store.subscribe(syncState$, { onUpdate: scheduleRebuild }),
      store.subscribe(authState$, { onUpdate: scheduleRebuild }),
      store.subscribe(settingsRow$, { onUpdate: scheduleRebuild }),
    ]

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
  }

  /**
   * Persist changed settings.
   */
  commitSettings(settings: GithubSettings): void {
    this.requireStore().commit(
      githubEvents.githubSettingsUpdated({ settingsJson: JSON.stringify(settings) }),
    )
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []

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

  private rebuildSnapshot(): void {
    const store = this.requireStore()

    const pullRequests = store.query(pullRequests$)
    const repositoryRows = store.query(repositories$)
    const syncRow = store.query(syncState$)
    const authRow = store.query(authState$)
    const settingsStoredRow = store.query(settingsRow$)

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
      settings,
      sync,
      localRepoStatuses: this.snapshot.localRepoStatuses,
    }
  }

  private registerIpcHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true
    ipcMain.handle(GITHUB_CHANNELS.snapshot, () => this.getSnapshot())
  }

  private unregisterIpcHandlers(): void {
    if (!this.handlersRegistered) return
    this.handlersRegistered = false
    ipcMain.removeHandler(GITHUB_CHANNELS.snapshot)
  }

  private requireStore(): Store<typeof githubSchema> {
    if (!this.store) throw new Error('GithubStoreService has not been initialized.')
    return this.store
  }
}
