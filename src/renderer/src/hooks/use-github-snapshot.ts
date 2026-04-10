import { useEffect, useRef, useState } from 'react'
import type { GithubSnapshot } from '../../../shared/github'

const FOCUS_REFRESH_COOLDOWN_MS = 5_000

export function useGithubSnapshot(): GithubSnapshot {
  const [snapshot, setSnapshot] = useState<GithubSnapshot>(() => window.api.github.getSnapshot())
  const lastFocusRefreshAtRef = useRef(0)

  useEffect(() => {
    const unsubscribe = window.api.github.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })

    const refreshOnForeground = (): void => {
      const now = Date.now()
      if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_COOLDOWN_MS) {
        return
      }

      lastFocusRefreshAtRef.current = now
      void window.api.github.refresh()
    }

    const handleWindowFocus = (): void => {
      refreshOnForeground()
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        refreshOnForeground()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      unsubscribe()
    }
  }, [])

  return snapshot
}
