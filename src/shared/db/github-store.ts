import type {
  GithubPullRequest,
  GithubPullRequestComment,
  GithubSettings,
  PrBug,
} from '../github'
import { detectBugsInComments } from '../bug-detection'

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
  commentsJson: string
  commitsJson: string
  ciStatusesJson: string
  reviewersJson: string | null
}

export interface BugRow {
  id: string
  prId: string
  commentId: string
  severity: string
  status: string
  manualStatus: boolean
  title: string
  suggestedFix: string | null
  aiPrompt: string | null
  affectedLocationsJson: string
  referenceId: string | null
  detectedAt: number
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

function parseStoredBugStatus(raw: string | undefined): PrBug['status'] {
  if (raw === 'resolved' || raw === 'ignored' || raw === 'in-progress') return raw
  return 'todo'
}

export function bugRowToPrBug(row: BugRow): PrBug {
  return {
    id: row.id,
    prId: row.prId,
    commentId: row.commentId,
    severity: row.severity as PrBug['severity'],
    status: parseStoredBugStatus(row.status),
    statusIsManual: Boolean(row.manualStatus),
    title: row.title,
    suggestedFix: row.suggestedFix,
    aiPrompt: row.aiPrompt,
    affectedLocations: JSON.parse(row.affectedLocationsJson) as string[],
    referenceId: row.referenceId,
    detectedAt: row.detectedAt,
  }
}

export function detectBugRows(
  pullRequestRows: PullRequestRow[],
  existingBugRows: BugRow[],
): BugRow[] {
  const manualStatusByCommentId = new Map<string, string>()
  for (const row of existingBugRows) {
    if (row.manualStatus) {
      manualStatusByCommentId.set(row.commentId, row.status)
    }
  }

  return pullRequestRows.flatMap((row) => {
    const comments = JSON.parse(row.commentsJson) as GithubPullRequestComment[]
    return detectBugsInComments(row.id, comments).map((bug) => {
      const lockedStatus = manualStatusByCommentId.get(bug.commentId)
      return {
        id: bug.commentId,
        prId: bug.prId,
        commentId: bug.commentId,
        severity: bug.severity,
        status: lockedStatus ?? bug.status,
        manualStatus: lockedStatus !== undefined,
        title: bug.title,
        suggestedFix: bug.suggestedFix,
        aiPrompt: bug.aiPrompt,
        affectedLocationsJson: JSON.stringify(bug.affectedLocations),
        referenceId: bug.referenceId,
        detectedAt: bug.detectedAt,
      }
    })
  })
}

export function parseStoredSettings(
  settingsJson: string,
  defaults: GithubSettings,
): GithubSettings {
  try {
    return { ...defaults, ...(JSON.parse(settingsJson) as Partial<GithubSettings>) }
  } catch {
    return defaults
  }
}
