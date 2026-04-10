export interface GithubRepository {
  id: string
  name: string
  nameWithOwner: string
  url: string
  isPrivate: boolean
  defaultBranch: string | null
  updatedAt: number | null
  pushedAt: number | null
  openPullRequestCount: number
}

export interface GithubPullRequest {
  id: string
  repositoryId: string
  repositoryNameWithOwner: string
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  reviewDecision: string | null
  mergeable: string | null
  authorLogin: string | null
  createdAt: number
  updatedAt: number
  additions: number
  deletions: number
  changedFiles: number
  commentsCount: number
  commitsCount: number
  headRefName: string
  ciRollupState: string | null
  ciStatuses: GithubPullRequestCiStatus[]
}

export interface GithubPullRequestCiStatus {
  id: string
  name: string
  kind: 'check-run' | 'status-context'
  status: string
  conclusion: string | null
  detailsUrl: string | null
  workflowName: string | null
}

export interface GithubSettings {
  refreshIntervalSeconds: number
  soundOnPrUpdates: boolean
}

export interface GithubAuthStatus {
  isAuthenticated: boolean
  activeLogin: string | null
}

export interface GithubSyncState {
  isRefreshing: boolean
  lastRefreshedAt: number | null
  lastUpdateDetectedAt: number | null
  lastError: string | null
}

export interface GithubSnapshot {
  auth: GithubAuthStatus
  repositories: GithubRepository[]
  pullRequests: GithubPullRequest[]
  settings: GithubSettings
  sync: GithubSyncState
}

export const DEFAULT_GITHUB_SETTINGS: GithubSettings = {
  refreshIntervalSeconds: 60,
  soundOnPrUpdates: true,
}

export const EMPTY_GITHUB_SNAPSHOT: GithubSnapshot = {
  auth: {
    isAuthenticated: false,
    activeLogin: null,
  },
  repositories: [],
  pullRequests: [],
  settings: DEFAULT_GITHUB_SETTINGS,
  sync: {
    isRefreshing: false,
    lastRefreshedAt: null,
    lastUpdateDetectedAt: null,
    lastError: null,
  },
}
