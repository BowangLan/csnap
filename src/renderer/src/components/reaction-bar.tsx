import { useCallback, useMemo, useState } from 'react'
import { Loader2, SmilePlus } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import type { GithubPullRequestReaction } from '../../../shared/github'

const REACTION_META: Record<string, { emoji: string; label: string }> = {
  THUMBS_UP: { emoji: '👍', label: 'Thumbs up' },
  THUMBS_DOWN: { emoji: '👎', label: 'Thumbs down' },
  LAUGH: { emoji: '😄', label: 'Laugh' },
  HOORAY: { emoji: '🎉', label: 'Hooray' },
  CONFUSED: { emoji: '😕', label: 'Confused' },
  HEART: { emoji: '❤️', label: 'Heart' },
  ROCKET: { emoji: '🚀', label: 'Rocket' },
  EYES: { emoji: '👀', label: 'Eyes' },
}

const ALL_REACTIONS = Object.keys(REACTION_META)

interface OptimisticToggle {
  content: string
  adding: boolean
}

function applyOptimistic(
  reactions: GithubPullRequestReaction[],
  optimistic: OptimisticToggle | null,
): GithubPullRequestReaction[] {
  if (!optimistic) return reactions

  const { content, adding } = optimistic
  const existing = reactions.find((r) => r.content === content)

  if (adding) {
    if (existing) {
      return reactions.map((r) =>
        r.content === content
          ? { ...r, count: r.count + (r.viewerHasReacted ? 0 : 1), viewerHasReacted: true }
          : r,
      )
    }
    return [...reactions, { content, count: 1, viewerHasReacted: true }]
  }

  if (!existing) return reactions
  return reactions.map((r) =>
    r.content === content
      ? { ...r, count: Math.max(0, r.count - (r.viewerHasReacted ? 1 : 0)), viewerHasReacted: false }
      : r,
  )
}

export function ReactionBar({
  reactions,
  subjectId,
}: {
  reactions: GithubPullRequestReaction[]
  subjectId: string
}) {
  const [optimistic, setOptimistic] = useState<OptimisticToggle | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const displayed = useMemo(() => applyOptimistic(reactions, optimistic), [reactions, optimistic])
  const pending = optimistic?.content ?? null

  const toggle = useCallback(
    async (content: string) => {
      if (optimistic) return
      const current = reactions.find((r) => r.content === content)
      const adding = !current?.viewerHasReacted
      setOptimistic({ content, adding })
      try {
        await window.api.github.toggleReaction(subjectId, content)
      } finally {
        setOptimistic(null)
      }
    },
    [subjectId, optimistic, reactions],
  )

  const visible = displayed.filter(
    (r) => r.count > 0 || r.viewerHasReacted || r.content === pending,
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((r) => {
        const meta = REACTION_META[r.content] ?? { emoji: r.content, label: r.content }
        const isActive = r.viewerHasReacted
        const isLoading = pending === r.content

        return (
          <Tooltip key={r.content}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void toggle(r.content)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-all duration-150
                  ${isActive
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                    : 'border-border/60 bg-muted/40 hover:bg-muted/70'
                  }
                  ${pending !== null && !isLoading ? 'opacity-60 cursor-default' : ''}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`}
              >
                {isLoading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <span aria-hidden>{meta.emoji}</span>
                )}
                <span className={isActive ? '' : 'text-muted-foreground'}>{r.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isLoading
                ? (isActive ? 'Adding…' : 'Removing…')
                : isActive
                  ? `Remove ${meta.label.toLowerCase()}`
                  : meta.label}
            </TooltipContent>
          </Tooltip>
        )
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={pending !== null}
                className={`inline-flex items-center justify-center rounded-full border border-dashed border-border/60 p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
                  ${pending !== null ? 'opacity-60 cursor-default' : ''}`}
              >
                <SmilePlus className="size-3.5" aria-hidden />
                <span className="sr-only">Add reaction</span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Add reaction</TooltipContent>
        </Tooltip>
        <PopoverContent side="top" align="start" className="w-auto p-1.5">
          <div className="flex gap-1">
            {ALL_REACTIONS.map((content) => {
              const meta = REACTION_META[content]
              const alreadyReacted = reactions.find((r) => r.content === content)?.viewerHasReacted
              return (
                <Tooltip key={content}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false)
                        void toggle(content)
                      }}
                      className={`rounded-md p-1.5 text-base transition-colors hover:bg-muted
                        ${alreadyReacted ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    >
                      {meta.emoji}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{meta.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
