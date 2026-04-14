import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, Check, GitMerge, Loader2, PenLine, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { deriveCiStatus } from '@renderer/lib/pr-ci'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequest } from '../../../../../shared/github'

type MergeStatus =
  | { kind: 'mergeable' }
  | { kind: 'conflicting' }
  | { kind: 'unknown' }
  | { kind: 'draft' }
  | { kind: 'changes_requested' }
  | { kind: 'ci_pending' }
  | { kind: 'ci_failing' }

function getMergeStatus(pr: GithubPullRequest): MergeStatus {
  if (pr.isDraft) return { kind: 'draft' }
  if (pr.mergeable === 'CONFLICTING') return { kind: 'conflicting' }
  if (pr.mergeable === 'UNKNOWN') return { kind: 'unknown' }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return { kind: 'changes_requested' }
  const ci = deriveCiStatus(pr.ciStatuses)
  if (ci === 'failing') return { kind: 'ci_failing' }
  if (ci === 'pending') return { kind: 'ci_pending' }
  return { kind: 'mergeable' }
}

function ciAllowsMerge(pr: GithubPullRequest): boolean {
  const ci = deriveCiStatus(pr.ciStatuses)
  return ci === null || ci === 'passing'
}

const MERGE_STATUS_CONFIG = {
  mergeable: {
    icon: Check,
    label: 'This branch has no conflicts with the base branch',
    cardClass: 'border-emerald-500/25 bg-emerald-500/10',
    iconClass: 'text-emerald-500',
    blocked: false,
  },
  conflicting: {
    icon: AlertTriangle,
    label: 'This branch has conflicts that must be resolved',
    cardClass: 'border-amber-500/25 bg-amber-500/10',
    iconClass: 'text-amber-500',
    blocked: true,
  },
  unknown: {
    icon: Loader2,
    label: 'Checking mergeability…',
    cardClass: 'border-border/60 bg-muted/30',
    iconClass: 'text-muted-foreground animate-spin',
    blocked: true,
  },
  draft: {
    icon: PenLine,
    label: 'Draft pull requests cannot be merged',
    cardClass: 'border-border/60 bg-muted/30',
    iconClass: 'text-muted-foreground',
    blocked: true,
  },
  changes_requested: {
    icon: X,
    label: 'Changes have been requested',
    cardClass: 'border-rose-500/25 bg-rose-500/10',
    iconClass: 'text-rose-500',
    blocked: true,
  },
  ci_pending: {
    icon: Loader2,
    label: 'Waiting for checks — all must succeed or be skipped before merging',
    cardClass: 'border-amber-500/25 bg-amber-500/10',
    iconClass: 'text-amber-500 animate-spin',
    blocked: true,
  },
  ci_failing: {
    icon: X,
    label: 'Checks must be passing or skipped before merging',
    cardClass: 'border-rose-500/25 bg-rose-500/10',
    iconClass: 'text-rose-500',
    blocked: true,
  },
} as const

type MergeConfirmState = 'idle' | 'confirm' | 'merging'

export function MergeCard({ pr }: { pr: GithubPullRequest }) {
  const navigate = useNavigate()
  const [confirmState, setConfirmState] = React.useState<MergeConfirmState>('idle')
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

  const status = getMergeStatus(pr)
  const config = MERGE_STATUS_CONFIG[status.kind]
  const mergeBlocked = config.blocked

  React.useEffect(() => {
    if (mergeBlocked && confirmState === 'confirm') {
      clearConfirmTimeout()
      setConfirmState('idle')
    }
  }, [mergeBlocked, confirmState])

  const handleFirstClick = () => {
    setConfirmState('confirm')
    clearConfirmTimeout()
    confirmTimeoutRef.current = setTimeout(() => setConfirmState('idle'), 4000)
  }

  const handleConfirm = async () => {
    if (!ciAllowsMerge(pr)) {
      toast.error('Cannot merge yet', {
        description: 'All checks must be passing or skipped.',
      })
      setConfirmState('idle')
      return
    }
    clearConfirmTimeout()
    setConfirmState('merging')
    try {
      await window.api.github.squashAndMerge(pr.url)
      toast.success('PR merged', {
        description: `#${pr.number} squash-merged and branch deleted.`,
      })
      void navigate({ to: '/prs' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Merge failed', { description: message })
      setConfirmState('idle')
    }
  }

  const handleCancel = () => {
    clearConfirmTimeout()
    setConfirmState('idle')
  }

  const StatusIcon = config.icon

  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg border px-4 py-3', config.cardClass)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusIcon className={cn('size-4 shrink-0', config.iconClass)} />
        <p className="text-sm text-foreground/80">{config.label}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {confirmState === 'merging' ? (
          <Button variant="default" size="sm" disabled className="gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            Merging…
          </Button>
        ) : confirmState === 'confirm' ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => void handleConfirm()} className="gap-1.5" autoFocus>
              <GitMerge className="size-3.5" />
              Confirm merge
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={config.blocked}
            onClick={config.blocked ? undefined : handleFirstClick}
            className="gap-1.5"
          >
            <GitMerge className="size-3.5" />
            Squash &amp; Merge
          </Button>
        )}
      </div>
    </div>
  )
}
