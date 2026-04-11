import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { PullRequestBlock } from '@renderer/components/pr/pr-block/pr-block'
import { PullRequestRowSkeleton } from '@renderer/components/pr/pr-block/pull-request-row-skeleton'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Button } from '@renderer/components/ui/button'
import { normalizeCiState } from '@renderer/lib/pr-ci'

export const Route = createFileRoute('/prs/')({
  component: PullRequestsListPage,
})

function PullRequestsListPage() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null

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
          <div className="flex flex-col">
            {snapshot.pullRequests.map((pullRequest) => (
              <PullRequestBlock key={pullRequest.id} pullRequest={pullRequest} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
