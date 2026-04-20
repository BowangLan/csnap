import type { BugStatus, GithubPullRequestComment } from '../github'

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

export interface DetectedBug {
  commentId: string
  prId: string
  severity: BugSeverity
  status: BugStatus
  title: string
  suggestedFix: string | null
  aiPrompt: string | null
  affectedLocations: string[]
  referenceId: string | null
  /** Same as the source comment's `createdAt` (GitHub posting time). */
  detectedAt: number
}

/**
 * A single detection + parsing pipeline for one comment format within a source.
 *
 * Most sources have one handler; some (e.g. a bot that posts two distinct
 * comment formats) may register two.
 */
export interface BugHandler {
  /** Quick test — does this comment belong to this handler? */
  match(comment: GithubPullRequestComment): boolean
  /** Parse a matched comment into a DetectedBug. Returns null if parsing fails despite match. */
  parse(prId: string, comment: GithubPullRequestComment): DetectedBug | null
  /** Infer bug status from the comment body and GitHub metadata. */
  inferStatus(comment: GithubPullRequestComment): BugStatus
}

/**
 * A bug ingestion source groups related handlers under a single identity.
 * Register sources via `registerBugSource()` in `bug-detection/index.ts`.
 */
export interface BugSource {
  /** Unique key, e.g. `'sentry'`, `'coderabbit'`. */
  id: string
  handlers: BugHandler[]
}
