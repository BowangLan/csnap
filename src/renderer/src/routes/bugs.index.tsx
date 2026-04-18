import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { createFileRoute, Link } from '@tanstack/react-router'
import { GripVertical, RefreshCw } from 'lucide-react'
import { OpenInBrowserButton } from '@renderer/components/pr/pr-block/open-in-browser-button'
import { Icons } from '@renderer/components/icons'
import { BugRowSkeleton, BugSeverityBadge } from '@renderer/components/bugs/bug-block'
import { groupBugsByPr } from '@renderer/components/bugs/bugs-list/group-bugs-by-repo'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanOverlay
} from '@renderer/components/ui/kanban'
import { ScrollArea, ScrollBar } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import type { BugStatus, GithubPullRequest, PrBug } from '../../../shared/github'

export const Route = createFileRoute('/bugs/')({
  component: BugsPage
})

type BugSortMode = 'detected' | 'severity'

type BoardColumn = {
  title: string
  accentClassName: string
}

type BugColumns = Record<BugStatus, PrBug[]>

const COLUMN_META: Record<BugStatus, BoardColumn> = {
  todo: { title: 'To do', accentClassName: 'bg-blue-500' },
  'in-progress': { title: 'In progress', accentClassName: 'bg-orange-500' },
  resolved: { title: 'Resolved', accentClassName: 'bg-green-500' },
  ignored: { title: 'Ignored', accentClassName: 'bg-zinc-500' }
}

const COLUMN_ORDER: BugStatus[] = ['todo', 'in-progress', 'resolved', 'ignored']

const SEVERITY_ORDER: Record<PrBug['severity'], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4
}

function sortBugs(bugs: PrBug[], mode: BugSortMode): PrBug[] {
  return [...bugs].sort((left, right) => {
    if (mode === 'severity') {
      const severityDiff = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
      if (severityDiff !== 0) return severityDiff
    }

    return right.detectedAt - left.detectedAt || left.id.localeCompare(right.id)
  })
}

function buildColumns(bugs: PrBug[], mode: BugSortMode): BugColumns {
  const next: BugColumns = {
    todo: [],
    'in-progress': [],
    resolved: [],
    ignored: []
  }

  for (const bug of sortBugs(bugs, mode)) {
    next[bug.status].push(bug)
  }

  return next
}

function BugsPage(): JSX.Element {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null
  const [sortMode, setSortMode] = React.useState<BugSortMode>('detected')
  const [columns, setColumns] = React.useState<BugColumns>(() => buildColumns([], 'detected'))

  const prById = React.useMemo(
    () => new Map(snapshot.pullRequests.map((pr) => [pr.id, pr] as const)),
    [snapshot.pullRequests]
  )

  React.useEffect(() => {
    setColumns(buildColumns(snapshot.bugs, sortMode))
  }, [snapshot.bugs, sortMode])

  const bugs = React.useMemo(() => COLUMN_ORDER.flatMap((status) => columns[status]), [columns])

  const activeCount = React.useMemo(
    () => columns.todo.length + columns['in-progress'].length,
    [columns]
  )

  const handleColumnsChange = React.useCallback(
    (nextColumns: Record<string, PrBug[]>) => {
      const typedNext = nextColumns as BugColumns
      setColumns(typedNext)

      const previousById = new Map<string, BugStatus>()
      for (const status of COLUMN_ORDER) {
        for (const bug of columns[status]) {
          previousById.set(bug.id, status)
        }
      }

      for (const status of COLUMN_ORDER) {
        for (const bug of typedNext[status]) {
          const previousStatus = previousById.get(bug.id)
          if (previousStatus && previousStatus !== status) {
            void window.api.github.setBugStatus(bug.commentId, status, true)
          }
        }
      }
    },
    [columns]
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="-mx-2 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 pl-4 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icons.Bug className="size-4 text-muted-foreground" />
            Bugs board
          </h1>
          {bugs.length > 0 ? (
            <>
              <Badge variant="secondary" className="tabular-nums">
                {bugs.length}
              </Badge>
              <span className="text-xs text-muted-foreground">{activeCount} active</span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {bugs.length > 0 ? (
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
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void window.api.github.refresh()}
            disabled={snapshot.sync.isRefreshing}
          >
            <RefreshCw className={snapshot.sync.isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        </div>
      </div>

      <section className="min-w-0">
        {isInitialLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {COLUMN_ORDER.map((status) => (
              <div
                key={status}
                className="w-[22rem] shrink-0 rounded-lg border border-border/80 bg-muted/20 p-3"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn('size-2 rounded-full', COLUMN_META[status].accentClassName)}
                  />
                  <span className="text-sm font-medium">{COLUMN_META[status].title}</span>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <BugRowSkeleton key={`${status}-${index}`} />
                  ))}
                </div>
              </div>
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
          <Kanban
            value={columns}
            onValueChange={handleColumnsChange}
            getItemValue={(item) => item.id}
          >
            <ScrollArea className="w-full whitespace-nowrap pb-3">
              <KanbanBoard className="flex w-max min-w-full items-start gap-3 pb-3">
                {COLUMN_ORDER.map((status) => (
                  <KanbanColumn key={status} value={status} className="w-[22rem] shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('size-2 rounded-full', COLUMN_META[status].accentClassName)}
                        />
                        <span className="text-sm font-semibold">{COLUMN_META[status].title}</span>
                        <Badge variant="secondary" className="pointer-events-none rounded-sm">
                          {columns[status].length}
                        </Badge>
                      </div>
                      <KanbanColumnHandle asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="size-4" />
                        </Button>
                      </KanbanColumnHandle>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 p-0.5">
                      <SortableContext
                        items={columns[status].map((bug) => bug.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {groupBugsByPr(columns[status], prById, sortMode).map((group) => (
                          <PrGroup key={group.prId} bugs={group.bugs} pr={prById.get(group.prId)} />
                        ))}
                      </SortableContext>

                      {columns[status].length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
                          Drop a bug here
                        </div>
                      ) : null}
                    </div>
                  </KanbanColumn>
                ))}
              </KanbanBoard>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <KanbanOverlay>
              {({ activeItem }) =>
                activeItem ? (
                  <div className="w-[22rem] rotate-1 opacity-95">
                    <BugCard
                      bug={activeItem as PrBug}
                      pr={prById.get((activeItem as PrBug).prId)}
                    />
                  </div>
                ) : (
                  <div className="size-full rounded-md bg-primary/10" />
                )
              }
            </KanbanOverlay>
          </Kanban>
        )}
      </section>
    </div>
  )
}

function PrGroup({ bugs, pr }: { bugs: PrBug[]; pr: GithubPullRequest | undefined }): JSX.Element {
  return (
    <div className="rounded-md border border-border/70 bg-background/55 p-2">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {pr ? `${pr.repositoryNameWithOwner} #${pr.number}` : 'Unknown PR'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {pr?.title ?? 'Pull request unavailable'}
          </p>
        </div>
        <Badge variant="outline" className="rounded-sm tabular-nums">
          {bugs.length}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {bugs.map((bug) => (
          <KanbanItem key={bug.id} value={bug.id} asHandle asChild>
            <div>
              <BugCard bug={bug} pr={pr} />
            </div>
          </KanbanItem>
        ))}
      </div>
    </div>
  )
}

function BugCard({ bug, pr }: { bug: PrBug; pr: GithubPullRequest | undefined }): JSX.Element {
  return (
    <div className="rounded-md border bg-card p-3 shadow-xs">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/bugs/$bugId"
              params={{ bugId: bug.id }}
              className="line-clamp-2 font-medium text-sm transition-colors hover:text-primary"
            >
              {bug.title}
            </Link>
          </div>
          <Badge
            variant={bug.statusIsManual ? 'outline' : 'secondary'}
            className="pointer-events-none h-5 rounded-sm px-1.5 text-[11px]"
          >
            {bug.statusIsManual ? 'Pinned' : 'GitHub'}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
          <BugSeverityBadge severity={bug.severity} />
          {pr ? <OpenInBrowserButton url={pr.url} /> : null}
        </div>

        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span className="truncate">{pr ? `#${pr.number}` : 'Unknown PR'}</span>
          <time className="text-[10px] tabular-nums">
            {formatDistanceToNow(bug.detectedAt, { addSuffix: true })}
          </time>
        </div>
      </div>
    </div>
  )
}
