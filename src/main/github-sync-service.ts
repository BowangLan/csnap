import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_EVENT_SOUNDS,
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  MACOS_NOTIFICATION_SOUNDS,
  type EventSoundConfig,
  type GithubAccount,
  type GithubAuthStatus,
  type MacOsNotificationSound,
  type GithubPullRequest,
  type GithubPullRequestComment,
  type GithubPullRequestCommit,
  type GithubPullRequestCiStatus,
  type GithubRepository,
  type GithubSettings,
  type GithubSnapshot,
  type PrNotificationEvent,
} from '../shared/github'

const execFileAsync = promisify(execFile)

interface PrNotificationDetail {
  pr: GithubPullRequest
  event: PrNotificationEvent
}

interface PrChangeBreakdown {
  hasNewCommit: boolean
  hasCiCheckCompleted: boolean
  hasAllCiPassed: boolean
  hasAllCiFailed: boolean
  hasPrApproved: boolean
  hasOtherChange: boolean
  perPrChanges: PrNotificationDetail[]
}

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  refresh: 'github:refresh',
  updateSettings: 'github:update-settings',
  listAccounts: 'github:list-accounts',
  switchAccount: 'github:switch-account',
  playSound: 'github:play-sound',
  sendTestNotification: 'github:send-test-notification',
  setRepoPath: 'github:set-repo-path',
  checkoutBranch: 'github:checkout-branch',
  pickFolder: 'github:pick-folder',
} as const

const SETTINGS_FILE_NAME = 'github-settings.json'
const REFRESH_INTERVAL_MIN_SECONDS = 15
const REFRESH_INTERVAL_MAX_SECONDS = 3600
const PR_SEARCH_LIMIT = 100

const PULL_REQUEST_QUERY = `
  query($prLimit: Int!) {
    viewer {
      login
    }
    search(
      type: ISSUE
      query: "is:open is:pr author:@me archived:false sort:updated-desc"
      first: $prLimit
    ) {
      nodes {
        ... on PullRequest {
          id
          number
          title
          body
          url
          state
          isDraft
          reviewDecision
          mergeable
          baseRefName
          createdAt
          updatedAt
          additions
          deletions
          changedFiles
          comments(last: 50) {
            totalCount
            nodes {
              id
              url
              body
              createdAt
              author {
                login
              }
            }
          }
          commitHistory: commits(last: 50) {
            totalCount
            nodes {
              commit {
                oid
                messageHeadline
                url
                authoredDate
                author {
                  user {
                    login
                  }
                  name
                }
              }
            }
          }
          latestCommit: commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                  contexts(first: 100) {
                    nodes {
                      __typename
                      ... on CheckRun {
                        name
                        status
                        conclusion
                        detailsUrl
                      }
                      ... on StatusContext {
                        context
                        state
                        targetUrl
                      }
                    }
                  }
                }
              }
            }
          }
          headRefName
          author {
            login
          }
          repository {
            id
            name
            nameWithOwner
            url
            isPrivate
            updatedAt
            pushedAt
            defaultBranchRef {
              name
            }
            pullRequests(states: OPEN) {
              totalCount
            }
          }
        }
      }
    }
  }
`

interface GhViewerResponse {
  login: string
}

interface GhPullRequestNode {
  id: string
  number: number
  title: string
  body: string
  url: string
  state: string
  isDraft: boolean
  reviewDecision: string | null
  mergeable: string | null
  baseRefName: string
  createdAt: string
  updatedAt: string
  additions: number
  deletions: number
  changedFiles: number
  comments: {
    totalCount: number
    nodes: Array<{
      id: string
      url: string
      body: string
      createdAt: string
      author: { login: string } | null
    }>
  }
  commitHistory: {
    totalCount: number
    nodes: Array<{
      commit: {
        oid: string
        messageHeadline: string
        url: string
        authoredDate: string
        author: {
          user: { login: string } | null
          name: string | null
        } | null
      }
    }>
  }
  headRefName: string
  latestCommit: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          state: string | null
          contexts: {
            nodes: GhStatusCheckNode[]
          }
        } | null
      }
    }>
  }
  author: {
    login: string
  } | null
  repository: {
    id: string
    name: string
    nameWithOwner: string
    url: string
    isPrivate: boolean
    updatedAt: string | null
    pushedAt: string | null
    defaultBranchRef: {
      name: string
    } | null
    pullRequests: {
      totalCount: number
    }
  }
}

type GhStatusCheckNode =
  | {
      __typename: 'CheckRun'
      name: string
      status: string
      conclusion: string | null
      detailsUrl: string | null
    }
  | {
      __typename: 'StatusContext'
      context: string
      state: string
      targetUrl: string | null
    }

interface GhGraphqlResponse {
  data: {
    viewer: GhViewerResponse
    search: {
      nodes: GhPullRequestNode[]
    }
  }
}

export class GithubSyncService {
  private snapshot: GithubSnapshot = EMPTY_GITHUB_SNAPSHOT
  private refreshTimer: NodeJS.Timeout | null = null
  private settingsPath = ''
  private isRefreshing = false

  async init(): Promise<void> {
    this.settingsPath = join(app.getPath('userData'), SETTINGS_FILE_NAME)
    const settings = await this.loadSettings()
    this.snapshot = {
      ...EMPTY_GITHUB_SNAPSHOT,
      settings,
    }

    this.registerIpcHandlers()
    this.scheduleRefresh()
    await this.refresh()
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  getSnapshot(): GithubSnapshot {
    return this.snapshot
  }

  async refresh(): Promise<GithubSnapshot> {
    if (this.isRefreshing) {
      return this.snapshot
    }

    this.isRefreshing = true
    this.snapshot = {
      ...this.snapshot,
      sync: {
        ...this.snapshot.sync,
        isRefreshing: true,
        lastError: null,
      },
    }
    this.broadcastSnapshot()

    try {
      const auth = await this.fetchAuth()

      if (!auth.isAuthenticated) {
        this.snapshot = {
          ...this.snapshot,
          auth,
          repositories: [],
          pullRequests: [],
          sync: {
            ...this.snapshot.sync,
            isRefreshing: false,
            lastError: 'GitHub CLI is not authenticated. Run `gh auth login` first.',
          },
        }
        return this.snapshot
      }

      const nextData = await this.fetchGithubData()
      const changes = this.getPrChanges(this.snapshot.pullRequests, nextData.pullRequests)
      const hasAnyChange =
        changes.hasNewCommit ||
        changes.hasCiCheckCompleted ||
        changes.hasAllCiPassed ||
        changes.hasAllCiFailed ||
        changes.hasOtherChange

      this.snapshot = {
        ...this.snapshot,
        auth,
        repositories: nextData.repositories,
        pullRequests: nextData.pullRequests,
        sync: {
          ...this.snapshot.sync,
          isRefreshing: false,
          lastRefreshedAt: Date.now(),
          lastUpdateDetectedAt: hasAnyChange ? Date.now() : this.snapshot.sync.lastUpdateDetectedAt,
          lastError: null,
        },
      }

      if (this.snapshot.pullRequests.length > 0) {
        this.playSoundForChanges(changes)
        this.sendNativeNotifications(changes)
      }
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        sync: {
          ...this.snapshot.sync,
          isRefreshing: false,
          lastError: error instanceof Error ? error.message : 'Failed to refresh GitHub data.',
        },
      }
    } finally {
      this.isRefreshing = false
      this.broadcastSnapshot()
    }

    return this.snapshot
  }

  playNotificationSound(soundName: MacOsNotificationSound): void {
    if (process.platform === 'darwin') {
      const proc = spawn('/usr/bin/afplay', [`/System/Library/Sounds/${soundName}.aiff`], {
        stdio: 'ignore',
      })
      proc.on('error', () => {
        shell.beep()
      })
      return
    }
    shell.beep()
  }

  async updateSettings(partial: Partial<GithubSettings>): Promise<GithubSnapshot> {
    const nextSettings: GithubSettings = {
      ...this.snapshot.settings,
      ...partial,
      refreshIntervalSeconds: this.sanitizeRefreshInterval(
        partial.refreshIntervalSeconds ?? this.snapshot.settings.refreshIntervalSeconds,
      ),
    }

    this.snapshot = {
      ...this.snapshot,
      settings: nextSettings,
    }

    await this.persistSettings(nextSettings)
    this.scheduleRefresh()
    this.broadcastSnapshot()

    return this.snapshot
  }

  private registerIpcHandlers(): void {
    this.unregisterIpcHandlers()
    ipcMain.handle(GITHUB_CHANNELS.snapshot, () => this.getSnapshot())
    ipcMain.handle(GITHUB_CHANNELS.refresh, () => this.refresh())
    ipcMain.handle(GITHUB_CHANNELS.updateSettings, (_event, partial: Partial<GithubSettings>) =>
      this.updateSettings(partial),
    )
    ipcMain.handle(GITHUB_CHANNELS.listAccounts, () => this.listAccounts())
    ipcMain.handle(GITHUB_CHANNELS.switchAccount, (_event, login: string) =>
      this.switchAccount(login),
    )
    ipcMain.handle(GITHUB_CHANNELS.playSound, (_event, soundName: MacOsNotificationSound) => {
      this.playNotificationSound(soundName)
    })
    ipcMain.handle(GITHUB_CHANNELS.sendTestNotification, (_event, notifEvent: PrNotificationEvent) => {
      this.sendTestNotification(notifEvent)
    })
    ipcMain.handle(GITHUB_CHANNELS.setRepoPath, (_event, nameWithOwner: string, localPath: string) =>
      this.setRepoPath(nameWithOwner, localPath),
    )
    ipcMain.handle(GITHUB_CHANNELS.checkoutBranch, (_event, nameWithOwner: string, branchName: string) =>
      this.checkoutBranch(nameWithOwner, branchName),
    )
    ipcMain.handle(GITHUB_CHANNELS.pickFolder, () => this.pickFolder())
  }

  private unregisterIpcHandlers(): void {
    ipcMain.removeHandler(GITHUB_CHANNELS.snapshot)
    ipcMain.removeHandler(GITHUB_CHANNELS.refresh)
    ipcMain.removeHandler(GITHUB_CHANNELS.updateSettings)
    ipcMain.removeHandler(GITHUB_CHANNELS.listAccounts)
    ipcMain.removeHandler(GITHUB_CHANNELS.switchAccount)
    ipcMain.removeHandler(GITHUB_CHANNELS.playSound)
    ipcMain.removeHandler(GITHUB_CHANNELS.sendTestNotification)
    ipcMain.removeHandler(GITHUB_CHANNELS.setRepoPath)
    ipcMain.removeHandler(GITHUB_CHANNELS.checkoutBranch)
    ipcMain.removeHandler(GITHUB_CHANNELS.pickFolder)
  }

  private broadcastSnapshot(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(GITHUB_CHANNELS.changed, this.snapshot)
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }

    this.refreshTimer = setInterval(() => {
      void this.refresh()
    }, this.snapshot.settings.refreshIntervalSeconds * 1000)
  }

  private async loadSettings(): Promise<GithubSettings> {
    try {
      const raw = await readFile(this.settingsPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<GithubSettings>
      return {
        refreshIntervalSeconds: this.sanitizeRefreshInterval(parsed.refreshIntervalSeconds),
        soundOnPrUpdates: parsed.soundOnPrUpdates ?? DEFAULT_GITHUB_SETTINGS.soundOnPrUpdates,
        notificationSound: validateSound(parsed.notificationSound) ?? DEFAULT_GITHUB_SETTINGS.notificationSound,
        eventSounds: parseEventSounds(parsed.eventSounds),
        nativeNotifications: parsed.nativeNotifications ?? DEFAULT_GITHUB_SETTINGS.nativeNotifications,
        localRepoPaths: parseLocalRepoPaths(parsed.localRepoPaths),
      }
    } catch {
      return DEFAULT_GITHUB_SETTINGS
    }
  }

  private async persistSettings(settings: GithubSettings): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  }

  private sanitizeRefreshInterval(value: number | undefined): number {
    const candidate = Number.isFinite(value) ? Math.trunc(value as number) : DEFAULT_GITHUB_SETTINGS.refreshIntervalSeconds
    return Math.min(Math.max(candidate, REFRESH_INTERVAL_MIN_SECONDS), REFRESH_INTERVAL_MAX_SECONDS)
  }

  private async fetchAuth(): Promise<GithubAuthStatus> {
    try {
      const viewer = await this.runGhJson<GhViewerResponse>(['api', 'user'])
      return {
        isAuthenticated: true,
        activeLogin: viewer.login,
      }
    } catch {
      return {
        isAuthenticated: false,
        activeLogin: null,
      }
    }
  }

  private async fetchGithubData(): Promise<{
    repositories: GithubRepository[]
    pullRequests: GithubPullRequest[]
  }> {
    const result = await this.runGhJson<GhGraphqlResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PULL_REQUEST_QUERY}`,
      '-F',
      `prLimit=${PR_SEARCH_LIMIT}`,
    ])

    const repositoriesById = new Map<string, GithubRepository>()
    const pullRequests = result.data.search.nodes
      .filter((node): node is GhPullRequestNode => Boolean(node?.repository?.id))
      .map((node) => {
        const repository: GithubRepository = {
          id: node.repository.id,
          name: node.repository.name,
          nameWithOwner: node.repository.nameWithOwner,
          url: node.repository.url,
          isPrivate: node.repository.isPrivate,
          defaultBranch: node.repository.defaultBranchRef?.name ?? null,
          updatedAt: toTimestamp(node.repository.updatedAt),
          pushedAt: toTimestamp(node.repository.pushedAt),
          openPullRequestCount: node.repository.pullRequests.totalCount,
        }

        repositoriesById.set(repository.id, repository)

        const ciRollup = node.latestCommit.nodes[0]?.commit.statusCheckRollup ?? null

        return {
          id: node.id,
          repositoryId: node.repository.id,
          repositoryNameWithOwner: node.repository.nameWithOwner,
          number: node.number,
          title: node.title,
          body: node.body || undefined,
          url: node.url,
          state: node.state,
          isDraft: node.isDraft,
          reviewDecision: node.reviewDecision,
          mergeable: node.mergeable,
          headRefName: node.headRefName ?? '',
          baseRefName: node.baseRefName || undefined,
          authorLogin: node.author?.login ?? null,
          createdAt: toTimestamp(node.createdAt) ?? Date.now(),
          updatedAt: toTimestamp(node.updatedAt) ?? Date.now(),
          additions: node.additions,
          deletions: node.deletions,
          changedFiles: node.changedFiles,
          commentsCount: node.comments.totalCount,
          comments: mapIssueComments(node.comments.nodes),
          commitsCount: node.commitHistory.totalCount,
          commits: mapPullRequestCommits(node.commitHistory.nodes),
          ciRollupState: ciRollup?.state ?? null,
          ciStatuses: (ciRollup?.contexts.nodes ?? []).map((statusNode, index) =>
            mapStatusCheckNode(node.id, index, statusNode),
          ),
        } satisfies GithubPullRequest
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)

    const repositories = [...repositoriesById.values()].sort((left, right) => {
      const leftUpdated = left.updatedAt ?? 0
      const rightUpdated = right.updatedAt ?? 0
      return rightUpdated - leftUpdated
    })

    return { repositories, pullRequests }
  }

  private getPrChanges(
    previousPullRequests: GithubPullRequest[],
    nextPullRequests: GithubPullRequest[],
  ): PrChangeBreakdown {
    const result: PrChangeBreakdown = {
      hasNewCommit: false,
      hasCiCheckCompleted: false,
      hasAllCiPassed: false,
      hasAllCiFailed: false,
      hasPrApproved: false,
      hasOtherChange: false,
      perPrChanges: [],
    }

    if (previousPullRequests.length === 0) {
      return result
    }

    const previousById = new Map(previousPullRequests.map((pr) => [pr.id, pr]))

    if (previousById.size !== nextPullRequests.length) {
      result.hasOtherChange = true
    }

    for (const next of nextPullRequests) {
      const prev = previousById.get(next.id)
      if (!prev) {
        result.hasOtherChange = true
        continue
      }

      // New commit: head commit oid changed
      const prHasNewCommit = prev.commits[0]?.oid !== next.commits[0]?.oid
      if (prHasNewCommit) result.hasNewCommit = true

      // CI rollup state transitions
      const prevRollup = prev.ciRollupState?.toUpperCase() ?? null
      const nextRollup = next.ciRollupState?.toUpperCase() ?? null
      let prHasAllCiPassed = false
      let prHasAllCiFailed = false
      if (nextRollup !== prevRollup) {
        if (nextRollup === 'SUCCESS' && prevRollup !== 'SUCCESS') {
          result.hasAllCiPassed = true
          prHasAllCiPassed = true
        } else if (
          (nextRollup === 'FAILURE' || nextRollup === 'ERROR') &&
          prevRollup !== 'FAILURE' &&
          prevRollup !== 'ERROR'
        ) {
          result.hasAllCiFailed = true
          prHasAllCiFailed = true
        }
      }

      // Individual CI check completed: was pending, now done
      let prHasCiCheckCompleted = false
      const prevCiByName = new Map(prev.ciStatuses.map((s) => [s.name, s]))
      for (const status of next.ciStatuses) {
        const prevStatus = prevCiByName.get(status.name)
        if (prevStatus && isCiPending(prevStatus) && !isCiPending(status)) {
          prHasCiCheckCompleted = true
          result.hasCiCheckCompleted = true
          break
        }
      }

      // PR approved: reviewDecision transitioned to APPROVED
      const prHasPrApproved =
        prev.reviewDecision !== 'APPROVED' && next.reviewDecision === 'APPROVED'
      if (prHasPrApproved) result.hasPrApproved = true

      // Other changes (review non-approval, state, draft)
      const prHasOtherChange =
        (prev.reviewDecision !== next.reviewDecision && !prHasPrApproved) ||
        prev.state !== next.state ||
        prev.isDraft !== next.isDraft
      if (prHasOtherChange) result.hasOtherChange = true

      // Collect per-PR detail at highest priority for native notifications
      let event: PrNotificationEvent | null = null
      if (prHasAllCiFailed) event = 'allCiFailed'
      else if (prHasAllCiPassed) event = 'allCiPassed'
      else if (prHasCiCheckCompleted) event = 'ciCheckCompleted'
      else if (prHasNewCommit) event = 'newCommit'
      else if (prHasPrApproved) event = 'prApproved'
      else if (prHasOtherChange) event = 'otherChange'

      if (event !== null) {
        result.perPrChanges.push({ pr: next, event })
      }
    }

    return result
  }

  private sendTestNotification(event: PrNotificationEvent): void {
    console.log('[sendTestNotification] called with event:', event)
    console.log('[sendTestNotification] Notification.isSupported():', Notification.isSupported())
    if (!Notification.isSupported()) return
    const fakePr = {
      title: 'Example pull request',
      number: 42,
      repositoryNameWithOwner: 'owner/repo',
      url: 'https://github.com',
    } as GithubPullRequest
    const { title, body } = buildNativeNotificationContent(fakePr, event)
    console.log('[sendTestNotification] showing notification:', { title, body })
    try {
      new Notification({ title, body, silent: true }).show()
      console.log('[sendTestNotification] notification shown')
    } catch (err) {
      console.error('[sendTestNotification] error:', err)
    }
  }

  private sendNativeNotifications(changes: PrChangeBreakdown): void {
    if (!this.snapshot.settings.nativeNotifications) return
    if (!Notification.isSupported()) return

    for (const { pr, event } of changes.perPrChanges) {
      const { title, body } = buildNativeNotificationContent(pr, event)
      const notif = new Notification({ title, body, silent: true })
      notif.on('click', () => {
        void shell.openExternal(pr.url)
      })
      notif.show()
    }
  }

  private playSoundForChanges(changes: PrChangeBreakdown): void {
    const { eventSounds, soundOnPrUpdates, notificationSound } = this.snapshot.settings

    // Priority: allCiFailed > allCiPassed > ciCheckComplete > newCommit > prApproved > generic
    if (changes.hasAllCiFailed && eventSounds.allCiFailed.enabled) {
      this.playNotificationSound(eventSounds.allCiFailed.sound)
    } else if (changes.hasAllCiPassed && eventSounds.allCiPassed.enabled) {
      this.playNotificationSound(eventSounds.allCiPassed.sound)
    } else if (changes.hasCiCheckCompleted && eventSounds.ciCheckComplete.enabled) {
      this.playNotificationSound(eventSounds.ciCheckComplete.sound)
    } else if (changes.hasNewCommit && eventSounds.newCommit.enabled) {
      this.playNotificationSound(eventSounds.newCommit.sound)
    } else if (changes.hasPrApproved && eventSounds.prApproved.enabled) {
      this.playNotificationSound(eventSounds.prApproved.sound)
    } else if (changes.hasOtherChange && soundOnPrUpdates) {
      this.playNotificationSound(notificationSound)
    }
  }

  /** Set or clear a local repo path for a given nameWithOwner.
   *  An empty string clears the entry from the map. */
  private async setRepoPath(nameWithOwner: string, localPath: string): Promise<GithubSnapshot> {
    const nextPaths = { ...this.snapshot.settings.localRepoPaths }
    if (localPath === '') {
      delete nextPaths[nameWithOwner]
    } else {
      nextPaths[nameWithOwner] = localPath
    }
    return this.updateSettings({ localRepoPaths: nextPaths })
  }

  /** Run `git checkout <branchName>` in the configured local path for the repo. */
  private async checkoutBranch(nameWithOwner: string, branchName: string): Promise<void> {
    const localPath = this.snapshot.settings.localRepoPaths[nameWithOwner]
    if (!localPath) {
      throw new Error(`No local path configured for ${nameWithOwner}`)
    }
    await execFileAsync('git', ['checkout', branchName], {
      cwd: localPath,
      env: process.env,
    })
    // No snapshot broadcast — checkout changes no application state.
  }

  /** Open a native folder-picker dialog and return the chosen path (or null). */
  private async pickFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  }

  private async listAccounts(): Promise<GithubAccount[]> {
    try {
      // gh auth status writes to stderr on some versions; capture both
      const result = await execFileAsync('gh', ['auth', 'status'], {
        cwd: app.getPath('home'),
        env: process.env,
      }).catch((err: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => ({
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
      }))
      const output = (result.stdout ?? '') + (result.stderr ?? '')
      return parseGhAuthStatus(output)
    } catch {
      return []
    }
  }

  private async switchAccount(login: string): Promise<GithubSnapshot> {
    await execFileAsync('gh', ['auth', 'switch', '--user', login], {
      cwd: app.getPath('home'),
      env: process.env,
    })
    return this.refresh()
  }

  private async runGhJson<T>(args: string[]): Promise<T> {
    const { stdout } = await execFileAsync('gh', args, {
      cwd: app.getPath('home'),
      env: process.env,
      maxBuffer: 1024 * 1024 * 8,
    })

    return JSON.parse(stdout) as T
  }
}

function mapStatusCheckNode(
  pullRequestId: string,
  index: number,
  node: GhStatusCheckNode,
): GithubPullRequestCiStatus {
  if (node.__typename === 'CheckRun') {
    return {
      id: `${pullRequestId}-check-run-${index}`,
      name: node.name,
      kind: 'check-run',
      status: node.status,
      conclusion: node.conclusion,
      detailsUrl: node.detailsUrl,
      workflowName: null,
    }
  }

  return {
    id: `${pullRequestId}-status-context-${index}`,
    name: node.context,
    kind: 'status-context',
    status: node.state,
    conclusion: node.state,
    detailsUrl: node.targetUrl,
    workflowName: null,
  }
}

function toTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function mapIssueComments(
  nodes: GhPullRequestNode['comments']['nodes'],
): GithubPullRequestComment[] {
  const mapped: GithubPullRequestComment[] = nodes.map((n) => ({
    id: n.id,
    url: n.url,
    authorLogin: n.author?.login ?? null,
    body: n.body ?? '',
    createdAt: toTimestamp(n.createdAt) ?? Date.now(),
  }))
  return mapped.sort((a, b) => b.createdAt - a.createdAt)
}

function mapPullRequestCommits(
  nodes: GhPullRequestNode['commitHistory']['nodes'],
): GithubPullRequestCommit[] {
  const mapped: GithubPullRequestCommit[] = nodes.map((n) => {
    const c = n.commit
    return {
      oid: c.oid,
      messageHeadline: c.messageHeadline ?? '',
      url: c.url,
      authoredAt: toTimestamp(c.authoredDate) ?? Date.now(),
      authorLogin: c.author?.user?.login ?? null,
      authorName: c.author?.name ?? null,
    }
  })
  return mapped.sort((a, b) => b.authoredAt - a.authoredAt)
}

function isCiPending(status: GithubPullRequestCiStatus): boolean {
  const value = (status.conclusion ?? status.status).toUpperCase()
  return ['QUEUED', 'IN_PROGRESS', 'PENDING', 'EXPECTED', 'WAITING', 'REQUESTED'].includes(value)
}

function validateSound(sound: string | undefined | null): MacOsNotificationSound | null {
  return sound && (MACOS_NOTIFICATION_SOUNDS as readonly string[]).includes(sound)
    ? (sound as MacOsNotificationSound)
    : null
}

function parseEventSoundConfig(
  raw: unknown,
  defaults: { enabled: boolean; sound: MacOsNotificationSound },
): EventSoundConfig {
  if (!raw || typeof raw !== 'object') return defaults
  const obj = raw as Partial<EventSoundConfig>
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : defaults.enabled,
    sound: validateSound(obj.sound) ?? defaults.sound,
  }
}

function parseLocalRepoPaths(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof value === 'string' && value !== '') {
      result[key] = value
    }
  }
  return result
}

function parseEventSounds(raw: unknown): GithubSettings['eventSounds'] {
  const d = DEFAULT_EVENT_SOUNDS
  if (!raw || typeof raw !== 'object') return d
  const obj = raw as Partial<GithubSettings['eventSounds']>
  return {
    newCommit: parseEventSoundConfig(obj.newCommit, d.newCommit),
    ciCheckComplete: parseEventSoundConfig(obj.ciCheckComplete, d.ciCheckComplete),
    allCiPassed: parseEventSoundConfig(obj.allCiPassed, d.allCiPassed),
    allCiFailed: parseEventSoundConfig(obj.allCiFailed, d.allCiFailed),
    prApproved: parseEventSoundConfig(obj.prApproved, d.prApproved),
  }
}

function buildNativeNotificationContent(
  pr: GithubPullRequest,
  event: PrNotificationEvent,
): { title: string; body: string } {
  const location = `${pr.repositoryNameWithOwner} #${pr.number}`
  switch (event) {
    case 'allCiFailed':
      return { title: 'CI Failed', body: `${pr.title}\n${location}` }
    case 'allCiPassed':
      return { title: 'CI Passed', body: `${pr.title}\n${location}` }
    case 'ciCheckCompleted':
      return { title: 'CI Check Completed', body: `${pr.title}\n${location}` }
    case 'newCommit':
      return { title: 'New Commit Pushed', body: `${pr.title}\n${location}` }
    case 'prApproved':
      return { title: 'PR Approved', body: `${pr.title}\n${location}` }
    case 'otherChange':
      return { title: 'Pull Request Updated', body: `${pr.title}\n${location}` }
  }
}

/**
 * Parse `gh auth status` text output into a list of accounts.
 *
 * Example output:
 *   github.com
 *     ✓ Logged in to github.com account alice (keyring)
 *     - Active account: true
 *     ✓ Logged in to github.com account bob (keyring)
 *     - Active account: false
 */
function parseGhAuthStatus(output: string): GithubAccount[] {
  const accounts: GithubAccount[] = []
  const lines = output.split('\n')
  let currentHostname = ''
  let pendingLogin: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Hostname line — no leading whitespace, not a status line
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed && !trimmed.startsWith('✓') && !trimmed.startsWith('-') && !trimmed.startsWith('!')) {
      currentHostname = trimmed
      continue
    }

    // Account login: "✓ Logged in to github.com account USERNAME (...)"
    const loginMatch = trimmed.match(/^✓ Logged in to \S+ account (\S+)/)
    if (loginMatch) {
      pendingLogin = loginMatch[1]
      continue
    }

    // Active flag: "- Active account: true/false"
    const activeMatch = trimmed.match(/^- Active account: (true|false)/)
    if (activeMatch && pendingLogin) {
      accounts.push({
        login: pendingLogin,
        hostname: currentHostname,
        isActive: activeMatch[1] === 'true',
      })
      pendingLogin = null
    }
  }

  return accounts
}
