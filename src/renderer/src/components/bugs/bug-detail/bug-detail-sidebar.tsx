import { formatDistanceToNow } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  ExternalLink,
  GitPullRequest,
  Clock,
  CheckCircle2,
  XCircle,
  CircleDashed,
  ShieldAlert,
} from 'lucide-react'
import { Icons } from '@renderer/components/icons'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { BugSeverityBadge, BUG_SEVERITY_BG_DOT } from '../bug-block/bug-severity-badge'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'

const STATUS_CONFIG: Record<
  PrBug['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  todo: {
    label: 'To Do',
    icon: CircleDashed,
    className: 'text-amber-600 dark:text-amber-400',
  },
  'in-progress': {
    label: 'In Progress',
    icon: Clock,
    className: 'text-blue-600 dark:text-blue-400',
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  ignored: {
    label: 'Ignored',
    icon: XCircle,
    className: 'text-muted-foreground',
  },
}

export function BugDetailSidebar({
  bug,
  pr,
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
}) {
  const statusCfg = STATUS_CONFIG[bug.status]
  const StatusIcon = statusCfg.icon

  return (
    <aside className="flex min-w-0 flex-col gap-4">
      {/* Status card */}
      <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </h3>
        <div className="flex items-center gap-2">
          <StatusIcon className={`size-5 ${statusCfg.className}`} />
          <span className={`text-sm font-medium ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          {bug.statusIsManual && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              pinned
            </Badge>
          )}
        </div>

        <Separator className="my-4" />

        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Severity
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full ${BUG_SEVERITY_BG_DOT[bug.severity]}`}
            aria-hidden
          />
          <BugSeverityBadge severity={bug.severity} />
        </div>

        <Separator className="my-4" />

        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Details
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Detected</dt>
            <dd className="tabular-nums text-foreground/90">
              {formatDistanceToNow(bug.detectedAt, { addSuffix: true })}
            </dd>
          </div>
          {bug.referenceId && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="font-mono text-xs text-foreground/90">{bug.referenceId}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Locations</dt>
            <dd className="tabular-nums text-foreground/90">{bug.affectedLocations.length}</dd>
          </div>
        </dl>
      </div>

      {/* Parent PR card */}
      {pr && (
        <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pull Request
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <GitPullRequest className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link
                  to="/prs/$prId"
                  params={{ prId: pr.id }}
                  className="text-sm font-medium text-foreground/90 transition-colors hover:text-foreground"
                >
                  #{pr.number} {pr.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {pr.repositoryNameWithOwner}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  pr.state === 'OPEN'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : pr.state === 'MERGED'
                      ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                      : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                }
              >
                {pr.state === 'OPEN' ? 'Open' : pr.state === 'MERGED' ? 'Merged' : 'Closed'}
              </Badge>
              {pr.authorLogin && (
                <span className="text-xs text-muted-foreground">by {pr.authorLogin}</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/prs/$prId" params={{ prId: pr.id }}>
                  <Icons.PullRequest className="size-3.5" />
                  View PR
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={pr.url} target="_blank" rel="noreferrer" aria-label="Open PR on GitHub">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bug icon footer */}
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0" />
        <span>Bug detected from automated PR analysis comments.</span>
      </div>
    </aside>
  )
}
