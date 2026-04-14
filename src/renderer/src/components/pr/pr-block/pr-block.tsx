import { formatDistanceToNow } from 'date-fns'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, GitPullRequest } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { badgeVariant, getReviewLabel, reviewDecisionTone } from '@renderer/lib/pr-review'
import type { GithubPullRequest } from '../../../../../shared/github'
import { CiStatusSummary } from './ci-status-summary'
import { CopyBranchButton } from './copy-branch-button'
import { CheckoutBranchButton } from './checkout-branch-button'
import { LinearIssueBadge } from './linear-issue-badge'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'

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
  const snapshot = useGithubSnapshot()
  const hasLocalPath = Boolean(snapshot.settings.localRepoPaths[pullRequest.repositoryNameWithOwner])

  return (
    <Row className="group relative flex-wrap gap-x-2 gap-y-0 rounded-lg px-2 py-2.5 transition-[opacity,background-color] last:border-b-0 hover:bg-muted cursor-pointer has-[a[data-transitioning]]:cursor-wait has-[a[data-transitioning]]:opacity-70">
      <Link
        to="/prs/$prId"
        params={{ prId: pullRequest.id }}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`View pull request ${pullRequest.number}`}
      />
      <Row
        className={cn(
          'relative z-10 size-8 shrink-0 justify-center rounded-md bg-muted/40 pointer-events-none',
          pullRequest.isDraft && 'ring-1 ring-inset ring-border/80'
        )}
      >
        <GitPullRequest className="size-3.5 text-muted-foreground" />
      </Row>

      <Col className="relative z-10 min-w-0 flex-1 basis-[min(100%,12rem)] pointer-events-none">
        <span
          className="line-clamp-2 text-sm font-medium leading-snug sm:line-clamp-1"
          title={`${pullRequest.title} — ${meta}`}
        >
          <span className="font-medium text-muted-foreground">#{pullRequest.number}</span> {pullRequest.title}
        </span>
        <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">{meta}</p>
      </Col>

      <p className="relative z-10 hidden min-w-0 max-w-[min(100%,20rem)] truncate text-xs text-muted-foreground md:block pointer-events-none">
        {meta}
      </p>

      <Row className="relative z-10 ml-auto min-w-0 flex-wrap justify-end gap-1.5 pointer-events-none">
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

      <Row className="relative z-10 ml-auto justify-end gap-2 pointer-events-auto">
        <LinearIssueBadge pr={pullRequest} />
        {pullRequest.headRefName ? (
          <Col className="min-w-0 max-w-36 items-start sm:max-w-fit">
            <CopyBranchButton branchName={pullRequest.headRefName} />
          </Col>
        ) : null}
        {pullRequest.headRefName ? (
          <CheckoutBranchButton
            nameWithOwner={pullRequest.repositoryNameWithOwner}
            branch={pullRequest.headRefName}
            hasLocalPath={hasLocalPath}
          />
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
