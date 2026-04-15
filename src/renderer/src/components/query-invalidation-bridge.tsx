import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  githubSnapshotQueryKey,
  repoStatusesQueryKey,
  todosQueryKey,
} from '@renderer/lib/query-keys'

export function QueryInvalidationBridge(): null {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubGithub = window.api.github.subscribeChanged(() => {
      void queryClient.invalidateQueries({ queryKey: githubSnapshotQueryKey })
    })

    const unsubRepoStatuses = window.api.repoStatuses.subscribeChanged(() => {
      void queryClient.invalidateQueries({ queryKey: repoStatusesQueryKey })
    })

    const unsubTodos = window.api.todos.subscribeChanged(() => {
      void queryClient.invalidateQueries({ queryKey: todosQueryKey })
    })

    return () => {
      unsubGithub()
      unsubRepoStatuses()
      unsubTodos()
    }
  }, [queryClient])

  return null
}
