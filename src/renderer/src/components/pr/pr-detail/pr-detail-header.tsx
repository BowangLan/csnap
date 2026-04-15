import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, ExternalLink, GitBranch, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import { Button } from '@renderer/components/ui/button'
import type { GithubPullRequest } from '../../../../../shared/github'
import { initials } from './pr-detail-utils'
import { Icons } from '@renderer/components/icons'

export function PrDetailHeader({ pr }: { pr: GithubPullRequest }) {
  const repoLabel = pr.repositoryNameWithOwner.split('/')[1] ?? pr.repositoryNameWithOwner

  return (
    <div className="flex flex-col gap-1 py-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">{repoLabel}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="tabular-nums text-muted-foreground">#{pr.number}</span>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="min-w-0 text-balance text-xl md:text-3xl font-medium tracking-tight sm:text-2xl">{pr.title}</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={pr.url} target="_blank" rel="noreferrer">
              Review changes
              <ExternalLink className="ml-1.5 size-3.5 opacity-70" />
            </a>
          </Button>
          {/* External Link Button */}
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={pr.url} target="_blank" rel="noreferrer">
              <Icons.ExternalLink className="size-4" />
            </a>
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {pr.authorLogin ? (
          <span className="inline-flex items-center gap-2">
            <Avatar className="size-5">
              <AvatarFallback className="text-[10px]">{initials(pr.authorLogin)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground/90">{pr.authorLogin}</span>
          </span>
        ) : null}
        <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs">
          <GitBranch className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate text-emerald-600 dark:text-emerald-400">{pr.headRefName}</span>
          <ArrowRight className="size-3.5 shrink-0 opacity-40" />
          <span className="truncate text-muted-foreground">{pr.baseRefName || 'main'}</span>
        </span>
        <span className="tabular-nums">{pr.changedFiles} files</span>
        <span className="tabular-nums inline-flex items-center gap-1">
          <span className="text-emerald-600 dark:text-emerald-400">+{pr.additions}</span>
          <span className="text-rose-600 dark:text-rose-400">-{pr.deletions}</span>
        </span>
        <span className="text-xs">Updated {formatDistanceToNow(pr.updatedAt, { addSuffix: true })}</span>
      </div>
    </div>
  )
}
