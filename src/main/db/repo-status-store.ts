import { BrowserWindow, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { REPO_STATUS_CHANNELS } from '../../shared/ipc/channels'
import type { LocalRepoGitStatus } from '../../shared/github'

const execFileAsync = promisify(execFile)

function parseNumstat(output: string): {
  linesAdded: number
  linesDeleted: number
  linesModified: number
} {
  let linesAdded = 0
  let linesDeleted = 0
  let linesModified = 0
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const tabParts = line.split('\t')
    if (tabParts.length < 3) continue
    const aStr = tabParts[0]
    const dStr = tabParts[1]
    if (aStr === '-' || dStr === '-') continue
    const a = parseInt(aStr, 10)
    const d = parseInt(dStr, 10)
    if (Number.isNaN(a) || Number.isNaN(d)) continue
    linesAdded += a
    linesDeleted += d
    linesModified += Math.min(a, d)
  }
  return { linesAdded, linesDeleted, linesModified }
}

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
    linesAdded: 0,
    linesDeleted: 0,
    linesModified: 0,
    syncedAt: Date.now(),
    error: null,
  }
}

async function fetchOneRepoStatus(
  nameWithOwner: string,
  localPath: string,
): Promise<LocalRepoGitStatus> {
  try {
    const [statusResult, numstatResult] = await Promise.allSettled([
      execFileAsync('git', ['status', '--porcelain=2', '--branch'], {
        cwd: localPath,
        env: process.env,
      }),
      execFileAsync('git', ['diff', '--numstat', 'HEAD'], {
        cwd: localPath,
        env: process.env,
      }),
    ])

    if (statusResult.status !== 'fulfilled') {
      throw statusResult.reason
    }

    const base = parseGitStatus(nameWithOwner, localPath, statusResult.value.stdout)
    const numstatOut =
      numstatResult.status === 'fulfilled' ? numstatResult.value.stdout : ''
    const { linesAdded, linesDeleted, linesModified } = parseNumstat(numstatOut)

    return { ...base, linesAdded, linesDeleted, linesModified }
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
      linesAdded: 0,
      linesDeleted: 0,
      linesModified: 0,
      syncedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export class RepoStatusStore {
  private snapshot: Map<string, LocalRepoGitStatus> = new Map()
  private isSyncing = false
  private handlersRegistered = false

  async init(): Promise<void> {
    this.registerIpcHandlers()
  }

  getSnapshot(): Record<string, LocalRepoGitStatus> {
    return Object.fromEntries(this.snapshot)
  }

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
