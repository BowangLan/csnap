import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, MapPin } from 'lucide-react'
import { Icons } from '@renderer/components/icons'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { Badge } from '@renderer/components/ui/badge'
import { Skeleton } from '@renderer/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@renderer/components/ui/table'
import type { PrBug } from '../../../shared/github'

export const Route = createFileRoute('/bugs')({
  component: BugsPage,
})

const SEVERITY_STYLES: Record<PrBug['severity'], string> = {
  LOW:      'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  MEDIUM:   'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  HIGH:     'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  CRITICAL: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  UNKNOWN:  'bg-muted text-muted-foreground border-border',
}

const SEVERITY_ORDER: Record<PrBug['severity'], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4,
}

function SeverityBadge({ severity }: { severity: PrBug['severity'] }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  )
}

function BugsTableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3.5">
          <Skeleton className="h-4 w-16" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

function BugsPage() {
  const snapshot = useGithubSnapshot()
  const isInitialLoading = snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null

  const bugs = [...snapshot.bugs].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  const prById = new Map(snapshot.pullRequests.map((pr) => [pr.id, pr]))

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Icons.Bug className="size-4 text-muted-foreground" />
          Detected Bugs
        </h1>
        {bugs.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {bugs.length}
          </Badge>
        )}
      </div>

      {isInitialLoading ? (
        <BugsTableSkeleton />
      ) : bugs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center">
          <Icons.Bug className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No bugs detected across your pull requests.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Severity</TableHead>
              <TableHead>Bug</TableHead>
              <TableHead>Pull Request</TableHead>
              <TableHead>Affected</TableHead>
              <TableHead className="w-32">Detected</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bugs.map((bug) => {
              const pr = prById.get(bug.prId)
              return (
                <TableRow key={bug.id}>
                  <TableCell>
                    <SeverityBadge severity={bug.severity} />
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium leading-snug">{bug.title}</span>
                      {bug.referenceId && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ref {bug.referenceId}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {pr ? (
                      <Link
                        to="/prs/$prId"
                        params={{ prId: pr.id }}
                        className="group flex flex-col gap-0.5"
                      >
                        <span className="text-sm font-medium group-hover:underline">
                          #{pr.number}
                        </span>
                        <span className="max-w-[18rem] truncate text-xs text-muted-foreground">
                          {pr.title}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unknown PR</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {bug.affectedLocations.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" aria-hidden />
                        {bug.affectedLocations.map((loc) => (
                          <code
                            key={loc}
                            className="rounded bg-muted px-1 py-px font-mono text-[10px]"
                            title={loc}
                          >
                            {loc.length > 40 ? `…${loc.slice(-38)}` : loc}
                          </code>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(bug.detectedAt, { addSuffix: true })}
                  </TableCell>

                  <TableCell>
                    {pr && (
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open PR on GitHub"
                        className="inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
