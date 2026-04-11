import { Check, Loader2, MinusCircle, X } from 'lucide-react'
import type { GithubPullRequestCiStatus } from '../../../../../shared/github'
import { ciStatusPriority, normalizeCiState, type NormalizedCiState } from '@renderer/lib/pr-ci'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'

function CiStateIcon({ state }: { state: NormalizedCiState }) {
  if (state === 'passing') return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
  if (state === 'pending')
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
  if (state === 'skipped') return <MinusCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
  return <X className="h-3.5 w-3.5 shrink-0 text-rose-500" />
}

export function CiStatusSummary({ ciStatuses }: { ciStatuses: GithubPullRequestCiStatus[] }) {
  const sorted = ciStatuses
    .slice()
    .sort((a, b) => ciStatusPriority(normalizeCiState(a)) - ciStatusPriority(normalizeCiState(b)))

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-0.5 cursor-default">
          {sorted.map((ci) => (
            <CiStateIcon key={ci.id} state={normalizeCiState(ci)} />
          ))}
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={6} className="w-72 p-0 overflow-hidden">
        <div className="max-h-56 overflow-y-auto">
          {sorted.map((ci) => {
            const state = normalizeCiState(ci)
            const label = ci.workflowName ? `${ci.workflowName} / ${ci.name}` : ci.name
            const row = (
              <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted">
                <CiStateIcon state={state} />
                <span className="truncate">{label}</span>
              </div>
            )
            if (ci.detailsUrl) {
              return (
                <a
                  key={ci.id}
                  href={ci.detailsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block outline-none"
                >
                  {row}
                </a>
              )
            }
            return <div key={ci.id}>{row}</div>
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
