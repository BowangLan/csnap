import { BrowserWindow, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { REPO_STATUS_CHANNELS } from '../../shared/livestore/channels'
import type { LocalRepoGitStatus } from '../../shared/github'

const execFileAsync = promisify(execFile)

// ─── git status parser ───────────────────────────────────────────────────────

/**
 * Parses the output of `git status --porcelain=2 --branch` into a structured
 * status object.  Format reference:
 *
 *   # branch.oid <commit>
 *   # branch.head <name>        (or "(detached)")
 *   # branch.upstream <name>    (optional)
 *   # branch.ab +<ahead> -<behind>  (optional, only when upstream exists)
 *   1 <xy> ...  tracked-changed file
 *   2 <xy> ...  renamed/copied file
 *   ? <path>    untracked file
 *   u <xy> ...  unmerged (conflict) file
 */
function parseGitStatus(
  nameWithOwner: string,
  localPath: string,
  output: string,
): LocalRepoGitStatus {
  let branch: string | null = null
  let aheadCount = 0
  let behindCount = 0
  let changedCount = 0
  let untrackedCount = 0
  let hasConflicts = false

  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim()
      branch = head === '(detached)' ? null : head
    } else if (line.startsWith('# branch.ab ')) {
      const match = /\+(\d+) -(\d+)/.exec(line)
      if (match) {
        aheadCount = parseInt(match[1], 10)
        behindCount = parseInt(match[2], 10)
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      changedCount++
    } else if (line.startsWith('? ')) {
      untrackedCount++
    } else if (line.startsWith('u ')) {
      hasConflicts = true
      changedCount++
    }
  }

  return {
    nameWithOwner,
    localPath,
    branch,
    aheadCount,
    behindCount,
    changedCount,
    untrackedCount,
    hasConflicts,
    syncedAt: Date.now(),
    error: null,
  }
}

async function fetchOneRepoStatus(
  nameWithOwner: string,
  localPath: string,
): Promise<LocalRepoGitStatus> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain=2', '--branch'], {
      cwd: localPath,
      env: process.env,
    })
    return parseGitStatus(nameWithOwner, localPath, stdout)
  } catch (error) {
    return {
      nameWithOwner,
      localPath,
      branch: null,
      aheadCount: 0,
      behindCount: 0,
      changedCount: 0,
      untrackedCount: 0,
      hasConflicts: false,
      syncedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Maintains an in-memory map of local git statuses, keyed by "owner/repo".
 * Git status is ephemeral and always re-fetched on app start/focus, so there
 * is no benefit to persisting it across sessions — a plain Map is sufficient.
 */
export class RepoStatusStore {
  private snapshot: Map<string, LocalRepoGitStatus> = new Map()
  private isSyncing = false
  private handlersRegistered = false

  async init(): Promise<void> {
    this.registerIpcHandlers()
  }

  /** Return the current set of repo statuses keyed by nameWithOwner. */
  getSnapshot(): Record<string, LocalRepoGitStatus> {
    return Object.fromEntries(this.snapshot)
  }

  /**
   * Fetch git status for every configured local repo path and update the
   * in-memory snapshot.  Concurrent calls are coalesced: if a sync is
   * already running the second call is a no-op.
   */
  async syncAll(localRepoPaths: Record<string, string>): Promise<void> {
    if (this.isSyncing) return
    const entries = Object.entries(localRepoPaths)
    if (entries.length === 0) return

    this.isSyncing = true
    try {
      const results = await Promise.allSettled(
        entries.map(([nameWithOwner, localPath]) =>
          fetchOneRepoStatus(nameWithOwner, localPath),
        ),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.snapshot.set(result.value.nameWithOwner, result.value)
        }
      }

      this.broadcastSnapshot()
    } finally {
      this.isSyncing = false
    }
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
    this.snapshot.clear()
  }

  private registerIpcHandlers(): void {
    if (this.handlersRegistered) return
    this.handlersRegistered = true
    ipcMain.handle(REPO_STATUS_CHANNELS.snapshot, () => this.getSnapshot())
  }

  private unregisterIpcHandlers(): void {
    if (!this.handlersRegistered) return
    this.handlersRegistered = false
    for (const channel of Object.values(REPO_STATUS_CHANNELS)) {
      if (channel !== REPO_STATUS_CHANNELS.changed) {
        ipcMain.removeHandler(channel)
      }
    }
  }

  private broadcastSnapshot(): void {
    const snapshot = this.getSnapshot()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(REPO_STATUS_CHANNELS.changed, snapshot)
    }
  }
}
