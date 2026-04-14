import { formatDistanceToNow } from 'date-fns'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@renderer/lib/utils'
import { deriveCiStatus } from '@renderer/lib/pr-ci'
import type { GithubPullRequest } from '../../../../../shared/github'
import { CopyBranchButton } from './copy-branch-button'
import { CopyUrlButton } from './copy-url-button'
import { OpenInBrowserButton } from './open-in-browser-button'
import { CheckoutBranchButton } from './checkout-branch-button'
import { Icons } from '@renderer/components/icons'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'

const Row = ({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) => <div className={cn('flex w-full min-w-0 items-center', className)}>{children}</div>

const Col = ({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) => <div className={cn('flex min-h-0 flex-col items-stretch', className)}>{children}</div>

const CI_DOT_CLASS = {
  pending: 'bg-amber-400',
  failing: 'bg-rose-500',
  passing: 'bg-emerald-500',
} as const

export function PullRequestBlock({ pullRequest }: { pullRequest: GithubPullRequest }) {
  const meta = `${pullRequest.repositoryNameWithOwner} · ${pullRequest.authorLogin ?? 'unknown'} · ${formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}`
  const ciStatus = deriveCiStatus(pullRequest.ciStatuses)
  const snapshot = useGithubSnapshot()
  const hasLocalPath = Boolean(snapshot.settings.localRepoPaths[pullRequest.repositoryNameWithOwner])

  return (
    <Row className="group relative flex-wrap gap-x-1 gap-y-0 rounded-lg px-4 py-2.5 transition-[opacity,background-color] last:border-b-0 hover:bg-muted cursor-pointer has-[a[data-transitioning]]:cursor-wait has-[a[data-transitioning]]:opacity-70">
      <Link
        to="/prs/$prId"
        params={{ prId: pullRequest.id }}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`View pull request ${pullRequest.number}`}
      />
      <Row
        className={cn(
          'relative z-10 size-4 shrink-0 justify-center rounded-md bg-muted/40 mr-2',
          pullRequest.isDraft && 'ring-1 ring-inset ring-border/80'
        )}
      >
        <Icons.PullRequest className="size-4 text-muted-foreground pointer-events-none" />
        {ciStatus ? (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-background',
              CI_DOT_CLASS[ciStatus]
            )}
          />
        ) : null}
      </Row>

      <Col className="relative z-10 min-w-0 flex-1 basis-[min(100%,12rem)] pointer-events-none">
        <span
          className="line-clamp-2 text-sm font-medium leading-snug sm:line-clamp-1 flex"
          title={`${pullRequest.title} — ${meta}`}
        >
          <span className="font-medium text-muted-foreground font-mono">#{pullRequest.number}</span> {pullRequest.title}
        </span>
        <Row className="gap-2">
          {/* Repo Button */}
          <a
            href={pullRequest.url.replace(/\/pull\/\d+$/, '')}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 pointer-events-auto inline-flex max-w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={pullRequest.repositoryNameWithOwner}
          >
            <Icons.Repo className="h-3 w-3 shrink-0" />
            <span>{pullRequest.repositoryNameWithOwner.split('/')[1]}</span>
          </a>

          {/* Branch Button */}
          {pullRequest.headRefName ? (
            <CopyBranchButton branchName={pullRequest.headRefName} />
          ) : null}
        </Row>
      </Col>

      <p className="relative z-10 hidden min-w-0 max-w-[min(100%,20rem)] truncate text-xs text-muted-foreground md:block pointer-events-none">
        {formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}
      </p>

      {/* <Row className="relative z-10 ml-auto min-w-0 flex-wrap justify-end gap-1.5 pointer-events-none">
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
      </Row> */}

      <CopyUrlButton url={pullRequest.url} />
      {hasLocalPath && pullRequest.headRefName ? (
        <CheckoutBranchButton
          nameWithOwner={pullRequest.repositoryNameWithOwner}
          branchName={pullRequest.headRefName}
        />
      ) : null}
      <OpenInBrowserButton url={pullRequest.url} />

      {/* <Row className="relative z-10 ml-auto justify-end gap-2 pointer-events-auto">
        <LinearIssueBadge pr={pullRequest} />
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
      </Row> */}
    </Row>
  )
}
