import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  MessageSquare,
  RefreshCw,
  XCircle
} from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequestCiStatus } from '../../../shared/github'

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
          <div className="flex flex-col">
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
                    </div>

                    {pullRequest.ciStatuses.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {pullRequest.ciStatuses.map((ciStatus) => (
                          <CiChip key={ciStatus.id} ciStatus={ciStatus} />
                        ))}
                      </div>
                    ) : null}

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
                      <div className="inline-flex items-center gap-1 font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400">+{pullRequest.additions}</span>
<span className="text-rose-600 dark:text-rose-400">-{pullRequest.deletions}</span>
                      </div>
                      {pullRequest.headRefName ? (
                        <CopyBranchButton branchName={pullRequest.headRefName} />
                      ) : null}
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

function CiChip({ ciStatus }: { ciStatus: GithubPullRequestCiStatus }) {
  const state = normalizeCiState(ciStatus)
  const label = ciStatus.workflowName
    ? `${ciStatus.workflowName} / ${ciStatus.name}`
    : ciStatus.name

  const icon =
    state === 'passing' ? (
      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
    ) : state === 'pending' ? (
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-500" />
    ) : (
      <XCircle className="h-3 w-3 shrink-0 text-rose-500" />
    )

  const chip = (
    <span
      className={cn(
        'inline-flex max-w-[14rem] items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
        state === 'passing' &&
          'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400',
        state === 'pending' &&
          'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400',
        state === 'failing' && 'border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-400'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )

  if (ciStatus.detailsUrl) {
    return (
      <a href={ciStatus.detailsUrl} target="_blank" rel="noreferrer" className="outline-none">
        {chip}
      </a>
    )
  }

  return chip
}

function CopyBranchButton({ branchName }: { branchName: string }) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(branchName).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex max-w-[16rem] items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`Copy branch name: ${branchName}`}
    >
      <GitBranch className="h-3 w-3 shrink-0" />
      <span className="truncate">{branchName}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity hover:opacity-70" />
      )}
    </button>
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

