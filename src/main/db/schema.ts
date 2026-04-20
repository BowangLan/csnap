import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const todosTable = sqliteTable('todos', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  deletedAt: integer('deleted_at'),
})

export const githubPullRequestsTable = sqliteTable('github_pull_requests', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id').notNull(),
  repositoryNameWithOwner: text('repository_name_with_owner').notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  state: text('state').notNull(),
  isDraft: integer('is_draft', { mode: 'boolean' }).notNull(),
  reviewDecision: text('review_decision'),
  mergeable: text('mergeable'),
  authorLogin: text('author_login'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  additions: integer('additions').notNull(),
  deletions: integer('deletions').notNull(),
  changedFiles: integer('changed_files').notNull(),
  commentsCount: integer('comments_count').notNull(),
  commitsCount: integer('commits_count').notNull(),
  headRefName: text('head_ref_name').notNull(),
  baseRefName: text('base_ref_name'),
  body: text('body'),
  ciRollupState: text('ci_rollup_state'),
  commentsJson: text('comments_json').notNull(),
  commitsJson: text('commits_json').notNull(),
  ciStatusesJson: text('ci_statuses_json').notNull(),
  reviewersJson: text('reviewers_json'),
})

export const githubRepositoriesTable = sqliteTable('github_repositories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameWithOwner: text('name_with_owner').notNull(),
  url: text('url').notNull(),
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull(),
  defaultBranch: text('default_branch'),
  updatedAt: integer('updated_at'),
  pushedAt: integer('pushed_at'),
  openPullRequestCount: integer('open_pull_request_count').notNull(),
})

export const githubSyncStateTable = sqliteTable('github_sync_state', {
  id: text('id').primaryKey(),
  isRefreshing: integer('is_refreshing', { mode: 'boolean' }).notNull().default(false),
  lastRefreshedAt: integer('last_refreshed_at'),
  lastUpdateDetectedAt: integer('last_update_detected_at'),
  lastError: text('last_error'),
})

export const githubAuthStateTable = sqliteTable('github_auth_state', {
  id: text('id').primaryKey(),
  isAuthenticated: integer('is_authenticated', { mode: 'boolean' }).notNull().default(false),
  activeLogin: text('active_login'),
})

export const githubSettingsTable = sqliteTable('github_settings', {
  id: text('id').primaryKey(),
  settingsJson: text('settings_json').notNull(),
})

export const prBugsTable = sqliteTable('pr_bugs', {
  id: text('id').primaryKey(),
  prId: text('pr_id').notNull(),
  commentId: text('comment_id').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull().default('todo'),
  manualStatus: integer('manual_status', { mode: 'boolean' }).notNull().default(false),
  title: text('title').notNull(),
  suggestedFix: text('suggested_fix'),
  aiPrompt: text('ai_prompt'),
  affectedLocationsJson: text('affected_locations_json').notNull(),
  referenceId: text('reference_id'),
  diffPath: text('diff_path'),
  detectedAt: integer('detected_at').notNull(),
})

export const localCommandLogsTable = sqliteTable('local_command_logs', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(),
  command: text('command').notNull(),
  argsJson: text('args_json').notNull(),
  cwd: text('cwd').notNull(),
  status: text('status').notNull(),
  output: text('output').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
})

export const schema = {
  todosTable,
  githubPullRequestsTable,
  githubRepositoriesTable,
  githubSyncStateTable,
  githubAuthStateTable,
  githubSettingsTable,
  prBugsTable,
  localCommandLogsTable,
}

export type AppSchema = typeof schema
