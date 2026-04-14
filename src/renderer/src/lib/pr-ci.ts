import type { GithubPullRequestCiStatus } from '../../../shared/github'

export type NormalizedCiState = 'pending' | 'failing' | 'skipped' | 'passing'

export function normalizeCiState(ciStatus: GithubPullRequestCiStatus): NormalizedCiState {
  const value = (ciStatus.conclusion ?? ciStatus.status).toUpperCase()
  if (['QUEUED', 'IN_PROGRESS', 'PENDING', 'EXPECTED', 'WAITING', 'REQUESTED'].includes(value)) {
    return 'pending'
  }
  if (['SUCCESS', 'SUCCESSFUL', 'NEUTRAL'].includes(value)) {
    return 'passing'
  }
  if (value === 'SKIPPED') {
    return 'skipped'
  }
  return 'failing'
}

const CI_STATUS_PRIORITY: Record<NormalizedCiState, number> = {
  pending: 0,
  failing: 1,
  skipped: 2,
  passing: 3,
}

export function ciStatusPriority(state: NormalizedCiState): number {
  return CI_STATUS_PRIORITY[state]
}

export type AggregateCiStatus = 'pending' | 'failing' | 'passing' | null

export function deriveCiStatus(ciStatuses: GithubPullRequestCiStatus[]): AggregateCiStatus {
  if (ciStatuses.length === 0) return null
  const states = ciStatuses.map(normalizeCiState)
  if (states.some((s) => s === 'pending')) return 'pending'
  if (states.some((s) => s === 'failing')) return 'failing'
  return 'passing'
}
