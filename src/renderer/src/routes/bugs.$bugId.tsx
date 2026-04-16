import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { BugDetailView } from '@renderer/components/bugs/bug-detail/bug-detail-view'
import { Button } from '@renderer/components/ui/button'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'

export const Route = createFileRoute('/bugs/$bugId')({
  loader: async ({ params }) => {
    const snapshot = await window.api.github.getSnapshot()
    const bug = snapshot.bugs.find((b) => b.id === params.bugId)
    const pr = bug ? snapshot.pullRequests.find((p) => p.id === bug.prId) : undefined
    return { bug, pr }
  },
  preloadStaleTime: 0,
  pendingComponent: BugDetailRoutePending,
  component: BugDetailPage,
})

function BugDetailRoutePending() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <p className="text-sm">Loading bug details…</p>
    </div>
  )
}

function BugDetailPage() {
  const { bugId } = Route.useParams()
  const { bug: loaderBug, pr: loaderPr } = Route.useLoaderData()
  const snapshot = useGithubSnapshot()

  const bug = snapshot.bugs.find((b) => b.id === bugId) ?? loaderBug
  const pr = bug
    ? snapshot.pullRequests.find((p) => p.id === bug.prId) ?? loaderPr
    : loaderPr

  React.useEffect(() => {
    void window.api.github.refresh()
  }, [bugId])

  if (!bug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          This bug is not in your current snapshot. It may have been resolved, or you may need to
          refresh.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/bugs">
            <ArrowLeft className="mr-2 size-4" />
            Back to bugs
          </Link>
        </Button>
      </div>
    )
  }

  return <BugDetailView bug={bug} pr={pr} />
}
