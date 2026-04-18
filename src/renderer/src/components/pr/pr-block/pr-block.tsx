import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, GitBranch, Link as LinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cn } from '@renderer/lib/utils'
import { deriveCiStatus } from '@renderer/lib/pr-ci'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'
import { CopyBranchButton } from './copy-branch-button'
import { CopyUrlButton } from './copy-url-button'
import { OpenInBrowserButton } from './open-in-browser-button'
import { CheckoutBranchButton } from './checkout-branch-button'
import { Icons } from '@renderer/components/icons'
import { PillButton } from '@renderer/components/ui/pill-button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { List, ListItem } from '@renderer/components/ui/list'
import { ListSectionExpandToggle } from '@renderer/components/ui/list-section-expand-toggle'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { useRepoStatuses } from '@renderer/hooks/use-repo-statuses'
import { BugRow } from '../../bugs/bug-block/bug-row'
import { SEVERITY_STYLES } from '../../bugs/bug-block/bug-severity-badge'

const SEVERITY_LEVELS: readonly PrBug['severity'][] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
]

function countBugsBySeverity(bugs: PrBug[]): Record<PrBug['severity'], number> {
  const counts: Record<PrBug['severity'], number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  }
  for (const b of bugs) counts[b.severity]++
  return counts
}

function BugSeverityPills({
  severityCounts,
  className,
}: {
  severityCounts: Record<PrBug['severity'], number>
  className?: string
}): JSX.Element | null {
  const hasAny = SEVERITY_LEVELS.some((sev) => severityCounts[sev] > 0)
  if (!hasAny) return null
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1 shrink-0 pointer-events-none', className)}>
      {SEVERITY_LEVELS.map((sev) => {
        const n = severityCounts[sev]
        if (n === 0) return null
        return (
          <PillButton key={sev} variant="outline" className={cn(SEVERITY_STYLES[sev])}>
            <Icons.Bug className="size-3.5" />
            {n}
          </PillButton>
        )
      })}
    </span>
  )
}

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
  const repoStatuses = useRepoStatuses()
  const hasLocalPath = Boolean(snapshot.settings.localRepoPaths[pullRequest.repositoryNameWithOwner])
  const repoStatus = repoStatuses[pullRequest.repositoryNameWithOwner]
  const isActive = Boolean(repoStatus?.branch && repoStatus.branch === pullRequest.headRefName)
  const prBugs = snapshot.bugs.filter((b) => b.prId === pullRequest.id && b.status !== 'resolved')
  const severityCounts = countBugsBySeverity(prBugs)

  return (
    <ListItem
      className={cn(
        'group relative flex-wrap gap-x-1 gap-y-0 px-4 py-2.5',
        'last:border-b-0 cursor-default transition-[opacity,background-color]',
        'hover:bg-muted active:bg-muted/90',
        'has-[a[data-transitioning]]:cursor-wait has-[a[data-transitioning]]:opacity-70',
      )}
    >
      <Link
        to="/prs/$prId"
        params={{ prId: pullRequest.id }}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`View pull request ${pullRequest.number}`}
      />
      <Row
        className={cn(
          'relative z-10 size-4 shrink-0 justify-center rounded-md mr-2',
          isActive ? 'bg-emerald-500/10' : 'bg-muted/40',
          pullRequest.isDraft && 'ring-1 ring-inset ring-border/80'
        )}
      >
        <Icons.PullRequest
          className={cn(
            'size-4 pointer-events-none',
            isActive ? 'text-emerald-500' : 'text-muted-foreground',
          )}
        />
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

      <CheckoutBranchButton
        nameWithOwner={pullRequest.repositoryNameWithOwner}
        branch={pullRequest.headRefName}
        hasLocalPath={hasLocalPath}
        isActive={isActive}
      />
      <CopyUrlButton url={pullRequest.url} />
      <OpenInBrowserButton url={pullRequest.url} />

      <BugSeverityPills severityCounts={severityCounts} className="relative z-10 tabular-nums" />

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
    </ListItem>
  )
}

export function PullRequestBlockRow({ pullRequest }: { pullRequest: GithubPullRequest }) {
  const meta = `${pullRequest.repositoryNameWithOwner} · ${pullRequest.authorLogin ?? 'unknown'} · ${formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}`
  const ciStatus = deriveCiStatus(pullRequest.ciStatuses)
  const snapshot = useGithubSnapshot()
  const repoStatuses = useRepoStatuses()
  const hasLocalPath = Boolean(snapshot.settings.localRepoPaths[pullRequest.repositoryNameWithOwner])
  const repoStatus = repoStatuses[pullRequest.repositoryNameWithOwner]
  const isActive = Boolean(repoStatus?.branch && repoStatus.branch === pullRequest.headRefName)
  const prBugsRow = snapshot.bugs.filter((b) => b.prId === pullRequest.id && b.status !== 'resolved')
  const severityCountsRow = countBugsBySeverity(prBugsRow)
  const hasBugs = prBugsRow.length > 0
  const [bugsExpanded, setBugsExpanded] = useState(true)
  const bugsListId = useId()
  const branch = pullRequest.headRefName
  const canCheckout = Boolean(hasLocalPath && branch)

  async function handleContextCheckout() {
    if (!branch) return
    try {
      await window.api.github.checkoutBranch(pullRequest.repositoryNameWithOwner, branch)
      toast.success(`Checked out ${branch}`)
      void window.api.repoStatuses.syncAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  function handleContextCopyUrl() {
    void navigator.clipboard.writeText(pullRequest.url).then(() => {
      toast.success('PR URL copied')
    })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <ListItem
            className={cn(
              'group relative h-10 py-0 bg-muted/40',
              'has-[a[data-transitioning]]:cursor-wait has-[a[data-transitioning]]:opacity-70',
            )}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setBugsExpanded((v) => !v)
              return false
            }}
          >
            {/* Col: expand toggle (fixed) */}
            <ListSectionExpandToggle
              expanded={bugsExpanded}
              controlsId={bugsListId}
              title={
                bugsExpanded
                  ? 'Hide bugs for this pull request'
                  : 'Show bugs for this pull request'
              }
              srOnlyLabel={`${bugsExpanded ? 'Collapse' : 'Expand'} bugs for pull request ${pullRequest.title}`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setBugsExpanded((v) => !v)
                return false
              }}
            />

            {/* Col: PR icon + CI dot (fixed) — emerald when local checkout matches PR head */}
            <div
              className={cn(
                'flex-none relative rounded-[3px]',
                isActive && 'ring-1 ring-emerald-500/45',
              )}
              title={isActive ? `On branch ${pullRequest.headRefName ?? ''}` : undefined}
            >
              <Icons.PullRequest
                className={cn(
                  'size-4 pointer-events-none flex-none',
                  isActive ? 'text-emerald-500' : 'text-muted-foreground',
                )}
              />
              {ciStatus ? (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-background',
                    CI_DOT_CLASS[ciStatus],
                  )}
                />
              ) : null}
            </div>

            {/* Col: #Number (fixed) */}
            <div className="font-normal select-none text-foreground/70 text-sm font-mono flex-none w-12 tabular-nums">
              #{pullRequest.number}
            </div>

            {/* Col: Title (flexible — fills middle so other columns align) */}
            <Link
              to="/prs/$prId"
              params={{ prId: pullRequest.id }}
              className="flex-1 -ml-3 select-none min-w-0 truncate text-sm font-medium hover:underline"
              title={`${pullRequest.title} — ${meta}`}
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              {pullRequest.title}
            </Link>

            {/* Col: Branch (fixed) */}
            <div className="relative z-10 flex flex-none w-56 min-w-0 overflow-hidden items-center">
              {pullRequest.headRefName ? (
                <CopyBranchButton branchName={pullRequest.headRefName} />
              ) : null}
            </div>

            {/* Col: Updated time (fixed, right-aligned) */}
            <p className="relative z-10 hidden flex-none w-28 truncate text-right text-xs text-muted-foreground md:block pointer-events-none">
              {formatDistanceToNow(pullRequest.updatedAt, { addSuffix: true })}
            </p>

            {/* Col: Bug severity pills (fixed, right-aligned) */}
            <div className="relative z-10 flex flex-none w-36 justify-end tabular-nums">
              <BugSeverityPills severityCounts={severityCountsRow} />
            </div>
          </ListItem>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <ContextMenuItem
            disabled={!canCheckout}
            title={
              isActive
                ? `On this branch: ${branch ?? ''}`
                : hasLocalPath
                  ? branch
                    ? `Checkout branch: ${branch}`
                    : 'No branch'
                  : `No local path configured for ${pullRequest.repositoryNameWithOwner} — set one in Settings`
            }
            onSelect={() => {
              void handleContextCheckout()
            }}
          >
            <GitBranch />
            {isActive ? 'On this branch' : 'Checkout branch'}
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleContextCopyUrl}>
            <LinkIcon />
            Copy PR URL
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              window.open(pullRequest.url, '_blank', 'noopener,noreferrer')
            }}
          >
            <ExternalLink />
            Open in browser
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {hasBugs ? (
        <div id={bugsListId} hidden={!bugsExpanded} className="pl-row-indent">
          <List>
            {prBugsRow.map((bug) => (
              <BugRow key={bug.id} bug={bug} pr={pullRequest} showPr={false} />
            ))}
          </List>
        </div>
      ) : null}
    </>
  )
}
