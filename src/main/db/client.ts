import { app } from 'electron'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { schema, type AppSchema } from './schema'

const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS github_pull_requests (
  id TEXT PRIMARY KEY NOT NULL,
  repository_id TEXT NOT NULL,
  repository_name_with_owner TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL,
  is_draft INTEGER NOT NULL,
  review_decision TEXT,
  mergeable TEXT,
  author_login TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  additions INTEGER NOT NULL,
  deletions INTEGER NOT NULL,
  changed_files INTEGER NOT NULL,
  comments_count INTEGER NOT NULL,
  commits_count INTEGER NOT NULL,
  head_ref_name TEXT NOT NULL,
  base_ref_name TEXT,
  body TEXT,
  ci_rollup_state TEXT,
  comments_json TEXT NOT NULL,
  commits_json TEXT NOT NULL,
  ci_statuses_json TEXT NOT NULL,
  reviewers_json TEXT
);

CREATE TABLE IF NOT EXISTS github_repositories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_with_owner TEXT NOT NULL,
  url TEXT NOT NULL,
  is_private INTEGER NOT NULL,
  default_branch TEXT,
  updated_at INTEGER,
  pushed_at INTEGER,
  open_pull_request_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS github_sync_state (
  id TEXT PRIMARY KEY NOT NULL,
  is_refreshing INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at INTEGER,
  last_update_detected_at INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS github_auth_state (
  id TEXT PRIMARY KEY NOT NULL,
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  active_login TEXT
);

CREATE TABLE IF NOT EXISTS github_settings (
  id TEXT PRIMARY KEY NOT NULL,
  settings_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pr_bugs (
  id TEXT PRIMARY KEY NOT NULL,
  pr_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  manual_status INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  suggested_fix TEXT,
  ai_prompt TEXT,
  affected_locations_json TEXT NOT NULL,
  reference_id TEXT,
  detected_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS local_command_logs (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  command TEXT NOT NULL,
  args_json TEXT NOT NULL,
  cwd TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
`

export class AppDatabase {
  private sqlite: Database.Database | null = null
  private dbInstance: BetterSQLite3Database<AppSchema> | null = null

  init(): void {
    if (this.sqlite && this.dbInstance) return

    const databasePath = join(app.getPath('userData'), 'app.sqlite')
    const sqlite = new Database(databasePath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(MIGRATIONS_SQL)

    this.sqlite = sqlite
    this.dbInstance = drizzle(sqlite, { schema })
  }

  get db(): BetterSQLite3Database<AppSchema> {
    if (!this.dbInstance) {
      throw new Error('Database has not been initialized yet.')
    }

    return this.dbInstance
  }

  shutdown(): void {
    this.sqlite?.close()
    this.sqlite = null
    this.dbInstance = null
  }
}
