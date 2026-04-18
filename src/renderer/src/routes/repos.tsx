import { createFileRoute } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Spinner } from '@renderer/components/ui/spinner'
import { isGithubInitialLoading, isGithubRateLimited } from '@renderer/lib/github-sync'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'

export const Route = createFileRoute('/repos')({
  component: ReposPage
})

function ReposPage() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = isGithubInitialLoading(snapshot)
  const isRefreshing = snapshot.sync.isRefreshing && !isInitialLoading
  const isRateLimited = isGithubRateLimited(snapshot)

  return (
    <div className="flex flex-col gap-4 p-4">
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

      <section className="space-y-4">
        {isRefreshing ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Refreshing repository data...
          </div>
        ) : null}

        {snapshot.sync.lastError ? (
          <Alert className={isRateLimited ? 'border-amber-500/30 bg-amber-500/10' : ''}>
            <AlertTitle>{isRateLimited ? 'GitHub rate limit reached' : 'Refresh failed'}</AlertTitle>
            <AlertDescription>{snapshot.sync.lastError}</AlertDescription>
          </Alert>
        ) : null}

        {isInitialLoading ? (
          <RepositoriesTableSkeleton />
        ) : snapshot.repositories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No repositories are currently tracked.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Default Branch</TableHead>
                <TableHead className="text-right">Open PRs</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Pushed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.repositories.map((repository) => (
                <TableRow key={repository.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <a
                        href={repository.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        {repository.nameWithOwner}
                      </a>
                      <span className="text-xs text-muted-foreground">{repository.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={repository.isPrivate ? 'secondary' : 'outline'}>
                      {repository.isPrivate ? 'Private' : 'Public'}
                    </Badge>
                  </TableCell>
                  <TableCell>{repository.defaultBranch ?? 'n/a'}</TableCell>
                  <TableCell className="text-right">{repository.openPullRequestCount}</TableCell>
                  <TableCell>{formatTimestamp(repository.updatedAt)}</TableCell>
                  <TableCell>{formatTimestamp(repository.pushedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

function RepositoriesTableSkeleton() {
  return (
    <div className="relative w-full overflow-x-auto">
      <div className="min-w-[720px] text-sm">
        <div className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_0.8fr_1fr_1fr] gap-3 border-b px-2 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_0.8fr_1fr_1fr] gap-3 px-2 py-3"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-6 w-18 rounded-full" />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center justify-end">
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatTimestamp(value: number | null): string {
  if (!value) {
    return 'n/a'
  }

  return formatDistanceToNow(value, { addSuffix: true })
}
