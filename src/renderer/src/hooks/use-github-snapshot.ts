import { startTransition, useEffect, useState } from 'react'
import type { GithubSnapshot } from '../../../shared/github'

export function useGithubSnapshot(): GithubSnapshot {
  const [snapshot, setSnapshot] = useState<GithubSnapshot>(() => window.api.github.getSnapshot())

  useEffect(() => {
    const unsubscribe = window.api.github.subscribe((nextSnapshot) => {
      startTransition(() => {
        setSnapshot(nextSnapshot)
      })
    })

    return unsubscribe
  }, [])

  return snapshot
}
