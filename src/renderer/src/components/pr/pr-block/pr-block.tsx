import { formatDistanceToNow } from 'date-fns'
import type { ReactNode } from 'react'
import { ArrowUpRight, GitPullRequest } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { badgeVariant, getReviewLabel, reviewDecisionTone } from '@renderer/lib/pr-review'
import type { GithubPullRequest } from '../../../../../shared/github'
import { CiStatusSummary } from './ci-status-summary'
import { CopyBranchButton } from './copy-branch-button'
import { LinearIssueBadge } from './linear-issue-badge'

const Row = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <div className={cn('flex w-full min-w-0 items-center', className)}>{children}</div>

const Col = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <div className={cn('flex min-h-0 flex-col items-stretch', className)}>{children}</div>

export function PullRequestBlock({ pullRequest }: { pullRequest: GithubPullRequest }) {
  const meta = `${pullRequest.repositoryNameWithOwner} · ${pullRequest.authorLogin ?? 'unknown'} · ${formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}`

  return (
    <Row className="group flex-wrap gap-x-2 gap-y-0 rounded-lg px-2 py-2.5 transition-colors last:border-b-0 hover:bg-muted">
      <Row
        className={cn(
          'size-8 shrink-0 justify-center rounded-md bg-muted/40',
          pullRequest.isDraft && 'ring-1 ring-inset ring-border/80'
        )}
      >
        <GitPullRequest className="size-3.5 text-muted-foreground" />
      </Row>

      <Col className="min-w-0 flex-1 basis-[min(100%,12rem)]">
        <a
          href={pullRequest.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm font-medium leading-snug hover:underline sm:line-clamp-1"
          title={`${pullRequest.title} — ${meta}`}
        >
          <span className="font-medium text-muted-foreground">#{pullRequest.number}</span> {pullRequest.title}
        </a>
        <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">{meta}</p>
      </Col>

      <p className="hidden min-w-0 max-w-[min(100%,20rem)] truncate text-xs text-muted-foreground md:block">
        {meta}
      </p>

      <Row className="ml-auto min-w-0 flex-wrap justify-end gap-1.5">
        {pullRequest.isDraft ? <Badge variant="outline">Draft</Badge> : null}
        <Badge
          variant={badgeVariant(pullRequest.reviewDecision)}
          className={cn('max-w-40 truncate sm:max-w-56', reviewDecisionTone(pullRequest.reviewDecision))}
        >
          {getReviewLabel(pullRequest.reviewDecision)}
        </Badge>
        {pullRequest.ciStatuses.length > 0 ? <CiStatusSummary ciStatuses={pullRequest.ciStatuses} /> : null}
        <span className="inline-flex gap-1 text-xs font-medium tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">+{pullRequest.additions}</span>
          <span className="text-rose-600 dark:text-rose-400">-{pullRequest.deletions}</span>
        </span>
      </Row>

      <Row className='ml-auto justify-end gap-2'>
        <LinearIssueBadge pr={pullRequest} />
        {pullRequest.headRefName ? (
          <Col className="min-w-0 max-w-36 items-start sm:max-w-fit">
            <CopyBranchButton branchName={pullRequest.headRefName} />
          </Col>
        ) : null}
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
      </Row>
    </Row>
  )
}
