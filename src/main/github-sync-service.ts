import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_GITHUB_SETTINGS,
  EMPTY_GITHUB_SNAPSHOT,
  type GithubAuthStatus,
  type GithubPullRequest,
  type GithubPullRequestComment,
  type GithubPullRequestCommit,
  type GithubPullRequestCiStatus,
  type GithubRepository,
  type GithubSettings,
  type GithubSnapshot,
} from '../shared/github'

const execFileAsync = promisify(execFile)

const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  refresh: 'github:refresh',
  updateSettings: 'github:update-settings',
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
      const prUpdated = this.didPullRequestsChange(this.snapshot.pullRequests, nextData.pullRequests)

      this.snapshot = {
        ...this.snapshot,
        auth,
        repositories: nextData.repositories,
        pullRequests: nextData.pullRequests,
        sync: {
          ...this.snapshot.sync,
          isRefreshing: false,
          lastRefreshedAt: Date.now(),
          lastUpdateDetectedAt: prUpdated ? Date.now() : this.snapshot.sync.lastUpdateDetectedAt,
          lastError: null,
        },
      }

      if (prUpdated && this.snapshot.settings.soundOnPrUpdates && this.snapshot.pullRequests.length > 0) {
        shell.beep()
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
    ipcMain.handle(GITHUB_CHANNELS.setRepoPath, (_event, nameWithOwner: string, localPath: string) =>
      this.setRepoPath(nameWithOwner, localPath),
    )
    ipcMain.handle(GITHUB_CHANNELS.checkoutBranch, (_event, nameWithOwner: string, branch: string) =>
      this.checkoutBranch(nameWithOwner, branch),
    )
    ipcMain.handle(GITHUB_CHANNELS.pickFolder, () => this.pickFolder())
  }

  private unregisterIpcHandlers(): void {
    ipcMain.removeHandler(GITHUB_CHANNELS.snapshot)
    ipcMain.removeHandler(GITHUB_CHANNELS.refresh)
    ipcMain.removeHandler(GITHUB_CHANNELS.updateSettings)
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
        localRepoPaths: (parsed.localRepoPaths && typeof parsed.localRepoPaths === 'object' && !Array.isArray(parsed.localRepoPaths))
          ? parsed.localRepoPaths as Record<string, string>
          : {},
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

  private didPullRequestsChange(
    previousPullRequests: GithubPullRequest[],
    nextPullRequests: GithubPullRequest[],
  ): boolean {
    if (previousPullRequests.length === 0) {
      return false
    }

    const previousById = new Map(previousPullRequests.map((pullRequest) => [pullRequest.id, pullRequest]))

    if (previousById.size !== nextPullRequests.length) {
      return true
    }

    return nextPullRequests.some((pullRequest) => {
      const previous = previousById.get(pullRequest.id)
      if (!previous) {
        return true
      }

      return (
        previous.updatedAt !== pullRequest.updatedAt ||
        previous.reviewDecision !== pullRequest.reviewDecision ||
        previous.state !== pullRequest.state ||
        previous.isDraft !== pullRequest.isDraft
      )
    })
  }

  private async setRepoPath(nameWithOwner: string, localPath: string): Promise<void> {
    const paths = { ...this.snapshot.settings.localRepoPaths }
    if (localPath) {
      paths[nameWithOwner] = localPath
    } else {
      delete paths[nameWithOwner]
    }
    const next: GithubSettings = { ...this.snapshot.settings, localRepoPaths: paths }
    this.snapshot = { ...this.snapshot, settings: next }
    await this.persistSettings(next)
    this.broadcastSnapshot()
  }

  private async checkoutBranch(nameWithOwner: string, branch: string): Promise<void> {
    const localPath = this.snapshot.settings.localRepoPaths[nameWithOwner]
    if (!localPath) {
      throw new Error(`No local path configured for ${nameWithOwner}. Set one in Settings > Local Repositories.`)
    }
    await execFileAsync('git', ['checkout', branch], {
      cwd: localPath,
      env: process.env,
    })
  }

  private async pickFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
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
