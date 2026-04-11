import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null
  const isRefreshing = snapshot.sync.isRefreshing && !isInitialLoading

  return (
    <div className="p-4 max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">GitHub Notify</h1>
        <p className="text-muted-foreground">
          Track repositories and open pull requests from your authenticated GitHub CLI session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>Review the repository table backing tracked pull requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {isInitialLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-52" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {snapshot.repositories.length} repositories currently loaded from GitHub.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/repos">Open Repositories</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pull Requests</CardTitle>
            <CardDescription>Open pull requests you authored (synced from GitHub).</CardDescription>
          </CardHeader>
          <CardContent>
            {isInitialLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {snapshot.pullRequests.length} open pull requests are being monitored.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/prs">Open Pull Requests</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Control refresh cadence and PR update sounds.</CardDescription>
          </CardHeader>
          <CardContent>
            {isInitialLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Refresh interval is currently {snapshot.settings.refreshIntervalSeconds} seconds.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/settings">Open Settings</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current state of the GitHub sync service.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {isRefreshing ? (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Refreshing GitHub data...
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                snapshot.auth.isAuthenticated ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium">
              {snapshot.auth.isAuthenticated
                ? `GitHub CLI connected as ${snapshot.auth.activeLogin}`
                : 'GitHub CLI disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                snapshot.sync.lastError ? 'bg-red-500' : 'bg-green-500'
              }`}
            />
            <span className="text-sm font-medium">
              {snapshot.sync.lastError ? 'Last refresh failed' : 'Refresh loop healthy'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">
              {isInitialLoading
                ? 'Loading first sync...'
                : snapshot.sync.lastRefreshedAt
                ? `Last sync ${formatDistanceToNow(snapshot.sync.lastRefreshedAt, { addSuffix: true })}`
                : 'Waiting for first sync'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
