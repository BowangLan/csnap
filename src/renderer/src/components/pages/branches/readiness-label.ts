import type { BranchMergeReadiness } from './types'

interface ReadinessDisplay {
  label: string
  shortLabel: string
  dotClass: string
  textClass: string
  bgClass: string
}

const READINESS_MAP: Record<BranchMergeReadiness, ReadinessDisplay> = {
  ready: {
    label: 'Ready to merge',
    shortLabel: 'Ready',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
  },
  approved: {
    label: 'Approved',
    shortLabel: 'Approved',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/8 border-emerald-500/25',
  },
  'needs-rebase': {
    label: 'Needs rebase',
    shortLabel: 'Rebase',
    dotClass: 'bg-violet-500',
    textClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-500/10 border-violet-500/30',
  },
  'review-pending': {
    label: 'Review pending',
    shortLabel: 'Review',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500/10 border-blue-500/30',
  },
  'ci-pending': {
    label: 'CI running',
    shortLabel: 'CI…',
    dotClass: 'bg-amber-400 animate-pulse',
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
  },
  'changes-requested': {
    label: 'Changes requested',
    shortLabel: 'Changes',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-500/10 border-orange-500/30',
  },
  'ci-failing': {
    label: 'CI failing',
    shortLabel: 'CI fail',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
  },
  conflicts: {
    label: 'Merge conflicts',
    shortLabel: 'Conflicts',
    dotClass: 'bg-rose-600',
    textClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
  },
  draft: {
    label: 'Draft',
    shortLabel: 'Draft',
    dotClass: 'bg-muted-foreground/50',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50 border-border/60',
  },
  unknown: {
    label: 'Unknown',
    shortLabel: '?',
    dotClass: 'bg-muted-foreground/40',
    textClass: 'text-muted-foreground/70',
    bgClass: 'bg-muted/30 border-border/40',
  },
}

export function getReadinessDisplay(readiness: BranchMergeReadiness): ReadinessDisplay {
  return READINESS_MAP[readiness]
}
