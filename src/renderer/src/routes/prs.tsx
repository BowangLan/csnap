import { createFileRoute } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowUpRight,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquare,
  RefreshCw
} from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequest, GithubPullRequestCiStatus } from '../../../shared/github'

export const Route = createFileRoute('/prs')({
  component: PullRequestsPage
})

function PullRequestsPage() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void window.api.github.refresh()}
          disabled={snapshot.sync.isRefreshing}
        >
          <RefreshCw className={snapshot.sync.isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      <section className="min-w-0 space-y-4">
        {isInitialLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, index) => (
              <PullRequestRowSkeleton key={index} />
            ))}
          </div>
        ) : snapshot.pullRequests.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No open pull requests matched your current GitHub account.
          </div>
        ) : (
          <div className="divide-y">
            {snapshot.pullRequests.map((pullRequest) => (
              <div
                key={pullRequest.id}
                className="group flex min-w-0 flex-col gap-4 rounded-lg py-3 transition-colors hover:bg-muted px-3 trans"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/40',
                      pullRequest.isDraft && 'ring-1 ring-inset ring-border/80'
                    )}
                  >
                    <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 items-start gap-2">
                          <a
                            href={pullRequest.url}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 hover:underline sm:text-[15px]"
                            title={pullRequest.title}
                          >
                            #{pullRequest.number} {pullRequest.title}
                          </a>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="truncate font-medium">
                            {pullRequest.repositoryNameWithOwner}
                          </span>
                          <span>•</span>
                          <span>{pullRequest.authorLogin ?? 'unknown'}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
                        <a
                          href={pullRequest.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open pull request ${pullRequest.number} on GitHub`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {pullRequest.isDraft ? <Badge variant="outline">Draft</Badge> : null}
                      <Badge
                        variant={badgeVariant(pullRequest.reviewDecision)}
                        className={cn(
                          'max-w-full truncate',
                          reviewDecisionTone(pullRequest.reviewDecision)
                        )}
                      >
                        {getReviewLabel(pullRequest.reviewDecision)}
                      </Badge>
                      <HoverCard openDelay={150} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button className="min-w-0 max-w-full text-left outline-none">
                            <Badge
                              variant={ciSummaryVariant(pullRequest)}
                              className={cn(
                                'max-w-full cursor-pointer truncate',
                                ciSummaryTone(pullRequest)
                              )}
                            >
                              {getCiSummaryLabel(pullRequest)}
                            </Badge>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent align="start" className="w-80 space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Check details</p>
                            <p className="text-xs text-muted-foreground">
                              {pullRequest.ciStatuses.length === 0
                                ? 'This pull request has not reported any checks yet.'
                                : 'Current CI runs and status contexts for this pull request.'}
                            </p>
                          </div>
                          {pullRequest.ciStatuses.length === 0 ? null : (
                            <div className="space-y-2">
                              {pullRequest.ciStatuses.map((ciStatus) => (
                                <div
                                  key={ciStatus.id}
                                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <p className="truncate text-sm font-medium">{ciStatus.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {ciStatus.workflowName ?? ciStatus.kind}
                                    </p>
                                  </div>
                                  <StatusPill state={normalizeCiState(ciStatus)}>
                                    {formatCiState(ciStatus)}
                                  </StatusPill>
                                </div>
                              ))}
                            </div>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                      <span
                        className="max-w-full truncate text-xs text-muted-foreground"
                        title={pullRequest.ciStatuses.map(formatCiStatusLabel).join(', ')}
                      >
                        {getCiCaption(pullRequest)}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1.5">
                        <FileCode2 className="h-3.5 w-3.5" />
                        <span>{pullRequest.changedFiles} files</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                        <span>{pullRequest.commitsCount} commits</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{pullRequest.commentsCount} comments</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <span>{formatDelta(pullRequest.additions, pullRequest.deletions)}</span>
                      </div>
                      <span className="truncate">ID {pullRequest.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PullRequestRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton className="mt-0.5 size-8 shrink-0 rounded-md" />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-[min(28rem,100%)]" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-18" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({
  state,
  children
}: {
  state: 'passing' | 'pending' | 'failing'
  children: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        state === 'passing' && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
        state === 'pending' && 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
        state === 'failing' && 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
      )}
    >
      {children}
    </span>
  )
}

function badgeVariant(reviewDecision: string | null): 'default' | 'secondary' | 'outline' {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'default'
    case 'CHANGES_REQUESTED':
      return 'secondary'
    default:
      return 'outline'
  }
}

function ciSummaryVariant(pullRequest: GithubPullRequest): 'default' | 'secondary' | 'outline' {
  const summary = summarizeCiStatuses(pullRequest.ciStatuses)
  if (summary.failing > 0) {
    return 'secondary'
  }

  if (summary.pending > 0) {
    return 'outline'
  }

  return 'default'
}

function reviewDecisionTone(reviewDecision: string | null): string {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
    case 'CHANGES_REQUESTED':
      return 'bg-rose-500/12 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
    default:
      return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
  }
}

function ciSummaryTone(pullRequest: GithubPullRequest): string {
  const summary = summarizeCiStatuses(pullRequest.ciStatuses)
  if (pullRequest.ciStatuses.length === 0) {
    return 'bg-muted text-muted-foreground'
  }

  if (summary.failing > 0) {
    return 'bg-rose-500/12 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
  }

  if (summary.pending > 0) {
    return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
  }

  return 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
}

function getCiSummaryLabel(pullRequest: GithubPullRequest): string {
  const summary = summarizeCiStatuses(pullRequest.ciStatuses)
  if (pullRequest.ciStatuses.length === 0) {
    return 'No checks'
  }

  if (summary.failing > 0) {
    return `${summary.failing} failing`
  }

  if (summary.pending > 0) {
    return `${summary.pending} pending`
  }

  return `${summary.passing} passing`
}

function getCiCaption(pullRequest: GithubPullRequest): string {
  if (pullRequest.ciStatuses.length === 0) {
    return 'No reported checks'
  }

  return pullRequest.ciStatuses.slice(0, 2).map(formatCiStatusLabel).join(' • ')
}

function getReviewLabel(reviewDecision: string | null): string {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'Approved'
    case 'CHANGES_REQUESTED':
      return 'Changes requested'
    default:
      return 'Needs review'
  }
}

function summarizeCiStatuses(ciStatuses: GithubPullRequestCiStatus[]): {
  passing: number
  pending: number
  failing: number
} {
  return ciStatuses.reduce(
    (summary, ciStatus) => {
      const normalized = normalizeCiState(ciStatus)
      if (normalized === 'passing') {
        summary.passing += 1
      } else if (normalized === 'pending') {
        summary.pending += 1
      } else {
        summary.failing += 1
      }

      return summary
    },
    { passing: 0, pending: 0, failing: 0 }
  )
}

function normalizeCiState(ciStatus: GithubPullRequestCiStatus): 'passing' | 'pending' | 'failing' {
  const value = (ciStatus.conclusion ?? ciStatus.status).toUpperCase()
  if (['SUCCESS', 'SUCCESSFUL', 'NEUTRAL', 'SKIPPED'].includes(value)) {
    return 'passing'
  }

  if (['QUEUED', 'IN_PROGRESS', 'PENDING', 'EXPECTED', 'WAITING', 'REQUESTED'].includes(value)) {
    return 'pending'
  }

  return 'failing'
}

function formatCiStatusLabel(ciStatus: GithubPullRequestCiStatus): string {
  const state = ciStatus.conclusion ?? ciStatus.status
  return `${ciStatus.name}: ${state.toLowerCase()}`
}

function formatCiState(ciStatus: GithubPullRequestCiStatus): string {
  const state = ciStatus.conclusion ?? ciStatus.status
  return state.toLowerCase().replaceAll('_', ' ')
}

function formatDelta(additions: number, deletions: number): string {
  return `+${additions} / -${deletions}`
}
