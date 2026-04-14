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

export interface GithubPullRequestReviewer {
  login: string
  avatarUrl: string | null
  state: string
}

export interface GithubPullRequestComment {
  id: string
  url: string
  authorLogin: string | null
  body: string
  createdAt: number
}

export interface GithubPullRequestCommit {
  oid: string
  messageHeadline: string
  url: string
  authoredAt: number
  authorLogin: string | null
  authorName: string | null
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
  /** Issue comments on the PR (newest batch from sync). */
  comments: GithubPullRequestComment[]
  commitsCount: number
  /** Git commits on the PR branch (recent batch from sync, newest first). */
  commits: GithubPullRequestCommit[]
  headRefName: string
  /** Base branch when provided by sync; otherwise UI may assume `main`. */
  baseRefName?: string
  /** Markdown body when provided by sync. */
  body?: string
  reviewers?: GithubPullRequestReviewer[]
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

export type PrNotificationEvent =
  | 'allCiFailed'
  | 'allCiPassed'
  | 'ciCheckCompleted'
  | 'newCommit'
  | 'prApproved'
  | 'otherChange'

export const MACOS_NOTIFICATION_SOUNDS = [
  'Basso',
  'Blow',
  'Bottle',
  'Frog',
  'Funk',
  'Glass',
  'Hero',
  'Morse',
  'Ping',
  'Pop',
  'Purr',
  'Sosumi',
  'Submarine',
  'Tink',
] as const

export type MacOsNotificationSound = (typeof MACOS_NOTIFICATION_SOUNDS)[number]

export interface EventSoundConfig {
  enabled: boolean
  sound: MacOsNotificationSound
}

export interface GithubSettings {
  refreshIntervalSeconds: number
  soundOnPrUpdates: boolean
  notificationSound: MacOsNotificationSound
  eventSounds: {
    newCommit: EventSoundConfig
    ciCheckComplete: EventSoundConfig
    allCiPassed: EventSoundConfig
    allCiFailed: EventSoundConfig
    prApproved: EventSoundConfig
  }
  nativeNotifications: boolean
  /** Maps `nameWithOwner` (e.g. "owner/repo") to an absolute local folder path. */
  localRepoPaths: Record<string, string>
}

export interface GithubAuthStatus {
  isAuthenticated: boolean
  activeLogin: string | null
}

export interface GithubAccount {
  login: string
  hostname: string
  isActive: boolean
}

export interface GithubSyncState {
  isRefreshing: boolean
  lastRefreshedAt: number | null
  lastUpdateDetectedAt: number | null
  lastError: string | null
}

export interface LocalRepoGitStatus {
  nameWithOwner: string
  localPath: string
  branch: string | null
  aheadCount: number
  behindCount: number
  changedCount: number
  untrackedCount: number
  hasConflicts: boolean
  syncedAt: number
  error: string | null
}

export interface GithubSnapshot {
  auth: GithubAuthStatus
  repositories: GithubRepository[]
  pullRequests: GithubPullRequest[]
  settings: GithubSettings
  sync: GithubSyncState
  localRepoStatuses: Record<string, LocalRepoGitStatus>
}

export const DEFAULT_EVENT_SOUNDS: GithubSettings['eventSounds'] = {
  newCommit: { enabled: true, sound: 'Tink' },
  ciCheckComplete: { enabled: false, sound: 'Ping' },
  allCiPassed: { enabled: true, sound: 'Glass' },
  allCiFailed: { enabled: true, sound: 'Basso' },
  prApproved: { enabled: true, sound: 'Hero' },
}

export const DEFAULT_GITHUB_SETTINGS: GithubSettings = {
  refreshIntervalSeconds: 60,
  soundOnPrUpdates: true,
  notificationSound: 'Glass',
  eventSounds: DEFAULT_EVENT_SOUNDS,
  nativeNotifications: true,
  localRepoPaths: {},
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
  localRepoStatuses: {},
}
