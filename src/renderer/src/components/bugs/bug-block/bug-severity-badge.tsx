import type { PrBug } from '../../../../../shared/github'

const SEVERITY_STYLES: Record<PrBug['severity'], string> = {
  LOW: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  MEDIUM: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  HIGH: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  CRITICAL: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  UNKNOWN: 'bg-muted text-muted-foreground border-border'
}

export function BugSeverityBadge({ severity }: { severity: PrBug['severity'] }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  )
}

export const BUG_SEVERITY_BG_DOT: Record<PrBug['severity'], string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-blue-500',
  UNKNOWN: 'bg-muted-foreground'
}

export const BUG_SEVERITY_FG_DOT: Record<PrBug['severity'], string> = {
  CRITICAL: 'text-red-500',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-amber-400',
  LOW: 'text-blue-500',
  UNKNOWN: 'text-muted-foreground'
}
