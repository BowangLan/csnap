import { useQuery } from '@tanstack/react-query'
import { repoStatusesQueryKey } from '@renderer/lib/query-keys'
import type { LocalRepoGitStatus } from '../../../shared/github'

export function useRepoStatuses(): Record<string, LocalRepoGitStatus> {
  const query = useQuery({
    queryKey: repoStatusesQueryKey,
    queryFn: () => window.api.repoStatuses.getSnapshot(),
    initialData: {},
  })

  return query.data
}
