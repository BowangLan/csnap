import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PullRequestDetailView } from '@renderer/components/pr/pr-detail-view'
import { Button } from '@renderer/components/ui/button'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { normalizeCiState } from '@renderer/lib/pr-ci'

export const Route = createFileRoute('/prs/$prId')({
  /**
   * Built-in loader so `preloadRoute` / `preload="intent"` actually resolve data (see preloading + data-loading guides).
   * Data lives in preload’s GitHub snapshot (external to the router); `preloadStaleTime: 0` re-reads on each preload.
   */
  loader: ({ params }) => {
    const pullRequest = window.api.github
      .getSnapshot()
      .pullRequests.find((candidate) => candidate.id === params.prId)
    return { pullRequest }
  },
  preloadStaleTime: 0,
  pendingComponent: PullRequestDetailRoutePending,
  component: PullRequestDetailPage,
})

function PullRequestDetailRoutePending() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <p className="text-sm">Loading pull request…</p>
    </div>
  )
}

function PullRequestDetailPage() {
  const { prId } = Route.useParams()
  const { pullRequest: loaderPullRequest } = Route.useLoaderData()
  const snapshot = useGithubSnapshot()
  const pullRequest =
    snapshot.pullRequests.find((candidate) => candidate.id === prId) ?? loaderPullRequest

  const hasRunningCi =
    pullRequest?.ciStatuses.some((ci) => normalizeCiState(ci) === 'pending') ?? false

  React.useEffect(() => {
    if (!hasRunningCi) return
    const interval = setInterval(() => {
      void window.api.github.refresh()
    }, 15_000)
    return () => clearInterval(interval)
  }, [hasRunningCi])

  if (!pullRequest) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          This pull request is not in your current snapshot. It may have been closed, or you may need to refresh.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/prs">
            <ArrowLeft className="mr-2 size-4" />
            Back to pull requests
          </Link>
        </Button>
      </div>
    )
  }

  return <PullRequestDetailView pullRequest={pullRequest} />
}
