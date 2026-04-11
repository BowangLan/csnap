import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { PullRequestDetailView } from '@renderer/components/pr/pr-detail-view'
import { Button } from '@renderer/components/ui/button'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { normalizeCiState } from '@renderer/lib/pr-ci'

export const Route = createFileRoute('/prs/$prId')({
  component: PullRequestDetailPage,
})

function PullRequestDetailPage() {
  const { prId } = Route.useParams()
  const snapshot = useGithubSnapshot()
  const pullRequest = snapshot.pullRequests.find((candidate) => candidate.id === prId)

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
