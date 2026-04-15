import { useQuery } from '@tanstack/react-query'
import { githubSnapshotQueryKey } from '@renderer/lib/query-keys'
import { EMPTY_GITHUB_SNAPSHOT, type GithubSnapshot } from '../../../shared/github'

export function useGithubSnapshot(): GithubSnapshot {
  const query = useQuery({
    queryKey: githubSnapshotQueryKey,
    queryFn: () => window.api.github.getSnapshot(),
    initialData: EMPTY_GITHUB_SNAPSHOT,
  })

  return query.data
}
