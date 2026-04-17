import { FileDiff } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { useRepoStatuses } from '@renderer/hooks/use-repo-statuses'
import { cn } from '@renderer/lib/utils'
import { localDiffTooltip, RepoDiffLineStats } from './local-repo-diff'

/**
 * Shows local clone diff stats for a repo when `settings.localRepoPaths[nameWithOwner]` is set.
 * Snapshot updates on window focus (main + query invalidation).
 */
export function LocalRepoGitStatusBadge({ nameWithOwner }: { nameWithOwner: string }): JSX.Element | null {
  const snapshot = useGithubSnapshot()
  const repoStatuses = useRepoStatuses()
  const hasLocalPath = Boolean(snapshot.settings.localRepoPaths[nameWithOwner])
  const status = repoStatuses[nameWithOwner]

  if (!hasLocalPath) {
    return null
  }

  if (!status) {
    return (
      <span
        className="inline-flex min-w-0 max-w-[min(100%,12rem)] items-center gap-1 truncate text-xs text-muted-foreground/50 select-none"
        aria-hidden
      >
        <FileDiff className="size-3 shrink-0 opacity-70" />
        <span>…</span>
      </span>
    )
  }

  if (status.error) {
    return (
      <span
        className="inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 truncate text-xs text-destructive/90 select-none"
        title={status.error}
      >
        <FileDiff className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{status.error}</span>
      </span>
    )
  }

  const hasAttention =
    status.linesAdded > 0 ||
    status.linesDeleted > 0 ||
    status.linesModified > 0 ||
    status.untrackedCount > 0 ||
    status.hasConflicts

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-[min(100%,18rem)] items-center gap-1.5 text-xs select-none',
        hasAttention ? 'text-foreground' : 'text-muted-foreground/70',
      )}
      title={localDiffTooltip(status)}
    >
      <FileDiff className="size-3 shrink-0 opacity-80 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        <RepoDiffLineStats status={status} />
      </span>
    </span>
  )
}
