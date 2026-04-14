import * as React from 'react'
import { Bot, Check, ChevronRight, Clock, Loader2, MinusCircle, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Badge } from '@renderer/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import { normalizeCiState } from '@renderer/lib/pr-ci'
import { reviewerStatusLabel } from '@renderer/lib/pr-reviewers'
import type { GithubPullRequest } from '../../../../../shared/github'
import { initials } from './pr-detail-utils'

function ciRollupSummary(pr: GithubPullRequest): {
  pending: number
  failing: number
  passing: number
  total: number
} {
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

export function PrDetailSidebar({ pr }: { pr: GithubPullRequest }) {
  const [checksOpen, setChecksOpen] = React.useState(true)
  const [reviewersOpen, setReviewersOpen] = React.useState(true)

  const rollup = ciRollupSummary(pr)
  const waitingOnCi = rollup.pending > 0

  return (
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
          <div className="px-2">
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
                  <li key={r.login} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/40">
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
  )
}
