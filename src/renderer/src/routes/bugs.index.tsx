import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { Icons } from '@renderer/components/icons'
import { BugsGroupedList, type BugSortMode } from '@renderer/components/bugs/bugs-list'
import { BugRowSkeleton } from '@renderer/components/bugs/bug-block'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'

export const Route = createFileRoute('/bugs/')({
  component: BugsPage
})

function BugsPage(): JSX.Element {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null
  const [sortMode, setSortMode] = useState<BugSortMode>('detected')
  const [nestByPr, setNestByPr] = useState(true)

  const bugs = snapshot.bugs.filter((b) => b.status !== 'resolved')
  const prById = new Map(snapshot.pullRequests.map((pr) => [pr.id, pr]))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border -mx-2 pl-4 pr-2 pb-2">
        <h1 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icons.Bug className="size-4 text-muted-foreground" />
          Detected bugs
          {bugs.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {bugs.length}
            </Badge>
          ) : null}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {bugs.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="bugs-nest-by-pr"
                  checked={nestByPr}
                  onCheckedChange={setNestByPr}
                />
                <Label
                  htmlFor="bugs-nest-by-pr"
                  className="cursor-pointer text-xs font-normal text-muted-foreground sm:text-sm"
                >
                  Group by PR
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">Sort</span>
                <Select value={sortMode} onValueChange={(value) => setSortMode(value as BugSortMode)}>
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-[min(100%,11rem)]"
                    aria-label="Sort bugs by"
                  >
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detected">Detected time</SelectItem>
                    <SelectItem value="severity">Severity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void window.api.github.refresh()}
            disabled={snapshot.sync.isRefreshing}
          >
            <RefreshCw
              className={snapshot.sync.isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
            Refresh
          </Button>
        </div>
      </div>

      <section className="min-w-0 space-y-4">
        {isInitialLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, index) => (
              <BugRowSkeleton key={index} />
            ))}
          </div>
        ) : bugs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center">
            <Icons.Bug className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No bugs detected across your pull requests.
            </p>
          </div>
        ) : (
          <BugsGroupedList bugs={bugs} prById={prById} sortMode={sortMode} nestByPr={nestByPr} />
        )}
      </section>
    </div>
  )
}
