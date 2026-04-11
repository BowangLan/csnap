import type { GithubPullRequest } from '../../../shared/github'

const LINEAR_ISSUE_REGEX = /\b([A-Z][A-Z0-9]{1,7}-\d+)\b/i

/** Path after /issue/ — may be only KEY-123 or KEY-123-slug-title */
const LINEAR_ISSUE_KEY_PREFIX = /^([A-Z][A-Z0-9]{1,7}-\d+)/i

/**
 * Matches Linear issue URLs. Workspace segments precede `/issue/`; the host form
 * `linear.app/issue/KEY` has zero such segments (`[^/]+` repeat is zero times).
 * Scheme is optional so titles like `linear.app/acme/issue/ENG-123` still match.
 */
const LINEAR_ISSUE_URL =
  /(?:https?:\/\/)?(?:www\.)?linear\.app\/(?:[^/]+\/)*issue\/([^/\s#?]+)/gi

function stripTrailingLinkJunk(segment: string): string {
  return segment.replace(/[)\]}>'",.;]+$/, '')
}

function extractIssueKeyFromLinearUrls(text: string): string | null {
  const re = new RegExp(LINEAR_ISSUE_URL.source, LINEAR_ISSUE_URL.flags)
  for (const m of text.matchAll(re)) {
    const raw = stripTrailingLinkJunk(m[1])
    const key = raw.match(LINEAR_ISSUE_KEY_PREFIX)
    if (key) return key[1].toUpperCase()
  }
  return null
}

export function extractLinearIssueId(pr: GithubPullRequest): string | null {
  const fromTitleUrl = extractIssueKeyFromLinearUrls(pr.title)
  if (fromTitleUrl) return fromTitleUrl
  const fromBranchUrl = extractIssueKeyFromLinearUrls(pr.headRefName)
  if (fromBranchUrl) return fromBranchUrl

  const titleMatch = pr.title.match(LINEAR_ISSUE_REGEX)
  if (titleMatch) return titleMatch[1].toUpperCase()
  const branchMatch = pr.headRefName.match(LINEAR_ISSUE_REGEX)
  if (branchMatch) return branchMatch[1].toUpperCase()
  return null
}
