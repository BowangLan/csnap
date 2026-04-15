import type { BugStatus, GithubPullRequestComment } from './github'

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

const BUG_MARKER = '<!-- BUG_PREDICTION -->'

function parseSeverity(body: string): BugSeverity {
  const match = body.match(/<sub>Severity:\s*(LOW|MEDIUM|HIGH|CRITICAL)<\/sub>/i)
  if (!match) return 'UNKNOWN'
  return match[1].toUpperCase() as BugSeverity
}

function parseTitle(body: string): string {
  const match = body.match(/\*\*Bug:\*\*\s*(.+?)(?:\n|$)/)
  return match ? match[1].trim() : 'Bug detected'
}

function parseSuggestedFix(body: string): string | null {
  const match = body.match(
    /<details>\s*<summary[^>]*>\s*<b[^>]*>Suggested Fix<\/b>\s*<\/summary>([\s\S]*?)<\/details>/,
  )
  if (!match) return null
  return match[1].trim() || null
}

function parseAiPrompt(body: string): string | null {
  // Match <details> or <details open> whose summary contains "Prompt for AI Agent"
  const match = body.match(
    /<details(?:\s+open)?>\s*<summary[^>]*>\s*<b[^>]*>Prompt for AI Agent<\/b>\s*<\/summary>([\s\S]*?)<\/details>/,
  )
  if (!match) return null
  const inner = match[1].trim()
  // Strip wrapping triple-backtick code fence if present
  const fenced = inner.match(/^```[^\n]*\n([\s\S]*?)```\s*$/)
  return (fenced ? fenced[1].trim() : inner) || null
}

function parseAffectedLocations(body: string): string[] {
  const section = body.match(/Also affects:\s*([\s\S]*?)(?:\n\n|\n<sub>|$)/)
  if (!section) return []
  return Array.from(section[1].matchAll(/^-\s*`([^`]+)`/gm), (m) => m[1])
}

function parseReferenceId(body: string): string | null {
  const hiddenMatch = body.match(/<!--\s*\n?<sub>Reference ID:\s*`([^`]+)`<\/sub>\s*-->/)
  if (hiddenMatch) return hiddenMatch[1]
  const titleMatch = body.match(/title="Reference ID:\s*`([^`]+)`"/)
  if (titleMatch) return titleMatch[1]
  return null
}

/**
 * Markdown line often appended when fixed, e.g.
 * *Resolved in [`042069c`](https://github.com/org/repo/commit/abc...)*
 * Require `/commit/` in the URL so generic links do not flip status.
 */
function hasResolvedInCommitLink(body: string): boolean {
  if (/\bResolved in\s*\[[^\]]+\]\([^)]*\/commit\/[^)]*\)/i.test(body)) return true
  if (/Resolved in\s*<a[^>]+href="[^"]*\/commit\/[^"]*"/i.test(body)) return true
  return false
}

/**
 * Infer resolution from bug-prediction comment HTML/markdown and GitHub metadata.
 * Authors can mark resolved with `<!-- BUG_RESOLVED -->`, `<sub>Status: RESOLVED</sub>`,
 * or *Resolved in [`abc123`](https://github.com/.../commit/...)* after a fix.
 */
export function inferBugStatusFromComment(comment: GithubPullRequestComment): BugStatus {
  const body = comment.body
  if (/<!--\s*BUG_RESOLVED\s*-->/i.test(body)) return 'resolved'
  if (/<!--\s*BUG_STATUS:\s*resolved\s*-->/i.test(body)) return 'resolved'
  if (/<sub>Status:\s*(RESOLVED|FIXED|DONE|CLOSED)<\/sub>/i.test(body)) return 'resolved'
  if (/\*\*Status:\*\*\s*(resolved|fixed|done|closed)\b/i.test(body)) return 'resolved'
  if (/^\s*✅\s*\*?\*?(?:Resolved|Fixed|Done)\b/im.test(body)) return 'resolved'
  if (hasResolvedInCommitLink(body)) return 'resolved'

  if (
    comment.isMinimized &&
    /\b(outdated|resolved|addressed|fixed)\b/i.test(comment.minimizedReason ?? '')
  ) {
    return 'resolved'
  }

  return 'todo'
}

export function detectBugsInComments(
  prId: string,
  comments: GithubPullRequestComment[],
): DetectedBug[] {
  return comments
    .filter((c) => c.body.includes(BUG_MARKER))
    .map((c) => ({
      commentId: c.id,
      prId,
      severity: parseSeverity(c.body),
      status: inferBugStatusFromComment(c),
      title: parseTitle(c.body),
      suggestedFix: parseSuggestedFix(c.body),
      aiPrompt: parseAiPrompt(c.body),
      affectedLocations: parseAffectedLocations(c.body),
      referenceId: parseReferenceId(c.body),
      detectedAt: c.createdAt,
    }))
}
