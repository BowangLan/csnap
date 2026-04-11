export function reviewerStatusLabel(state: string): string {
  switch (state) {
    case 'APPROVED':
      return 'Approved'
    case 'CHANGES_REQUESTED':
      return 'Changes requested'
    case 'COMMENTED':
      return 'Commented'
    case 'DISMISSED':
      return 'Dismissed'
    case 'PENDING':
      return 'Review requested'
    default:
      return state.replaceAll('_', ' ').toLowerCase()
  }
}
