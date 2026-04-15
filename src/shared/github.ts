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

export interface GithubPullRequestReaction {
  content: string
  count: number
}

export interface GithubPullRequestComment {
  id: string
  url: string
  authorLogin: string | null
  authorAvatarUrl: string | null
  authorAssociation: string
  body: string
  createdAt: number
  updatedAt: number
  isMinimized: boolean
  minimizedReason: string | null
  reactionGroups: GithubPullRequestReaction[]
  /**
   * When set, this entry is an inline **pull request review** comment (diff),
   * not a conversation issue comment. GitHub exposes these under `reviewThreads`.
   */
  diffPath?: string | null
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
  /** Conversation issue comments plus inline diff review comments from `reviewThreads` (merged, chronological). */
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

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

/** Tracked bug workflow; `resolved` is inferred from comment body / GitHub state on sync. */
export type BugStatus = 'todo' | 'resolved' | 'ignored' | 'in-progress'

export interface PrBug {
  /** Stable ID — equals the source comment's ID (one bug per comment). */
  id: string
  prId: string
  commentId: string
  severity: BugSeverity
  /** Default `todo`; set to `resolved` when the synced comment indicates resolution. */
  status: BugStatus
  /**
   * When true, `status` was set in the app and is kept across GitHub syncs until
   * the user chooses “Follow GitHub” again.
   */
  statusIsManual: boolean
  title: string
  suggestedFix: string | null
  aiPrompt: string | null
  affectedLocations: string[]
  referenceId: string | null
  /** Unix ms — matches the source GitHub comment's `createdAt`. */
  detectedAt: number
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
  bugs: PrBug[]
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
  bugs: [],
  settings: DEFAULT_GITHUB_SETTINGS,
  sync: {
    isRefreshing: false,
    lastRefreshedAt: null,
    lastUpdateDetectedAt: null,
    lastError: null,
  },
  localRepoStatuses: {},
}
