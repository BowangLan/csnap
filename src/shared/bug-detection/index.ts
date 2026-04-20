/**
 * Bug ingestion pipeline.
 *
 * Each `BugSource` groups one or more `BugHandler`s that know how to detect
 * and parse bugs from PR comments in a specific format.
 *
 * To add a new source:
 *   1. Create `src/shared/bug-detection/<source>.ts` exporting a `BugSource`.
 *   2. Import it here and append it to `sources`.
 */

import type { BugStatus, GithubPullRequestComment } from '../github'
import type { BugSource, DetectedBug } from './types'
import { sentrySource } from './sentry'
import { coderabbitSource } from './coderabbit'

export type { BugSeverity, DetectedBug, BugHandler, BugSource } from './types'

// ── Source Registry ──────────────────────────────────────────────────────

const sources: BugSource[] = [sentrySource, coderabbitSource]

export function registerBugSource(source: BugSource): void {
  sources.push(source)
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Scan PR comments through all registered sources and return every detected bug.
 * Each comment is matched against sources in registration order; the first
 * source whose handler matches wins (a comment can only produce one bug).
 */
export function detectBugsInComments(
  prId: string,
  comments: GithubPullRequestComment[],
): DetectedBug[] {
  const results: DetectedBug[] = []

  for (const comment of comments) {
    const bug = matchAndParse(prId, comment)
    if (bug) results.push(bug)
  }

  return results
}

/**
 * Infer bug status from a comment that was previously detected as a bug.
 * Delegates to the matching source's handler; returns `'todo'` if no source
 * recognises the comment (should not happen for known bug comments).
 */
export function inferBugStatusFromComment(comment: GithubPullRequestComment): BugStatus {
  for (const source of sources) {
    for (const handler of source.handlers) {
      if (handler.match(comment)) {
        return handler.inferStatus(comment)
      }
    }
  }
  return 'todo'
}

// ── Internals ────────────────────────────────────────────────────────────

function matchAndParse(
  prId: string,
  comment: GithubPullRequestComment,
): DetectedBug | null {
  for (const source of sources) {
    for (const handler of source.handlers) {
      if (!handler.match(comment)) continue
      return handler.parse(prId, comment)
    }
  }
  return null
}
