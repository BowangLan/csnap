import type { GithubSnapshot } from '../../../shared/github'

export function hasGithubCachedData(snapshot: GithubSnapshot): boolean {
  return (
    snapshot.pullRequests.length > 0 ||
    snapshot.repositories.length > 0 ||
    snapshot.bugs.length > 0
  )
}

export function isGithubInitialLoading(snapshot: GithubSnapshot): boolean {
  return (
    snapshot.sync.isRefreshing &&
    snapshot.sync.lastRefreshedAt === null &&
    !hasGithubCachedData(snapshot)
  )
}

export function isGithubRateLimited(snapshot: GithubSnapshot): boolean {
  return /rate limit/i.test(snapshot.sync.lastError ?? '')
}
