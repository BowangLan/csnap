import type { GithubPullRequestComment } from './github'

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

export interface DetectedBug {
  commentId: string
  prId: string
  severity: BugSeverity
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
      title: parseTitle(c.body),
      suggestedFix: parseSuggestedFix(c.body),
      aiPrompt: parseAiPrompt(c.body),
      affectedLocations: parseAffectedLocations(c.body),
      referenceId: parseReferenceId(c.body),
      detectedAt: c.createdAt,
    }))
}
