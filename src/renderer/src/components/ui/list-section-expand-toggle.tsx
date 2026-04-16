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

  disabled?: boolean

  className?: string
  /** When set, handles the click on this button (otherwise the row’s `ListItem` may toggle via bubbling). */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Chevron used on grouped list section headers; the row’s `ListItem` usually toggles expansion on click.
 */
export function ListSectionExpandToggle({
  expanded,
  controlsId,
  title,
  srOnlyLabel,
  disabled,
  className,
  onClick,
}: ListSectionExpandToggleProps): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'relative z-10 inline-flex shrink-0 select-none items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      aria-expanded={expanded}
      aria-controls={controlsId}
      title={title}
      onClick={onClick}
    >
      <ChevronRight
        className={cn('size-4 shrink-0 transition-transform duration-200', expanded && 'rotate-90')}
        aria-hidden
      />
      <span className="sr-only">{srOnlyLabel}</span>
    </button>
  )
}
