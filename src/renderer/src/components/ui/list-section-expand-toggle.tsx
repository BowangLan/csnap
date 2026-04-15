import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export type ListSectionExpandToggleProps = {
  expanded: boolean
  /** `id` of the collapsible region controlled by this button. */
  controlsId: string
  /** Tooltip (typically “Hide …” when expanded, “Show …” when collapsed). */
  title: string
  /** Full accessible name for screen readers. */
  srOnlyLabel: string
  className?: string
}

/**
 * Chevron used on grouped list section headers; the row’s `ListItem` usually toggles expansion on click.
 */
export function ListSectionExpandToggle({
  expanded,
  controlsId,
  title,
  srOnlyLabel,
  className,
}: ListSectionExpandToggleProps): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'relative z-10 inline-flex shrink-0 select-none items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      aria-expanded={expanded}
      aria-controls={controlsId}
      title={title}
    >
      <ChevronRight
        className={cn('size-4 transition-transform duration-200', expanded && 'rotate-90')}
        aria-hidden
      />
      <span className="sr-only">{srOnlyLabel}</span>
    </button>
  )
}
