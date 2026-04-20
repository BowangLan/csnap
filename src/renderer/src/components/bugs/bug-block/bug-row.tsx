import { formatDistanceToNow } from 'date-fns'
import { Copy, FileCode2, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { OpenInBrowserButton } from '@renderer/components/pr/pr-block/open-in-browser-button'
import { Icons } from '@renderer/components/icons'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { ListItem } from '@renderer/components/ui/list'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'
import { BUG_SEVERITY_BG_DOT, BUG_SEVERITY_FG_DOT } from './bug-severity-badge'
import { BugStatusSelect } from './bug-status-select'

export function BugRow({
  bug,
  pr,
  showPr = true,
  className,
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
  /** When false, hide PR number (and repo in tooltip) — use under a PR sub-group. Default true. */
  showPr?: boolean
  className?: string
}): JSX.Element {
  const meta =
    showPr && pr
      ? `${pr.repositoryNameWithOwner} · ${formatDistanceToNow(bug.detectedAt, { addSuffix: true })}`
      : formatDistanceToNow(bug.detectedAt, { addSuffix: true })
  const resolved = bug.status === 'resolved'
  return (
    <ListItem
      className={cn(
        'group relative py-0.5 h-10',
        'has-[a[data-transitioning]]:cursor-wait has-[a[data-transitioning]]:opacity-70',
        className,
      )}
    >
      <Link
        to="/bugs/$bugId"
        params={{ bugId: bug.id }}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`View bug: ${bug.title}`}
      />

      <div className="relative flex-none">
        {/* <div
          className={cn(
            "size-5.5 rounded-full flex items-center justify-center border",
            BUG_SEVERITY_BG_2_DOT[bug.severity],
            BUG_SEVERITY_BORDER[bug.severity],
          )}
        >

          <Icons.Bug className={cn(
            "size-3 text-foreground pointer-events-none",
            BUG_SEVERITY_FG_DOT[bug.severity],
            bug.status === 'resolved' ? 'text-muted-foreground' : '',
          )} />
        </div> */}
        <Icons.Bug
          className={cn(
            "size-4 text-foreground pointer-events-none",
            BUG_SEVERITY_FG_DOT[bug.severity],
            bug.status === 'resolved' ? 'text-muted-foreground' : '',
          )}
        />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-background',
            'hidden',
            BUG_SEVERITY_BG_DOT[bug.severity]
          )}
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1 pointer-events-none">
        {showPr && pr ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {/* <BugSeverityBadge severity={bug.severity} /> */}
              <span className="font-mono text-xs text-muted-foreground">#{pr.number}</span>
            </div>
          </>
        ) : null}
        <p
          className={cn(
            'line-clamp-2 text-sm font-medium leading-snug sm:line-clamp-1 select-none',
            resolved && 'text-muted-foreground line-through decoration-muted-foreground/50'
          )}
          title={`${bug.title} — ${meta}`}
        >
          {bug.title}
        </p>
        {bug.diffPath ? (
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <FileCode2 className="size-3 shrink-0 opacity-60" aria-hidden />
            <code className="truncate font-mono text-[10px]" title={bug.diffPath}>
              {bug.diffPath}
            </code>
          </p>
        ) : null}
      </div>

      <p className="relative z-10 hidden min-w-0 max-w-[min(100%,20rem)] truncate text-xs text-muted-foreground md:block select-none pointer-events-none">
        {formatDistanceToNow(bug.detectedAt, { addSuffix: true })}
      </p>

      <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2">
        <BugStatusSelect bug={bug} pr={pr} />
        {pr ? <OpenInBrowserButton url={pr.url} /> : null}
        {bug.aiPrompt ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-events-auto size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="More actions"
              >
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
        ) : null}
      </div>
    </ListItem>
  )
}
