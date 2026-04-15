import { Events, Schema, State, makeSchema, type QueryBuilder } from '@livestore/livestore'
import type {
  GithubPullRequest,
  GithubPullRequestComment,
  GithubSettings,
  PrBug,
} from '../github'
import { detectBugsInComments } from '../bug-detection'

// ─── Row types (stored in SQLite) ────────────────────────────────────────────

/**
 * Flat representation of a GithubPullRequest stored in SQLite.
 * Nested arrays (comments, commits, ciStatuses, reviewers) are JSON-serialised
 * into text columns because LiveStore's table API assumes scalar column values.
 */
export interface PullRequestRow {
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
  baseRefName: string | null
  body: string | null
  ciRollupState: string | null
  commentsJson: string   // JSON.stringify(GithubPullRequestComment[])
  commitsJson: string    // JSON.stringify(GithubPullRequestCommit[])
  ciStatusesJson: string // JSON.stringify(GithubPullRequestCiStatus[])
  reviewersJson: string | null // JSON.stringify(GithubPullRequestReviewer[]) | null
}

export function prToRow(pr: GithubPullRequest): PullRequestRow {
  return {
    id: pr.id,
    repositoryId: pr.repositoryId,
    repositoryNameWithOwner: pr.repositoryNameWithOwner,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    isDraft: pr.isDraft,
    reviewDecision: pr.reviewDecision,
    mergeable: pr.mergeable,
    authorLogin: pr.authorLogin,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    commentsCount: pr.commentsCount,
    commitsCount: pr.commitsCount,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName ?? null,
    body: pr.body ?? null,
    ciRollupState: pr.ciRollupState,
    commentsJson: JSON.stringify(pr.comments),
    commitsJson: JSON.stringify(pr.commits),
    ciStatusesJson: JSON.stringify(pr.ciStatuses),
    reviewersJson: pr.reviewers ? JSON.stringify(pr.reviewers) : null,
  }
}

export function rowToPr(row: PullRequestRow): GithubPullRequest {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    repositoryNameWithOwner: row.repositoryNameWithOwner,
    number: row.number,
    title: row.title,
    url: row.url,
    state: row.state,
    isDraft: row.isDraft,
    reviewDecision: row.reviewDecision,
    mergeable: row.mergeable,
    authorLogin: row.authorLogin,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    additions: row.additions,
    deletions: row.deletions,
    changedFiles: row.changedFiles,
    commentsCount: row.commentsCount,
    commitsCount: row.commitsCount,
    headRefName: row.headRefName,
    baseRefName: row.baseRefName ?? undefined,
    body: row.body ?? undefined,
    ciRollupState: row.ciRollupState,
    comments: JSON.parse(row.commentsJson) as GithubPullRequest['comments'],
    commits: JSON.parse(row.commitsJson) as GithubPullRequest['commits'],
    ciStatuses: JSON.parse(row.ciStatusesJson) as GithubPullRequest['ciStatuses'],
    reviewers: row.reviewersJson
      ? (JSON.parse(row.reviewersJson) as GithubPullRequest['reviewers'])
      : undefined,
  }
}

// ─── Row types ────────────────────────────────────────────────────────────────

export interface BugRow {
  id: string
  prId: string
  commentId: string
  severity: string
  status: string
  /** User-locked status; preserved when `githubDataSynced` rebuilds bug rows. */
  manualStatus: boolean
  title: string
  suggestedFix: string | null
  aiPrompt: string | null
  affectedLocationsJson: string  // JSON.stringify(string[])
  referenceId: string | null
  detectedAt: number
}

function parseStoredBugStatus(raw: string | undefined): PrBug['status'] {
  if (raw === 'resolved' || raw === 'ignored' || raw === 'in-progress') return raw
  return 'todo'
}

export function bugRowToPrBug(row: BugRow): PrBug {
  const status = parseStoredBugStatus(row.status)
  return {
    id: row.id,
    prId: row.prId,
    commentId: row.commentId,
    severity: row.severity as PrBug['severity'],
    status,
    statusIsManual: Boolean(row.manualStatus),
    title: row.title,
    suggestedFix: row.suggestedFix,
    aiPrompt: row.aiPrompt,
    affectedLocations: JSON.parse(row.affectedLocationsJson) as string[],
    referenceId: row.referenceId,
    detectedAt: row.detectedAt,
  }
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export const githubTables = {
  pullRequests: State.SQLite.table({
    name: 'githubPullRequests',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      repositoryId: State.SQLite.text(),
      repositoryNameWithOwner: State.SQLite.text(),
      number: State.SQLite.integer(),
      title: State.SQLite.text(),
      url: State.SQLite.text(),
      state: State.SQLite.text(),
      isDraft: State.SQLite.boolean(),
      reviewDecision: State.SQLite.text({ nullable: true }),
      mergeable: State.SQLite.text({ nullable: true }),
      authorLogin: State.SQLite.text({ nullable: true }),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
      additions: State.SQLite.integer(),
      deletions: State.SQLite.integer(),
      changedFiles: State.SQLite.integer(),
      commentsCount: State.SQLite.integer(),
      commitsCount: State.SQLite.integer(),
      headRefName: State.SQLite.text(),
      baseRefName: State.SQLite.text({ nullable: true }),
      body: State.SQLite.text({ nullable: true }),
      ciRollupState: State.SQLite.text({ nullable: true }),
      commentsJson: State.SQLite.text(),
      commitsJson: State.SQLite.text(),
      ciStatusesJson: State.SQLite.text(),
      reviewersJson: State.SQLite.text({ nullable: true }),
    },
  }),

  repositories: State.SQLite.table({
    name: 'githubRepositories',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      name: State.SQLite.text(),
      nameWithOwner: State.SQLite.text(),
      url: State.SQLite.text(),
      isPrivate: State.SQLite.boolean(),
      defaultBranch: State.SQLite.text({ nullable: true }),
      updatedAt: State.SQLite.integer({ nullable: true }),
      pushedAt: State.SQLite.integer({ nullable: true }),
      openPullRequestCount: State.SQLite.integer(),
    },
  }),

  syncState: State.SQLite.table({
    name: 'githubSyncState',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // always 'singleton'
      isRefreshing: State.SQLite.boolean({ default: false }),
      lastRefreshedAt: State.SQLite.integer({ nullable: true }),
      lastUpdateDetectedAt: State.SQLite.integer({ nullable: true }),
      lastError: State.SQLite.text({ nullable: true }),
    },
  }),

  authState: State.SQLite.table({
    name: 'githubAuthState',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // always 'singleton'
      isAuthenticated: State.SQLite.boolean({ default: false }),
      activeLogin: State.SQLite.text({ nullable: true }),
    },
  }),

  settings: State.SQLite.table({
    name: 'githubSettings',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // always 'singleton'
      settingsJson: State.SQLite.text(), // JSON.stringify(GithubSettings)
    },
  }),

  bugs: State.SQLite.table({
    name: 'prBugs',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),         // equals commentId
      prId: State.SQLite.text(),
      commentId: State.SQLite.text(),
      severity: State.SQLite.text(),
      status: State.SQLite.text({ default: 'todo' }),
      title: State.SQLite.text(),
      suggestedFix: State.SQLite.text({ nullable: true }),
      aiPrompt: State.SQLite.text({ nullable: true }),
      affectedLocationsJson: State.SQLite.text(),           // JSON.stringify(string[])
      referenceId: State.SQLite.text({ nullable: true }),
      detectedAt: State.SQLite.integer(),
      manualStatus: State.SQLite.boolean({ default: false }),
    },
  }),
}

// ─── Events ───────────────────────────────────────────────────────────────────

const RepoSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  nameWithOwner: Schema.String,
  url: Schema.String,
  isPrivate: Schema.Boolean,
  defaultBranch: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Number),
  pushedAt: Schema.NullOr(Schema.Number),
  openPullRequestCount: Schema.Number,
})

export const githubEvents = {
  /**
   * Emitted immediately when a full refresh starts so the UI can show a
   * loading state while the GitHub API call is in-flight.
   */
  githubSyncStarted: Events.synced({
    name: 'v1.GitHubSyncStarted',
    schema: Schema.Struct({}),
  }),

  /**
   * Emitted after a successful full refresh.  The materializer replaces all
   * PR and repository rows and updates auth/sync-state singletons atomically.
   */
  githubDataSynced: Events.synced({
    name: 'v1.GitHubDataSynced',
    schema: Schema.Struct({
      pullRequestRows: Schema.Array(Schema.Struct({
        id: Schema.String,
        repositoryId: Schema.String,
        repositoryNameWithOwner: Schema.String,
        number: Schema.Number,
        title: Schema.String,
        url: Schema.String,
        state: Schema.String,
        isDraft: Schema.Boolean,
        reviewDecision: Schema.NullOr(Schema.String),
        mergeable: Schema.NullOr(Schema.String),
        authorLogin: Schema.NullOr(Schema.String),
        createdAt: Schema.Number,
        updatedAt: Schema.Number,
        additions: Schema.Number,
        deletions: Schema.Number,
        changedFiles: Schema.Number,
        commentsCount: Schema.Number,
        commitsCount: Schema.Number,
        headRefName: Schema.String,
        baseRefName: Schema.NullOr(Schema.String),
        body: Schema.NullOr(Schema.String),
        ciRollupState: Schema.NullOr(Schema.String),
        commentsJson: Schema.String,
        commitsJson: Schema.String,
        ciStatusesJson: Schema.String,
        reviewersJson: Schema.NullOr(Schema.String),
      })),
      repositories: Schema.Array(RepoSchema),
      isAuthenticated: Schema.Boolean,
      activeLogin: Schema.NullOr(Schema.String),
      lastRefreshedAt: Schema.Number,
      lastUpdateDetectedAt: Schema.NullOr(Schema.Number),
    }),
  }),

  /**
   * Emitted when a refresh fails (GitHub API error or auth failure).
   */
  githubSyncFailed: Events.synced({
    name: 'v1.GitHubSyncFailed',
    schema: Schema.Struct({
      error: Schema.String,
      isAuthenticated: Schema.Boolean,
      activeLogin: Schema.NullOr(Schema.String),
    }),
  }),

  /**
   * Emitted whenever the user updates app settings.
   */
  githubSettingsUpdated: Events.synced({
    name: 'v1.GitHubSettingsUpdated',
    schema: Schema.Struct({
      settingsJson: Schema.String, // JSON.stringify(GithubSettings)
    }),
  }),

  /** User changed bug status in the UI (or cleared manual override to follow GitHub). */
  githubBugStatusSet: Events.synced({
    name: 'v1.GitHubBugStatusSet',
    schema: Schema.Struct({
      commentId: Schema.String,
      status: Schema.String,
      manual: Schema.Boolean,
    }),
  }),
}

// ─── Materializers ────────────────────────────────────────────────────────────

const githubMaterializers = State.SQLite.materializers(githubEvents, {
  'v1.GitHubSyncStarted': () =>
    githubTables.syncState
      .insert({ id: 'singleton', isRefreshing: true, lastRefreshedAt: null, lastUpdateDetectedAt: null, lastError: null })
      .onConflict('id', 'update', { isRefreshing: true, lastError: null }),

  'v1.GitHubDataSynced': (data, { query }) => {
    const newIds = new Set(data.pullRequestRows.map((pr) => pr.id))
    const currentIds = query(githubTables.pullRequests.select('id')) as readonly string[]
    const staleIds = currentIds.filter((id) => !newIds.has(id))

    const existingBugRows = query(githubTables.bugs.select()) as BugRow[]
    const manualStatusByCommentId = new Map<string, string>()
    for (const r of existingBugRows) {
      if (r.manualStatus) manualStatusByCommentId.set(r.id, r.status)
    }

    const detectedBugs = data.pullRequestRows.flatMap((row) => {
      const comments = JSON.parse(row.commentsJson) as GithubPullRequestComment[]
      return detectBugsInComments(row.id, comments).map((bug) => {
        const locked = manualStatusByCommentId.get(bug.commentId)
        const status = locked !== undefined ? locked : bug.status
        const manualStatus = locked !== undefined
        return {
          id: bug.commentId,
          prId: bug.prId,
          commentId: bug.commentId,
          severity: bug.severity,
          status,
          manualStatus,
          title: bug.title,
          suggestedFix: bug.suggestedFix,
          aiPrompt: bug.aiPrompt,
          affectedLocationsJson: JSON.stringify(bug.affectedLocations),
          referenceId: bug.referenceId,
          detectedAt: bug.detectedAt,
        }
      })
    })

    return [
      // Upsert all fetched PRs
      ...data.pullRequestRows.map((row) =>
        githubTables.pullRequests.insert(row).onConflict('id', 'replace'),
      ),
      // Remove PRs no longer returned by GitHub (closed/merged since last sync)
      ...staleIds.map((id) => githubTables.pullRequests.delete().where({ id })),
      // Remove bugs belonging to stale PRs
      ...staleIds.map((prId) => githubTables.bugs.delete().where({ prId })),
      // Refresh detected bugs: clear existing, insert current
      githubTables.bugs.delete(),
      ...detectedBugs.map((bug) =>
        githubTables.bugs.insert(bug).onConflict('id', 'replace'),
      ),
      // Upsert repositories
      ...data.repositories.map((repo) =>
        githubTables.repositories.insert(repo).onConflict('id', 'replace'),
      ),
      // Update auth singleton
      githubTables.authState
        .insert({ id: 'singleton', isAuthenticated: data.isAuthenticated, activeLogin: data.activeLogin })
        .onConflict('id', 'replace'),
      // Update sync state singleton
      githubTables.syncState
        .insert({
          id: 'singleton',
          isRefreshing: false,
          lastRefreshedAt: data.lastRefreshedAt,
          lastUpdateDetectedAt: data.lastUpdateDetectedAt ?? null,
          lastError: null,
        })
        .onConflict('id', 'replace'),
    ]
  },

  'v1.GitHubSyncFailed': (data) => {
    const ops: QueryBuilder<any, any, any>[] = [
      githubTables.syncState
        .insert({ id: 'singleton', isRefreshing: false, lastRefreshedAt: null, lastUpdateDetectedAt: null, lastError: data.error })
        .onConflict('id', 'update', { isRefreshing: false, lastError: data.error }),
      githubTables.authState
        .insert({ id: 'singleton', isAuthenticated: data.isAuthenticated, activeLogin: data.activeLogin })
        .onConflict('id', 'replace'),
    ]
    // Clear stale PR/repo/bug data when no longer authenticated.
    if (!data.isAuthenticated) {
      ops.push(githubTables.pullRequests.delete())
      ops.push(githubTables.repositories.delete())
      ops.push(githubTables.bugs.delete())
    }
    return ops
  },

  'v1.GitHubSettingsUpdated': ({ settingsJson }) =>
    githubTables.settings
      .insert({ id: 'singleton', settingsJson })
      .onConflict('id', 'replace'),

  'v1.GitHubBugStatusSet': ({ commentId, status, manual }) =>
    githubTables.bugs.update({ status, manualStatus: manual }).where({ id: commentId }),
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const githubState = State.SQLite.makeState({
  tables: githubTables,
  materializers: githubMaterializers,
})

export const githubSchema = makeSchema({ events: githubEvents, state: githubState })

// ─── Helper: settings serialisation ──────────────────────────────────────────

export function parseStoredSettings(settingsJson: string, defaults: GithubSettings): GithubSettings {
  try {
    return { ...defaults, ...(JSON.parse(settingsJson) as Partial<GithubSettings>) }
  } catch {
    return defaults
  }
}
