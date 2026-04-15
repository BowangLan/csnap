import { ipcMain, type BrowserWindow } from 'electron'
import { REPO_STATUS_CHANNELS } from '../shared/ipc/channels'
import type { GithubSyncService } from './github-sync-service'
import type { RepoStatusStore } from './db/repo-status-store'

/**
 * AppLifecycleService
 *
 * Single place that owns "when do we sync?" logic.  Both app-load and
 * window-focus triggers live here so they share the same cooldown state and
 * are easy to reason about together.
 *
 * Flow:
 *   app ready  →  services init (each runs their own initial fetch)
 *              →  AppLifecycleService.onAppLoad()
 *                   └─ syncLocalRepos() to populate git statuses immediately
 *
 *   window focus  →  AppLifecycleService.onWindowFocus()   (cooldown: 5 s)
 *                      ├─ githubSync.refresh()   (PR data)
 *                      └─ syncLocalRepos()       (git status)
 */

const FOCUS_COOLDOWN_MS = 5_000

export class AppLifecycleService {
  private lastFocusAt = 0

  constructor(
    private readonly githubSync: GithubSyncService,
    private readonly repoStatusStore: RepoStatusStore,
  ) {}

  /**
   * Call once after all services have finished their initial `init()`.
   * GitHub data is already fetched by GithubSyncService.init(); we only
   * need to kick off the local git status sync here.
   */
  async onAppLoad(): Promise<void> {
    await this.syncLocalRepos()
  }

  registerIpcHandlers(): void {
    ipcMain.handle(REPO_STATUS_CHANNELS.syncAll, () => this.syncLocalRepos())
  }

  unregisterIpcHandlers(): void {
    ipcMain.removeHandler(REPO_STATUS_CHANNELS.syncAll)
  }

  /**
   * Attach window-focus and visibility listeners to a BrowserWindow.
   * Must be called after `createWindow()`.
   */
  attachWindow(win: BrowserWindow): void {
    win.on('focus', () => {
      void this.onWindowFocus()
    })
  }

  private async onWindowFocus(): Promise<void> {
    const now = Date.now()
    if (now - this.lastFocusAt < FOCUS_COOLDOWN_MS) return
    this.lastFocusAt = now

    // Run in parallel — GitHub PR refresh and git status are independent.
    await Promise.allSettled([this.githubSync.refresh(), this.syncLocalRepos()])
  }

  private async syncLocalRepos(): Promise<void> {
    const localRepoPaths = this.githubSync.getLocalRepoPaths()
    await this.repoStatusStore.syncAll(localRepoPaths)
  }
}
