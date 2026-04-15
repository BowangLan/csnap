import { app, dialog, ipcMain, Notification, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_EVENT_SOUNDS,
  DEFAULT_GITHUB_SETTINGS,
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
import type { GithubStoreService } from './livestore/github-store'

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
  squashMerge: 'github:squash-merge',
  setRepoPath: 'github:set-repo-path',
  checkoutBranch: 'github:checkout-branch',
  pickFolder: 'github:pick-folder',
} as const

const SETTINGS_FILE_NAME = 'github-settings.json'
const REFRESH_INTERVAL_MIN_SECONDS = 15
const REFRESH_INTERVAL_MAX_SECONDS = 3600
const POLL_INTERVAL_SECONDS = 30
const PR_SEARCH_LIMIT = 100
/** GitHub caps `first`/`last` on IssueCommentConnection; paginate beyond this. */
const ISSUE_COMMENTS_PAGE_SIZE = 100
const MAX_ISSUE_COMMENT_PAGES = 500
/**
 * Nested `search(first: prLimit) × reviewThreads × thread.comments` must stay under
 * GitHub's node budget (~500k theoretical nodes) or the API returns `MAX_NODE_LIMIT_EXCEEDED`
 * (e.g. prLimit=100 with 100×100×100 on review threads was rejected).
 */
const REVIEW_THREADS_PAGE_SIZE = 50
const MAX_REVIEW_THREAD_ROOT_PAGES = 200
/** Replies inside each review thread. */
const REVIEW_THREAD_COMMENTS_PAGE_SIZE = 50
const MAX_REVIEW_THREAD_COMMENT_PAGES = 200

/** `commitHistory: commits(last: …)` in the batched PR search query. */
const PULL_REQUEST_QUERY_COMMITS_LAST = 50
/** `statusCheckRollup.contexts(first: …)` on the head commit. */
const PULL_REQUEST_QUERY_CI_CONTEXTS_FIRST = 100

// Lightweight query (~1-2 points) for change detection.
// Returns only the fields needed to decide whether a full fetch is warranted.
const PR_POLL_QUERY = `
  query($prLimit: Int!) {
    rateLimit { remaining cost resetAt }
    search(
      type: ISSUE
      query: "is:open is:pr author:@me archived:false sort:updated-desc"
      first: $prLimit
    ) {
      nodes {
        ... on PullRequest {
          id
          updatedAt
          reviewDecision
          isDraft
          state
          mergeable
          comments { totalCount }
          commitHistory: commits(last: 1) {
            totalCount
            nodes {
              commit {
                oid
                statusCheckRollup { state }
              }
            }
          }
        }
      }
    }
  }
`

// Full query (~200 points) with all details for the UI.
const PULL_REQUEST_QUERY = `
  query($prLimit: Int!) {
    rateLimit { remaining cost resetAt }
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
          comments(first: ${ISSUE_COMMENTS_PAGE_SIZE}) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              url
              body
              createdAt
              updatedAt
              isMinimized
              minimizedReason
              authorAssociation
              author {
                login
                avatarUrl
              }
              reactionGroups {
                content
                users {
                  totalCount
                }
              }
            }
          }
          reviewThreads(first: ${REVIEW_THREADS_PAGE_SIZE}) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              comments(first: ${REVIEW_THREAD_COMMENTS_PAGE_SIZE}) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  url
                  body
                  createdAt
                  updatedAt
                  path
                  author {
                    login
                    avatarUrl
                  }
                  authorAssociation
                  reactionGroups {
                    content
                    users {
                      totalCount
                    }
                  }
                }
              }
            }
          }
          commitHistory: commits(last: ${PULL_REQUEST_QUERY_COMMITS_LAST}) {
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
                  contexts(first: ${PULL_REQUEST_QUERY_CI_CONTEXTS_FIRST}) {
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

/** Paginated fetch for PR issue comments when totalCount > one page. */
const PR_ISSUE_COMMENTS_PAGE_QUERY = `
  query($prId: ID!, $after: String!) {
    node(id: $prId) {
      ... on PullRequest {
        comments(first: ${ISSUE_COMMENTS_PAGE_SIZE}, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            url
            body
            createdAt
            updatedAt
            isMinimized
            minimizedReason
            authorAssociation
            author {
              login
              avatarUrl
            }
            reactionGroups {
              content
              users {
                totalCount
              }
            }
          }
        }
      }
    }
  }
`

/** Paginate `PullRequest.reviewThreads` when there are more than one page of threads. */
const PR_REVIEW_THREADS_PAGE_QUERY = `
  query($prId: ID!, $after: String!) {
    node(id: $prId) {
      ... on PullRequest {
        reviewThreads(first: ${REVIEW_THREADS_PAGE_SIZE}, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            comments(first: ${REVIEW_THREAD_COMMENTS_PAGE_SIZE}) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                url
                body
                createdAt
                updatedAt
                path
                author {
                  login
                  avatarUrl
                }
                authorAssociation
                reactionGroups {
                  content
                  users {
                    totalCount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

/** Paginate comments inside a single `PullRequestReviewThread`. */
const PR_REVIEW_THREAD_COMMENTS_PAGE_QUERY = `
  query($threadId: ID!, $after: String!) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: ${REVIEW_THREAD_COMMENTS_PAGE_SIZE}, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            url
            body
            createdAt
            updatedAt
            path
            author {
              login
              avatarUrl
            }
            authorAssociation
            reactionGroups {
              content
              users {
                totalCount
              }
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

type GhReviewCommentNode = {
  id: string
  url: string
  body: string | null
  createdAt: string
  updatedAt: string
  path: string
  author: { login: string; avatarUrl: string } | null
  authorAssociation: string
  reactionGroups: Array<{
    content: string
    users: { totalCount: number }
  }>
}

type GhReviewThreadCommentsConnection = {
  totalCount: number
  pageInfo: {
    hasNextPage: boolean
    endCursor: string | null
  }
  nodes: GhReviewCommentNode[]
}

type GhReviewThreadNode = {
  id: string
  comments: GhReviewThreadCommentsConnection
}

type GhReviewThreadsConnection = {
  totalCount: number
  pageInfo: {
    hasNextPage: boolean
    endCursor: string | null
  }
  nodes: GhReviewThreadNode[]
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
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
    nodes: Array<{
      id: string
      url: string
      body: string
      createdAt: string
      updatedAt: string
      isMinimized: boolean
      minimizedReason: string | null
      authorAssociation: string
      author: { login: string; avatarUrl: string } | null
      reactionGroups: Array<{
        content: string
        users: { totalCount: number }
      }>
    }>
  }
  reviewThreads: GhReviewThreadsConnection
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

interface GhCommentsContinuationResponse {
  data: {
    node: {
      comments: Pick<GhPullRequestNode['comments'], 'nodes' | 'pageInfo'>
    } | null
  }
}

interface GhReviewThreadsContinuationResponse {
  data: {
    node: {
      reviewThreads: Pick<GhReviewThreadsConnection, 'nodes' | 'pageInfo'>
    } | null
  }
}

interface GhReviewThreadCommentsContinuationResponse {
  data: {
    node: {
      comments: Pick<GhReviewThreadCommentsConnection, 'nodes' | 'pageInfo'>
    } | null
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

interface GhRateLimit {
  remaining: number
  cost: number
  resetAt: string
}

interface GhPollPrNode {
  id: string
  updatedAt: string
  reviewDecision: string | null
  isDraft: boolean
  state: string
  mergeable: string | null
  comments: { totalCount: number }
  commitHistory: {
    totalCount: number
    nodes: Array<{
      commit: {
        oid: string
        statusCheckRollup: { state: string | null } | null
      }
    }>
  }
}

interface GhPollResponse {
  data: {
    rateLimit: GhRateLimit
    search: {
      nodes: GhPollPrNode[]
    }
  }
}

interface GhGraphqlResponse {
  data: {
    rateLimit: GhRateLimit
    viewer: GhViewerResponse
    search: {
      nodes: GhPullRequestNode[]
    }
  }
}

interface PrPollFingerprint {
  id: string
  updatedAt: string
  headOid: string | null
  ciRollupState: string | null
  reviewDecision: string | null
  isDraft: boolean
  state: string
  mergeable: string | null
  commentsCount: number
  commitsCount: number
}

export class GithubSyncService {
  private pollTimer: NodeJS.Timeout | null = null
  private settingsPath = ''
  private isRefreshing = false
  private lastPollFingerprints: PrPollFingerprint[] = []

  constructor(private readonly githubStore: GithubStoreService) {}

  async init(): Promise<void> {
    this.settingsPath = join(app.getPath('userData'), SETTINGS_FILE_NAME)

    // Seed settings: use the LiveStore value if it exists, otherwise migrate
    // from the legacy JSON file and commit to the store.
    if (!this.githubStore.hasStoredSettings()) {
      const settings = await this.loadSettingsFromJsonFile()
      this.githubStore.commitSettings(settings)
    }

    this.registerIpcHandlers()
    await this.refresh()
    this.schedulePoll()
  }

  async shutdown(): Promise<void> {
    this.unregisterIpcHandlers()
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  getSnapshot(): GithubSnapshot {
    return this.githubStore.getSnapshot()
  }

  getLocalRepoPaths(): Record<string, string> {
    return this.githubStore.getSnapshot().settings.localRepoPaths
  }

  private get settings(): GithubSettings {
    return this.githubStore.getSnapshot().settings
  }

  async refresh(): Promise<GithubSnapshot> {
    if (this.isRefreshing) {
      return this.githubStore.getSnapshot()
    }

    this.isRefreshing = true

    // Mark as refreshing immediately so the UI shows a loading state.
    this.githubStore.commitSyncStarted()

    try {
      const auth = await this.fetchAuth()

      if (!auth.isAuthenticated) {
        this.githubStore.commitSyncFailed({
          error: 'GitHub CLI is not authenticated. Run `gh auth login` first.',
          auth,
        })
        return this.githubStore.getSnapshot()
      }

      // Capture previous PRs BEFORE committing new data so we can diff them
      // for notification/sound logic.
      const previousPullRequests = this.githubStore.getSnapshot().pullRequests
      const previousSyncState = this.githubStore.getSnapshot().sync

      const nextData = await this.fetchGithubData()
      this.logRateLimit('full-fetch', nextData.rateLimit)
      const changes = this.getPrChanges(previousPullRequests, nextData.pullRequests)
      const hasAnyChange =
        changes.hasNewCommit ||
        changes.hasCiCheckCompleted ||
        changes.hasAllCiPassed ||
        changes.hasAllCiFailed ||
        changes.hasOtherChange

      this.githubStore.commitSync({
        pullRequests: nextData.pullRequests,
        repositories: nextData.repositories,
        auth,
        lastRefreshedAt: Date.now(),
        lastUpdateDetectedAt: hasAnyChange ? Date.now() : previousSyncState.lastUpdateDetectedAt,
      })

      this.lastPollFingerprints = this.buildFingerprints(nextData.pullRequests)

      if (nextData.pullRequests.length > 0) {
        this.playSoundForChanges(changes)
        this.sendNativeNotifications(changes)
      }
    } catch (error) {
      this.githubStore.commitSyncFailed({
        error: error instanceof Error ? error.message : 'Failed to refresh GitHub data.',
        auth: { isAuthenticated: true, activeLogin: this.githubStore.getSnapshot().auth.activeLogin },
      })
    } finally {
      this.isRefreshing = false
    }

    return this.githubStore.getSnapshot()
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
      ...this.settings,
      ...partial,
      refreshIntervalSeconds: this.sanitizeRefreshInterval(
        partial.refreshIntervalSeconds ?? this.settings.refreshIntervalSeconds,
      ),
    }

    this.githubStore.commitSettings(nextSettings)
    // Also persist to JSON for backward compatibility with older app versions.
    await this.persistSettings(nextSettings)
    this.schedulePoll()

    return this.githubStore.getSnapshot()
  }

  private registerIpcHandlers(): void {
    this.unregisterIpcHandlers()
    // Note: GITHUB_CHANNELS.snapshot is handled by GithubStoreService.
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
    ipcMain.handle(GITHUB_CHANNELS.squashMerge, (_event, prUrl: string) =>
      this.squashAndMerge(prUrl),
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
    // Note: GITHUB_CHANNELS.snapshot is unregistered by GithubStoreService.
    ipcMain.removeHandler(GITHUB_CHANNELS.refresh)
    ipcMain.removeHandler(GITHUB_CHANNELS.updateSettings)
    ipcMain.removeHandler(GITHUB_CHANNELS.listAccounts)
    ipcMain.removeHandler(GITHUB_CHANNELS.switchAccount)
    ipcMain.removeHandler(GITHUB_CHANNELS.playSound)
    ipcMain.removeHandler(GITHUB_CHANNELS.sendTestNotification)
    ipcMain.removeHandler(GITHUB_CHANNELS.squashMerge)
    ipcMain.removeHandler(GITHUB_CHANNELS.setRepoPath)
    ipcMain.removeHandler(GITHUB_CHANNELS.checkoutBranch)
    ipcMain.removeHandler(GITHUB_CHANNELS.pickFolder)
  }

  private schedulePoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    const intervalSeconds = Math.min(
      this.settings.refreshIntervalSeconds,
      POLL_INTERVAL_SECONDS,
    )
    this.pollTimer = setInterval(() => {
      void this.poll()
    }, intervalSeconds * 1000)
  }

  /**
   * Lightweight poll: runs a cheap GraphQL query (~1-2 rate limit points) to
   * detect whether anything changed since the last full fetch.  Only triggers
   * a full `refresh()` when the fingerprint set differs.
   */
  private async poll(): Promise<void> {
    if (this.isRefreshing) return

    try {
      const result = await this.fetchPollData()
      this.logRateLimit('poll', result.rateLimit)
      const nextFingerprints = this.buildFingerprintsFromPoll(result.nodes)

      if (this.fingerprintsChanged(this.lastPollFingerprints, nextFingerprints)) {
        console.log('[poll] change detected – running full refresh')
        void this.refresh()
      }
    } catch (error) {
      console.warn('[poll] lightweight poll failed, falling back to full refresh:', error)
      void this.refresh()
    }
  }

  /**
   * Legacy: read settings from the JSON file on disk.
   * Used only on first startup after migration to LiveStore.
   */
  private async loadSettingsFromJsonFile(): Promise<GithubSettings> {
    try {
      const raw = await readFile(this.settingsPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<GithubSettings>
      return {
        refreshIntervalSeconds: this.sanitizeRefreshInterval(parsed.refreshIntervalSeconds),
        soundOnPrUpdates: parsed.soundOnPrUpdates ?? DEFAULT_GITHUB_SETTINGS.soundOnPrUpdates,
        notificationSound: validateSound(parsed.notificationSound) ?? DEFAULT_GITHUB_SETTINGS.notificationSound,
        eventSounds: parseEventSounds(parsed.eventSounds),
        nativeNotifications: parsed.nativeNotifications ?? DEFAULT_GITHUB_SETTINGS.nativeNotifications,
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

  private async fetchPollData(): Promise<{
    rateLimit: GhRateLimit
    nodes: GhPollPrNode[]
  }> {
    const result = await this.runGhJson<GhPollResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PR_POLL_QUERY}`,
      '-F',
      `prLimit=${PR_SEARCH_LIMIT}`,
    ])
    return {
      rateLimit: result.data.rateLimit,
      nodes: result.data.search.nodes.filter((n): n is GhPollPrNode => Boolean(n?.id)),
    }
  }

  private buildFingerprints(pullRequests: GithubPullRequest[]): PrPollFingerprint[] {
    return pullRequests.map((pr) => ({
      id: pr.id,
      updatedAt: new Date(pr.updatedAt).toISOString(),
      headOid: pr.commits[0]?.oid ?? null,
      ciRollupState: pr.ciRollupState?.toUpperCase() ?? null,
      reviewDecision: pr.reviewDecision,
      isDraft: pr.isDraft,
      state: pr.state,
      mergeable: pr.mergeable,
      commentsCount: pr.commentsCount,
      commitsCount: pr.commitsCount,
    }))
  }

  private buildFingerprintsFromPoll(nodes: GhPollPrNode[]): PrPollFingerprint[] {
    return nodes.map((n) => ({
      id: n.id,
      updatedAt: n.updatedAt,
      headOid: n.commitHistory.nodes[0]?.commit.oid ?? null,
      ciRollupState: n.commitHistory.nodes[0]?.commit.statusCheckRollup?.state?.toUpperCase() ?? null,
      reviewDecision: n.reviewDecision,
      isDraft: n.isDraft,
      state: n.state,
      mergeable: n.mergeable,
      commentsCount: n.comments.totalCount,
      commitsCount: n.commitHistory.totalCount,
    }))
  }

  private fingerprintsChanged(prev: PrPollFingerprint[], next: PrPollFingerprint[]): boolean {
    if (prev.length !== next.length) return true
    const prevById = new Map(prev.map((f) => [f.id, f]))
    for (const n of next) {
      const p = prevById.get(n.id)
      if (!p) return true
      if (
        p.updatedAt !== n.updatedAt ||
        p.headOid !== n.headOid ||
        p.ciRollupState !== n.ciRollupState ||
        p.reviewDecision !== n.reviewDecision ||
        p.isDraft !== n.isDraft ||
        p.state !== n.state ||
        p.mergeable !== n.mergeable ||
        p.commentsCount !== n.commentsCount ||
        p.commitsCount !== n.commitsCount
      ) {
        return true
      }
    }
    return false
  }

  private logRateLimit(label: string, rl: GhRateLimit): void {
    console.log(`[github:rateLimit:${label}] cost=${rl.cost} remaining=${rl.remaining} resetAt=${rl.resetAt}`)
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

  /** Fetches remaining pages of issue comments (conversation) when totalCount exceeds one GraphQL page. */
  private async collectAllIssueCommentNodes(
    pullRequestNodeId: string,
    connection: GhPullRequestNode['comments'],
  ): Promise<GhPullRequestNode['comments']['nodes']> {
    const nodes: GhPullRequestNode['comments']['nodes'] = [...connection.nodes]
    let hasNextPage = connection.pageInfo?.hasNextPage ?? false
    let cursor = connection.pageInfo?.endCursor ?? null
    for (let i = 0; i < MAX_ISSUE_COMMENT_PAGES && hasNextPage && cursor; i++) {
      const next = await this.fetchIssueCommentsAfter(pullRequestNodeId, cursor)
      nodes.push(...next.nodes)
      hasNextPage = next.pageInfo.hasNextPage
      cursor = next.pageInfo.endCursor
    }
    return nodes
  }

  private async fetchIssueCommentsAfter(
    pullRequestNodeId: string,
    after: string,
  ): Promise<Pick<GhPullRequestNode['comments'], 'nodes' | 'pageInfo'>> {
    const result = await this.runGhJson<GhCommentsContinuationResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PR_ISSUE_COMMENTS_PAGE_QUERY}`,
      '-F',
      `prId=${pullRequestNodeId}`,
      '-F',
      `after=${after}`,
    ])
    const conn = result.data.node?.comments
    if (!conn) {
      return {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [],
      }
    }
    return conn
  }

  /** Inline review comments live under `reviewThreads` (diff), not `PullRequest.comments`. */
  private async collectInlineReviewComments(
    pullRequestNodeId: string,
    initialThreads: GhReviewThreadsConnection,
  ): Promise<GithubPullRequestComment[]> {
    const threads = await this.collectAllReviewThreadNodes(pullRequestNodeId, initialThreads)
    const out: GithubPullRequestComment[] = []
    for (const thread of threads) {
      const rawNodes = await this.collectAllReviewCommentNodesInThread(thread.id, thread.comments)
      for (const n of rawNodes) {
        out.push(mapReviewThreadCommentNode(n))
      }
    }
    return out
  }

  private async collectAllReviewThreadNodes(
    pullRequestNodeId: string,
    initial: GhReviewThreadsConnection,
  ): Promise<GhReviewThreadNode[]> {
    const nodes = [...initial.nodes]
    let hasNextPage = initial.pageInfo?.hasNextPage ?? false
    let cursor = initial.pageInfo?.endCursor ?? null
    for (let i = 0; i < MAX_REVIEW_THREAD_ROOT_PAGES && hasNextPage && cursor; i++) {
      const next = await this.fetchReviewThreadsAfter(pullRequestNodeId, cursor)
      nodes.push(...next.nodes)
      hasNextPage = next.pageInfo.hasNextPage
      cursor = next.pageInfo.endCursor
    }
    return nodes
  }

  private async fetchReviewThreadsAfter(
    pullRequestNodeId: string,
    after: string,
  ): Promise<Pick<GhReviewThreadsConnection, 'nodes' | 'pageInfo'>> {
    const result = await this.runGhJson<GhReviewThreadsContinuationResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PR_REVIEW_THREADS_PAGE_QUERY}`,
      '-F',
      `prId=${pullRequestNodeId}`,
      '-F',
      `after=${after}`,
    ])
    const conn = result.data.node?.reviewThreads
    if (!conn) {
      return {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [],
      }
    }
    return conn
  }

  private async collectAllReviewCommentNodesInThread(
    threadId: string,
    initial: GhReviewThreadCommentsConnection,
  ): Promise<GhReviewCommentNode[]> {
    const nodes: GhReviewCommentNode[] = [...initial.nodes]
    let hasNextPage = initial.pageInfo?.hasNextPage ?? false
    let cursor = initial.pageInfo?.endCursor ?? null
    for (let i = 0; i < MAX_REVIEW_THREAD_COMMENT_PAGES && hasNextPage && cursor; i++) {
      const next = await this.fetchReviewThreadCommentsAfter(threadId, cursor)
      nodes.push(...next.nodes)
      hasNextPage = next.pageInfo.hasNextPage
      cursor = next.pageInfo.endCursor
    }
    return nodes
  }

  private async fetchReviewThreadCommentsAfter(
    threadId: string,
    after: string,
  ): Promise<Pick<GhReviewThreadCommentsConnection, 'nodes' | 'pageInfo'>> {
    const result = await this.runGhJson<GhReviewThreadCommentsContinuationResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PR_REVIEW_THREAD_COMMENTS_PAGE_QUERY}`,
      '-F',
      `threadId=${threadId}`,
      '-F',
      `after=${after}`,
    ])
    const conn = result.data.node?.comments
    if (!conn) {
      return {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [],
      }
    }
    return conn
  }

  private async fetchGithubData(): Promise<{
    repositories: GithubRepository[]
    pullRequests: GithubPullRequest[]
    rateLimit: GhRateLimit
  }> {
    console.log('[fetchGithubData] called')
    const result = await this.runGhJson<GhGraphqlResponse>([
      'api',
      'graphql',
      '-f',
      `query=${PULL_REQUEST_QUERY}`,
      '-F',
      `prLimit=${PR_SEARCH_LIMIT}`,
    ])

    const repositoriesById = new Map<string, GithubRepository>()
    const rawPrNodes = result.data.search.nodes.filter((node): node is GhPullRequestNode =>
      Boolean(node?.repository?.id),
    )

    const pullRequests = (
      await Promise.all(
        rawPrNodes.map(async (node) => {
          const commentNodes = await this.collectAllIssueCommentNodes(node.id, node.comments)
          const issueComments = mapIssueComments(commentNodes)
          const reviewTimeline = await this.collectInlineReviewComments(node.id, node.reviewThreads)
          const mergedComments = mergePrCommentTimeline(issueComments, reviewTimeline)

          console.log(`[comments:${node.number}] "${node.title}"`, {
            issueCommentsFetched: issueComments.length,
            reviewThreadCommentsFetched: reviewTimeline.length,
            merged: mergedComments.map((c) => ({
              id: c.id,
              author: c.authorLogin,
              diffPath: c.diffPath ?? null,
              preview: c.body.slice(0, 80).replace(/\n/g, ' '),
            })),
          })

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
            comments: mergedComments,
            commitsCount: node.commitHistory.totalCount,
            commits: mapPullRequestCommits(node.commitHistory.nodes),
            ciRollupState: ciRollup?.state ?? null,
            ciStatuses: (ciRollup?.contexts.nodes ?? []).map((statusNode, index) =>
              mapStatusCheckNode(node.id, index, statusNode),
            ),
          } satisfies GithubPullRequest
        }),
      )
    ).sort((left, right) => right.updatedAt - left.updatedAt)

    const repositories = [...repositoriesById.values()].sort((left, right) => {
      const leftUpdated = left.updatedAt ?? 0
      const rightUpdated = right.updatedAt ?? 0
      return rightUpdated - leftUpdated
    })

    return { repositories, pullRequests, rateLimit: result.data.rateLimit }
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
    if (!this.settings.nativeNotifications) return
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
    const { eventSounds, soundOnPrUpdates, notificationSound } = this.settings

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
    await this.refresh()
    return this.githubStore.getSnapshot()
  }

  async squashAndMerge(prUrl: string): Promise<void> {
    try {
      await execFileAsync('gh', ['pr', 'merge', prUrl, '--squash', '--delete-branch'], {
        cwd: app.getPath('home'),
        env: process.env,
      })
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
      const message = (e.stderr ?? e.stdout ?? e.message ?? String(err)).trim()
      throw new Error(message)
    }
    // Wait briefly before refreshing — GitHub may still be processing the merge,
    // so an immediate refresh could return stale data.
    await new Promise<void>((resolve) => setTimeout(resolve, 1500))
    void this.refresh()
  }

  private async setRepoPath(nameWithOwner: string, localPath: string): Promise<void> {
    const paths = { ...this.settings.localRepoPaths }
    if (localPath) {
      paths[nameWithOwner] = localPath
    } else {
      delete paths[nameWithOwner]
    }
    const next: GithubSettings = { ...this.settings, localRepoPaths: paths }
    this.githubStore.commitSettings(next)
    await this.persistSettings(next)
  }

  private async checkoutBranch(nameWithOwner: string, branch: string): Promise<void> {
    const localPath = this.settings.localRepoPaths[nameWithOwner]
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
    authorAvatarUrl: n.author?.avatarUrl ?? null,
    authorAssociation: n.authorAssociation,
    body: n.body ?? '',
    createdAt: toTimestamp(n.createdAt) ?? Date.now(),
    updatedAt: toTimestamp(n.updatedAt) ?? Date.now(),
    isMinimized: n.isMinimized,
    minimizedReason: n.minimizedReason,
    reactionGroups: n.reactionGroups
      .filter((rg) => rg.users.totalCount > 0)
      .map((rg) => ({ content: rg.content, count: rg.users.totalCount })),
  }))
  return mapped.sort((a, b) => a.createdAt - b.createdAt)
}

function mapReviewThreadCommentNode(n: GhReviewCommentNode): GithubPullRequestComment {
  return {
    id: n.id,
    url: n.url,
    authorLogin: n.author?.login ?? null,
    authorAvatarUrl: n.author?.avatarUrl ?? null,
    authorAssociation: n.authorAssociation,
    body: n.body ?? '',
    createdAt: toTimestamp(n.createdAt) ?? Date.now(),
    updatedAt: toTimestamp(n.updatedAt) ?? Date.now(),
    isMinimized: false,
    minimizedReason: null,
    reactionGroups: n.reactionGroups
      .filter((rg) => rg.users.totalCount > 0)
      .map((rg) => ({ content: rg.content, count: rg.users.totalCount })),
    diffPath: n.path || null,
  }
}

function mergePrCommentTimeline(
  issue: GithubPullRequestComment[],
  review: GithubPullRequestComment[],
): GithubPullRequestComment[] {
  return [...issue, ...review].sort((a, b) => a.createdAt - b.createdAt)
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
