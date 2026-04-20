/**
 * CodeRabbit review source.
 *
 * Matches individual inline review comments posted by `coderabbitai[bot]`.
 * Each comment contains a severity badge, bold title, optional proposed fix,
 * a committable suggestion block, and a `🤖 Prompt for AI Agents` section.
 *
 * Identified by the footer `<!-- This is an auto-generated comment by CodeRabbit -->`.
 * The large per-PR *summary* comment (with "for review status" in its footer
 * and "Actionable comments posted: N") is explicitly excluded.
 */

import type { BugStatus, GithubPullRequestComment } from '../github'
import type { BugHandler, BugSeverity, BugSource, DetectedBug } from './types'

const CR_INLINE_MARKER = '<!-- This is an auto-generated comment by CodeRabbit -->'
const CR_SUMMARY_FOOTER = 'for review status -->'
const CR_SUMMARY_HEADING = 'Actionable comments posted:'
const SENTRY_MARKER = '<!-- BUG_PREDICTION -->'

// ── Parsers ──────────────────────────────────────────────────────────────

const SEVERITY_RE = /_([\u{1F7E1}\u{1F7E0}\u{1F534}])\s*(Minor|Major|Critical)_/iu

function parseSeverity(body: string): BugSeverity {
  const match = body.match(SEVERITY_RE)
  if (!match) return 'UNKNOWN'
  switch (match[2].toLowerCase()) {
    case 'minor':
      return 'LOW'
    case 'major':
      return 'HIGH'
    case 'critical':
      return 'CRITICAL'
    default:
      return 'UNKNOWN'
  }
}

function parseTitle(body: string): string {
  const match = body.match(/^\*\*(.+?)\*\*\s*$/m)
  return match ? match[1].trim() : 'Code review finding'
}

function parseSuggestedFix(body: string): string | null {
  // The summary text after the emoji can have trailing context,
  // e.g. "🛡️ Proposed fix for consistent null-safety".
  const match = body.match(
    /<details>\s*<summary[^>]*>(?:[\s\S]*?)(?:Proposed fix|Suggested fix)[^<]*<\/summary>([\s\S]*?)<\/details>/i,
  )
  if (!match) return null
  return match[1].trim() || null
}

function parseAiPrompt(body: string): string | null {
  const match = body.match(
    /<details[^>]*>\s*<summary[^>]*>\s*\u{1F916}\s*Prompt for AI Agents?\s*<\/summary>([\s\S]*?)<\/details>/u,
  )
  if (!match) return null
  const inner = match[1].trim()
  const fenced = inner.match(/^```[^\n]*\n([\s\S]*?)```\s*$/)
  return (fenced ? fenced[1].trim() : inner) || null
}

function parseAffectedLocations(body: string): string[] {
  const promptSection = body.match(
    /<details[^>]*>\s*<summary[^>]*>\s*\u{1F916}\s*Prompt for AI Agents?\s*<\/summary>([\s\S]*?)<\/details>/u,
  )
  if (!promptSection) return []
  return Array.from(promptSection[1].matchAll(/`@([^`]+)`/g), (m) => m[1])
}

function parseFingerprint(body: string): string | null {
  const match = body.match(/<!--\s*fingerprinting:([^-]+)-->/)
  return match ? match[1].trim() : null
}

// ── Status Inference ─────────────────────────────────────────────────────

function inferStatus(comment: GithubPullRequestComment): BugStatus {
  const body = comment.body

  if (/^\s*\u2705\s*\*?\*?(?:Resolved|Fixed|Done)\b/im.test(body)) return 'resolved'

  if (
    comment.isMinimized &&
    /\b(outdated|resolved|addressed|fixed)\b/i.test(comment.minimizedReason ?? '')
  ) {
    return 'resolved'
  }

  return 'todo'
}

// ── Handlers ─────────────────────────────────────────────────────────────

/**
 * Matches individual CodeRabbit inline review comments.
 *
 * Positive signal: the auto-generated footer without "for review status".
 * Negative signals: sentry marker, summary heading/footer.
 */
const inlineReviewHandler: BugHandler = {
  match(comment: GithubPullRequestComment): boolean {
    const body = comment.body
    if (!body.includes(CR_INLINE_MARKER)) return false
    if (body.includes(SENTRY_MARKER)) return false
    if (body.includes(CR_SUMMARY_FOOTER)) return false
    if (body.includes(CR_SUMMARY_HEADING)) return false
    return true
  },

  parse(prId: string, comment: GithubPullRequestComment): DetectedBug {
    const body = comment.body
    return {
      commentId: comment.id,
      prId,
      severity: parseSeverity(body),
      status: inferStatus(comment),
      title: parseTitle(body),
      suggestedFix: parseSuggestedFix(body),
      aiPrompt: parseAiPrompt(body),
      affectedLocations: parseAffectedLocations(body),
      referenceId: parseFingerprint(body),
      detectedAt: comment.createdAt,
    }
  },

  inferStatus,
}

// ── Source ────────────────────────────────────────────────────────────────

export const coderabbitSource: BugSource = {
  id: 'coderabbit',
  handlers: [inlineReviewHandler],
}
