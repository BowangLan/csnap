import type { GithubPullRequest } from '../../../../../shared/github'

export type PullRequestsRepoGroup = {
  repositoryNameWithOwner: string
  pullRequests: GithubPullRequest[]
}

/**
 * Groups PRs by `repositoryNameWithOwner`, sorts repos alphabetically, and
 * orders PRs within each repo by `updatedAt` descending.
 */
export function groupPullRequestsByRepo(
  pullRequests: GithubPullRequest[],
): PullRequestsRepoGroup[] {
  const byRepo = new Map<string, GithubPullRequest[]>()
  for (const pr of pullRequests) {
    const key = pr.repositoryNameWithOwner
    const list = byRepo.get(key)
    if (list) list.push(pr)
    else byRepo.set(key, [pr])
  }

  return [...byRepo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repositoryNameWithOwner, prs]) => ({
      repositoryNameWithOwner,
      pullRequests: [...prs].sort((x, y) => y.updatedAt - x.updatedAt),
    }))
}
