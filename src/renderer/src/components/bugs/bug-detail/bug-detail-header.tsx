import { formatDistanceToNow } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { ExternalLink, GitPullRequest, MoreHorizontal, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Icons } from '@renderer/components/icons'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { BugSeverityBadge } from '../bug-block/bug-severity-badge'
import { BugStatusSelect } from '../bug-block/bug-status-select'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'

export function BugDetailHeader({
  bug,
  pr,
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
}) {
  const resolved = bug.status === 'resolved'
  const repoLabel = pr
    ? pr.repositoryNameWithOwner.split('/')[1] ?? pr.repositoryNameWithOwner
    : null

  return (
    <div className="flex flex-col gap-1 py-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {repoLabel && (
          <>
            <span className="font-medium text-foreground/90">{repoLabel}</span>
            <span className="text-muted-foreground/60">·</span>
          </>
        )}
        {pr && (
          <>
            <Link
              to="/prs/$prId"
              params={{ prId: pr.id }}
              className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              <GitPullRequest className="size-3" />
              #{pr.number}
            </Link>
            <span className="text-muted-foreground/60">·</span>
          </>
        )}
        <BugSeverityBadge severity={bug.severity} />
        {bug.referenceId && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono text-[10px] opacity-60">ref {bug.referenceId}</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h1
          className={`min-w-0 text-balance text-xl font-medium tracking-tight sm:text-2xl md:text-3xl ${
            resolved ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''
          }`}
        >
          {bug.title}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {pr && (
            <Button variant="outline" size="sm" asChild>
              <a href={pr.url} target="_blank" rel="noreferrer">
                View PR on GitHub
                <ExternalLink className="ml-1.5 size-3.5 opacity-70" />
              </a>
            </Button>
          )}
          {bug.aiPrompt && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard.writeText(bug.aiPrompt!)
                    toast.success('AI prompt copied to clipboard')
                  }}
                >
                  <Copy className="size-4" />
                  Copy AI prompt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icons.Bug className="size-4 opacity-70" />
          <span className="text-xs">
            Detected {formatDistanceToNow(bug.detectedAt, { addSuffix: true })}
          </span>
        </span>
        <BugStatusSelect bug={bug} pr={pr} />
      </div>
    </div>
  )
}
