export function badgeVariant(reviewDecision: string | null): 'default' | 'secondary' | 'outline' {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'default'
    case 'CHANGES_REQUESTED':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function reviewDecisionTone(reviewDecision: string | null): string {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
    case 'CHANGES_REQUESTED':
      return 'bg-rose-500/12 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
    default:
      return 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
  }
}

export function getReviewLabel(reviewDecision: string | null): string {
  switch (reviewDecision) {
    case 'APPROVED':
      return 'Approved'
    case 'CHANGES_REQUESTED':
      return 'Changes requested'
    default:
      return 'Needs review'
  }
}
