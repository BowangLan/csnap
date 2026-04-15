import type { GithubPullRequest, PrBug } from '../../../../../shared/github'

export type BugsRepoGroup = {
  repositoryNameWithOwner: string
  bugs: PrBug[]
}

export type BugsPrGroup = {
  prId: string
  bugs: PrBug[]
}

/** User-controlled ordering before repo grouping. */
export type BugSortMode = 'detected' | 'severity'

const SEVERITY_ORDER: Record<PrBug['severity'], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4
}

function compareBugsByDetected(a: PrBug, b: PrBug): number {
  const byTime = b.detectedAt - a.detectedAt
  if (byTime !== 0) return byTime
  const bySev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  if (bySev !== 0) return bySev
  return a.id.localeCompare(b.id)
}

function compareBugsBySeverity(a: PrBug, b: PrBug): number {
  const bySev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  if (bySev !== 0) return bySev
  const byTime = b.detectedAt - a.detectedAt
  if (byTime !== 0) return byTime
  return a.id.localeCompare(b.id)
}

function sortBugsForMode(bugs: PrBug[], mode: BugSortMode): PrBug[] {
  const cmp = mode === 'detected' ? compareBugsByDetected : compareBugsBySeverity
  return [...bugs].sort(cmp)
}

/**
 * Sorts bugs (per `sortMode`), groups by the parent PR's `repositoryNameWithOwner`,
 * and sorts repo sections alphabetically (unknown last). Order within each group follows
 * the global sort (newest-first for detected, critical-first for severity).
 */
export function groupBugsByRepo(
  bugs: PrBug[],
  prById: Map<string, GithubPullRequest>,
  sortMode: BugSortMode = 'detected'
): BugsRepoGroup[] {
  const sorted = sortBugsForMode(bugs, sortMode)
  const byRepo = new Map<string, PrBug[]>()
  for (const bug of sorted) {
    const pr = prById.get(bug.prId)
    const key = pr?.repositoryNameWithOwner ?? '__unknown__'
    const list = byRepo.get(key)
    if (list) list.push(bug)
    else byRepo.set(key, [bug])
  }

  return [...byRepo.entries()]
    .sort(([a], [b]) => {
      if (a === '__unknown__') return 1
      if (b === '__unknown__') return -1
      return a.localeCompare(b)
    })
    .map(([repositoryNameWithOwner, list]) => ({
      repositoryNameWithOwner,
      bugs: list
    }))
}

/**
 * Sorts bugs (per `sortMode`), groups by parent PR, and sorts PR sections by
 * most recently updated PR first (unknown PRs last).
 */
export function groupBugsByPr(
  bugs: PrBug[],
  prById: Map<string, GithubPullRequest>,
  sortMode: BugSortMode = 'detected'
): BugsPrGroup[] {
  const sorted = sortBugsForMode(bugs, sortMode)
  const byPr = new Map<string, PrBug[]>()
  for (const bug of sorted) {
    const list = byPr.get(bug.prId)
    if (list) list.push(bug)
    else byPr.set(bug.prId, [bug])
  }

  return [...byPr.entries()]
    .sort(([aId], [bId]) => {
      const aPr = prById.get(aId)
      const bPr = prById.get(bId)
      const aUnknown = !aPr
      const bUnknown = !bPr
      if (aUnknown && !bUnknown) return 1
      if (!aUnknown && bUnknown) return -1
      if (aUnknown && bUnknown) return aId.localeCompare(bId)
      return bPr!.updatedAt - aPr!.updatedAt || aId.localeCompare(bId)
    })
    .map(([prId, list]) => ({ prId, bugs: list }))
}
