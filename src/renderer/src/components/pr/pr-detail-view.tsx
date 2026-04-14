import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitMerge,
  MessageSquare,
  Loader2,
  MoreHorizontal,
  PenLine,
  Wand2,
  X,
  MinusCircle,
} from 'lucide-react'
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import { normalizeCiState } from '@renderer/lib/pr-ci'
import { reviewerStatusLabel } from '@renderer/lib/pr-reviewers'
import type { GithubPullRequest } from '../../../../shared/github'

function initials(login: string): string {
  return login.slice(0, 2).toUpperCase()
}

type MergeConfirmState = 'idle' | 'confirm' | 'merging'

function SquashMergeButton({ pr }: { pr: GithubPullRequest }) {
  const navigate = useNavigate()
  const [state, setState] = React.useState<MergeConfirmState>('idle')
  const confirmTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearConfirmTimeout = () => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current)
      confirmTimeoutRef.current = null
    }
  }

  React.useEffect(() => {
    return () => clearConfirmTimeout()
  }, [])

  const handleFirstClick = () => {
    setState('confirm')
    // Auto-reset after 4 s if user does nothing
    clearConfirmTimeout()
    confirmTimeoutRef.current = setTimeout(() => {
      setState('idle')
    }, 4000)
  }

  const handleConfirm = async () => {
    clearConfirmTimeout()
    setState('merging')
    try {
      await window.api.github.squashAndMerge(pr.url)
      toast.success('PR merged', {
        description: `#${pr.number} squash-merged successfully.`,
      })
      // Navigate back to the PR list; the refresh triggered by squashAndMerge
      // will remove this PR from the snapshot automatically.
      void navigate({ to: '/prs' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Merge failed', { description: message })
      setState('idle')
    }
  }

  const handleCancel = () => {
    clearConfirmTimeout()
    setState('idle')
  }

  if (state === 'merging') {
    return (
      <Button variant="default" size="sm" disabled className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        Merging…
      </Button>
    )
  }

  if (state === 'confirm') {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void handleConfirm()}
          className="gap-1.5"
          autoFocus
        >
          <GitMerge className="size-3.5" />
          Confirm merge
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button variant="default" size="sm" onClick={handleFirstClick} className="gap-1.5">
      <GitMerge className="size-3.5" />
      Squash &amp; Merge
    </Button>
  )
}

function ciRollupSummary(pr: GithubPullRequest): { pending: number; failing: number; passing: number; total: number } {
  let pending = 0
  let failing = 0
  let passing = 0
  for (const ci of pr.ciStatuses) {
    const s = normalizeCiState(ci)
    if (s === 'pending') pending += 1
    else if (s === 'failing') failing += 1
    else passing += 1
  }
  const total = pr.ciStatuses.length
  return { pending, failing, passing, total }
}

export function PullRequestDetailView({ pullRequest: pr }: { pullRequest: GithubPullRequest }) {
  const [checksOpen, setChecksOpen] = React.useState(true)
  const [reviewersOpen, setReviewersOpen] = React.useState(true)
  const [reviewBannerVisible, setReviewBannerVisible] = React.useState(true)

  const rollup = ciRollupSummary(pr)
  const waitingOnCi = rollup.pending > 0

  const repoLabel = pr.repositoryNameWithOwner.split('/')[1] ?? pr.repositoryNameWithOwner

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-8 px-3 flex-1 min-h-0">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">{repoLabel}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="tabular-nums text-muted-foreground">#{pr.number}</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="min-w-0 text-balance text-xl md:text-3xl font-medium tracking-tight sm:text-2xl">{pr.title}</h1>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SquashMergeButton pr={pr} />
            <Button variant="outline" size="sm" asChild>
              <a href={pr.url} target="_blank" rel="noreferrer">
                Review changes
                <ExternalLink className="ml-1.5 size-3.5 opacity-70" />
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

      {reviewBannerVisible && pr.reviewDecision == null ? (
        <div className="flex flex-col gap-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground/90">
            This PR is waiting for review. Open it on GitHub to leave a full review with comments.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={pr.url} target="_blank" rel="noreferrer">
                Open on GitHub
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReviewBannerVisible(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Collapsible defaultOpen className="group/commits rounded-xl border border-border/80 bg-card/40">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span className="flex items-center gap-2">
                <GitCommit className="size-4 text-muted-foreground" />
                Commits
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                  {pr.commitsCount}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/commits:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-2 py-2">
                {pr.commits.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    {pr.commitsCount === 0 ? 'No commits on this branch yet.' : 'No commit details loaded.'}
                  </p>
                ) : (
                  <div className="relative">
                    {pr.commits.map((item) => {
                      const shortOid = item.oid.slice(0, 7)
                      const time = item.authoredAt ? formatDistanceToNow(item.authoredAt, { addSuffix: true }) : 'Unknown'
                      return (
                        <div key={item.oid} className="relative flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors rounded-lg text-foreground/70 hover:text-foreground">
                          <div className='flex-none'>
                            <GitCommit className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="group/commit flex flex-col gap-1 rounded-md sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 select-none">
                              <span className="min-w-0 text-sm font-medium">
                                <span className="line-clamp-2">{item.messageHeadline || '(No message)'}</span>
                              </span>
                              <span className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span className="tabular-nums text-xs text-muted-foreground">{time}</span>
                                <code className="rounded bg-muted/80 px-1 py-px font-mono tabular-nums">{shortOid}</code>
                                <ExternalLink className="size-3 opacity-60" />
                              </span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {pr.commitsCount > pr.commits.length ? (
                  <p className="px-2 pb-2 pt-1 text-[11px] text-muted-foreground">
                    Showing the {pr.commits.length} most recent commits. Open on GitHub for full history.
                  </p>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="group/comments rounded-xl border border-border/80 bg-card/40">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                Comments
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                  {pr.commentsCount}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/comments:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-2 py-2">
                {pr.comments.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">No comments on this pull request yet.</p>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border" aria-hidden />
                    {pr.comments.map((item) => (
                      <div key={item.id} className="relative flex gap-3 pb-4 last:pb-2">
                        <div className="size-4 shrink-0">
                          <MessageSquare className="size-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-medium leading-snug hover:underline"
                          >
                            <span className="text-foreground">{item.authorLogin ?? 'Unknown'}</span>
                            <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                              {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                            </span>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-60" />
                          </a>
                          {item.body.trim() ? (
                            <pre className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap wrap-break-word font-sans text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </pre>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="group/desc rounded-xl border border-border/80 bg-card/40">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span>Description</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/desc:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled>
                    <Wand2 className="size-3.5 opacity-60" />
                    Generate
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Edit description" disabled>
                    <PenLine className="size-4 opacity-50" />
                  </Button>
                </div>
                {pr.body?.trim() ? (
                  <div className="prose prose-sm dark:prose-invert mt-4 max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                      {pr.body}
                    </pre>
                  </div>
                ) : (
                  <p className="mt-4 text-sm italic text-muted-foreground">No description provided.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                {pr.state === 'OPEN' ? 'Open' : pr.state}
              </Badge>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex gap-3 rounded-lg bg-muted/40 p-3">
                {waitingOnCi ? (
                  <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                ) : rollup.failing > 0 ? (
                  <X className="mt-0.5 size-4 shrink-0 text-rose-500" />
                ) : (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {waitingOnCi ? 'Waiting on CI' : rollup.failing > 0 ? 'Checks failed' : 'Checks passing'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {waitingOnCi
                      ? 'Required checks are running or queued.'
                      : rollup.failing > 0
                        ? 'One or more required checks did not succeed.'
                        : rollup.total === 0
                          ? 'No status checks reported for the latest commit.'
                          : 'All reported checks finished successfully.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <Bot className="size-3.5 shrink-0" />
                <span>Automation and bots only appear on GitHub for this repository.</span>
              </div>
            </div>
          </div>

          <Collapsible open={checksOpen} onOpenChange={setChecksOpen} className="rounded-xl border border-border/80 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
              <span className="flex items-center gap-2">
                Checks
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                  {rollup.total}
                </span>
              </span>
              <ChevronRight
                className={cn('size-4 text-muted-foreground transition-transform', checksOpen && 'rotate-90')}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className='px-2'>
                {rollup.total > 0 ? (
                  <>
                    <ul>
                      {pr.ciStatuses.map((ci) => {
                        const state = normalizeCiState(ci)
                        return (
                          <li key={ci.id}>
                            <a
                              href={ci.detailsUrl ?? pr.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {state === 'pending' ? (
                                  <Loader2 className="size-4 shrink-0 animate-spin text-amber-500" />
                                ) : state === 'passing' ? (
                                  <Check className="size-4 shrink-0 text-emerald-500" />
                                ) : state === 'skipped' ? (
                                  <MinusCircle className="size-4 shrink-0 text-slate-400" />
                                ) : (
                                  <X className="size-4 shrink-0 text-rose-500" />
                                )}
                                <span className="truncate text-sm">{ci.name}</span>
                              </span>
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="py-2 text-xs text-muted-foreground">No checks to show.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={reviewersOpen} onOpenChange={setReviewersOpen} className="rounded-xl border border-border/80 bg-card/50">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
              <span>Reviewers</span>
              <ChevronRight
                className={cn('size-4 text-muted-foreground transition-transform', reviewersOpen && 'rotate-90')}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-2 pb-3 pt-1">
                {(pr.reviewers ?? []).length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No reviewers listed.</p>
                ) : (
                  <ul className="space-y-1">
                    {(pr.reviewers ?? []).map((r) => (
                      <li
                        key={r.login}
                        className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/40"
                      >
                        <Avatar className="size-8">
                          {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs">{initials(r.login)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-none">{r.login}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{reviewerStatusLabel(r.state)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </aside>
      </div>
    </div>
  )
}
