import { startTransition, useEffect, useState } from 'react'
import type { LocalRepoGitStatus } from '../../../shared/github'

export function useRepoStatuses(): Record<string, LocalRepoGitStatus> {
  const [snapshot, setSnapshot] = useState<Record<string, LocalRepoGitStatus>>(() =>
    window.api.repoStatuses.getSnapshot(),
  )

  useEffect(() => {
    const unsubscribe = window.api.repoStatuses.subscribe((next) => {
      startTransition(() => {
        setSnapshot(next)
      })
    })

    return unsubscribe
  }, [])

  return snapshot
}
