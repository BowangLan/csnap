import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { PullRequestsGroupedList } from '@renderer/components/pr/pull-requests-list'
import { PullRequestRowSkeleton } from '@renderer/components/pr/pr-block/pull-request-row-skeleton'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Button } from '@renderer/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { isGithubInitialLoading, isGithubRateLimited } from '@renderer/lib/github-sync'
import { normalizeCiState } from '@renderer/lib/pr-ci'

export const Route = createFileRoute('/prs/')({
  component: PullRequestsListPage,
})

function PullRequestsListPage() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = isGithubInitialLoading(snapshot)
  const isRateLimited = isGithubRateLimited(snapshot)

  const hasRunningCi = snapshot.pullRequests.some((pr) =>
    pr.ciStatuses.some((ci) => normalizeCiState(ci) === 'pending'),
  )

  React.useEffect(() => {
    if (!hasRunningCi) return
    const interval = setInterval(() => {
      void window.api.github.refresh()
    }, 15_000)
    return () => clearInterval(interval)
  }, [hasRunningCi])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void window.api.github.refresh()}
          disabled={snapshot.sync.isRefreshing}
        >
          <RefreshCw className={snapshot.sync.isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      <section className="min-w-0 space-y-4">
        {isRateLimited ? (
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTitle>GitHub rate limit reached</AlertTitle>
            <AlertDescription>{snapshot.sync.lastError}</AlertDescription>
          </Alert>
        ) : null}
        {isInitialLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, index) => (
              <PullRequestRowSkeleton key={index} />
            ))}
          </div>
        ) : snapshot.pullRequests.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No open pull requests you authored.
          </div>
        ) : (
          <PullRequestsGroupedList pullRequests={snapshot.pullRequests} />
        )}
      </section>
    </div>
  )
}
