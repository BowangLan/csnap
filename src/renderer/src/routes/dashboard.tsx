import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Icons } from '@renderer/components/icons'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@renderer/components/ui/chart'
import { List } from '@renderer/components/ui/list'
import { PillButton } from '@renderer/components/ui/pill-button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Spinner } from '@renderer/components/ui/spinner'
import { PullRequestBlockRow } from '@renderer/components/pr/pr-block/pr-block'
import {
  SEVERITY_STYLES,
} from '@renderer/components/bugs/bug-block/bug-severity-badge'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { deriveCiStatus } from '@renderer/lib/pr-ci'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequest, PrBug } from '../../../shared/github'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

const STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000

const SEVERITY_LEVELS: readonly PrBug['severity'][] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
]

function countBugsBySeverity(bugs: PrBug[]): Record<PrBug['severity'], number> {
  const counts: Record<PrBug['severity'], number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0,
  }
  for (const b of bugs) counts[b.severity]++
  return counts
}

/**
 * Heuristic urgency score for "what should I touch first today?".
 * Higher = more urgent. Pure function of the snapshot, no remote calls.
 */
function urgencyScore(
  pr: GithubPullRequest,
  prBugs: PrBug[],
  now: number,
): number {
  const ci = deriveCiStatus(pr.ciStatuses)
  const counts = countBugsBySeverity(prBugs)
  const ageDays = Math.max(0, (now - pr.updatedAt) / (1000 * 60 * 60 * 24))
  return (
    (ci === 'failing' ? 100 : 0) +
    counts.CRITICAL * 50 +
    counts.HIGH * 20 +
    counts.MEDIUM * 5 +
    counts.LOW * 1 +
    (ageDays > 3 ? Math.min(ageDays, 30) : 0) +
    (pr.reviewDecision === 'CHANGES_REQUESTED' ? 25 : 0) +
    (pr.isDraft ? -15 : 0)
  )
}

interface DashboardStats {
  needsAttention: number
  failingPrs: GithubPullRequest[]
  openBugs: PrBug[]
  bugsBySeverity: Record<PrBug['severity'], number>
  mergeable: GithubPullRequest[]
  stale: GithubPullRequest[]
  topPriority: GithubPullRequest[]
  repoChartData: Array<{
    repo: string
    fullName: string
    failing: number
    pending: number
    passing: number
    none: number
  }>
}

function computeStats(
  pullRequests: GithubPullRequest[],
  bugs: PrBug[],
  now: number,
): DashboardStats {
  const openBugs = bugs.filter((b) => b.status !== 'resolved')
  const bugsByPr = new Map<string, PrBug[]>()
  for (const bug of openBugs) {
    const list = bugsByPr.get(bug.prId)
    if (list) list.push(bug)
    else bugsByPr.set(bug.prId, [bug])
  }

  const failingPrs: GithubPullRequest[] = []
  const mergeable: GithubPullRequest[] = []
  const stale: GithubPullRequest[] = []

  for (const pr of pullRequests) {
    const ci = deriveCiStatus(pr.ciStatuses)
    const prBugs = bugsByPr.get(pr.id) ?? []
    if (ci === 'failing') failingPrs.push(pr)
    if (ci === 'passing' && prBugs.length === 0 && !pr.isDraft) mergeable.push(pr)
    if (now - pr.updatedAt > STALE_THRESHOLD_MS) stale.push(pr)
  }

  const scored = pullRequests
    .map((pr) => ({ pr, score: urgencyScore(pr, bugsByPr.get(pr.id) ?? [], now) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ pr }) => pr)

  // Build per-repo CI rollup chart data.
  const repoBuckets = new Map<
    string,
    { failing: number; pending: number; passing: number; none: number }
  >()
  for (const pr of pullRequests) {
    const ci = deriveCiStatus(pr.ciStatuses)
    const bucket = repoBuckets.get(pr.repositoryNameWithOwner) ?? {
      failing: 0,
      pending: 0,
      passing: 0,
      none: 0,
    }
    if (ci === 'failing') bucket.failing++
    else if (ci === 'pending') bucket.pending++
    else if (ci === 'passing') bucket.passing++
    else bucket.none++
    repoBuckets.set(pr.repositoryNameWithOwner, bucket)
  }
  const repoChartData = Array.from(repoBuckets.entries())
    .map(([fullName, b]) => ({
      fullName,
      // Show just the repo (not owner) on the axis to save space.
      repo: fullName.split('/').slice(-1)[0] ?? fullName,
      ...b,
    }))
    .sort(
      (a, b) =>
        b.failing + b.pending + b.passing + b.none -
        (a.failing + a.pending + a.passing + a.none),
    )

  return {
    needsAttention: failingPrs.length,
    failingPrs,
    openBugs,
    bugsBySeverity: countBugsBySeverity(openBugs),
    mergeable,
    stale,
    topPriority: scored,
    repoChartData,
  }
}

function Dashboard(): JSX.Element {
  const snapshot = useGithubSnapshot()
  const isInitialLoading =
    snapshot.sync.isRefreshing && snapshot.sync.lastRefreshedAt === null
  const isRefreshing = snapshot.sync.isRefreshing && !isInitialLoading

  const stats = useMemo(
    () => computeStats(snapshot.pullRequests, snapshot.bugs, Date.now()),
    [snapshot.pullRequests, snapshot.bugs],
  )

  const allClear =
    !isInitialLoading &&
    stats.needsAttention === 0 &&
    stats.openBugs.length === 0 &&
    stats.stale.length === 0 &&
    snapshot.pullRequests.length > 0

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHeader
        login={snapshot.auth.activeLogin}
        isRefreshing={isRefreshing}
        isInitialLoading={isInitialLoading}
        lastRefreshedAt={snapshot.sync.lastRefreshedAt}
        lastError={snapshot.sync.lastError}
      />

      <TriageStrip
        isInitialLoading={isInitialLoading}
        stats={stats}
        prCount={snapshot.pullRequests.length}
      />

      {allClear ? (
        <AllClearCard login={snapshot.auth.activeLogin} />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-7">
          <TopPriorityCard
            isInitialLoading={isInitialLoading}
            topPriority={stats.topPriority}
            className="lg:col-span-4"
          />
          <RepoLoadCard
            isInitialLoading={isInitialLoading}
            data={stats.repoChartData}
            className="lg:col-span-3"
          />
        </div>
      )}
    </div>
  )
}

function DashboardHeader({
  login,
  isRefreshing,
  isInitialLoading,
  lastRefreshedAt,
  lastError,
}: {
  login: string | null
  isRefreshing: boolean
  isInitialLoading: boolean
  lastRefreshedAt: number | null
  lastError: string | null
}): JSX.Element {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border -mx-2 pl-4 pr-2 pb-3">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {login ? `What you're working on, ${login}` : "What you're working on"}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <SyncDot
            tone={lastError ? 'failing' : 'passing'}
            label={lastError ? 'Last sync failed' : 'Sync healthy'}
          />
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="tabular-nums">
            {isInitialLoading
              ? 'Loading first sync…'
              : lastRefreshedAt
                ? `Last sync ${formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}`
                : 'Waiting for first sync'}
          </span>
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="size-3" />
              <span>Refreshing…</span>
            </span>
          ) : null}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void window.api.github.refresh()}
        disabled={isRefreshing || isInitialLoading}
      >
        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        Refresh
      </Button>
    </header>
  )
}

function SyncDot({
  tone,
  label,
}: {
  tone: 'passing' | 'failing' | 'pending'
  label: string
}): JSX.Element {
  const dotClass =
    tone === 'failing'
      ? 'bg-rose-500'
      : tone === 'pending'
        ? 'bg-amber-400'
        : 'bg-emerald-500'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn('size-1.5 rounded-full ring-1 ring-background', dotClass)}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  )
}

interface TriageStripProps {
  isInitialLoading: boolean
  stats: DashboardStats
  prCount: number
}

function TriageStrip({ isInitialLoading, stats, prCount }: TriageStripProps): JSX.Element {
  return (
    <section
      aria-label="Personal triage summary"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCard
        to="/prs"
        label="Needs your attention"
        icon={<AlertTriangle className="size-4" />}
        accent={stats.needsAttention > 0 ? 'rose' : 'muted'}
        value={stats.needsAttention}
        sub={
          stats.needsAttention === 0
            ? prCount === 0
              ? 'No open PRs'
              : 'All CI green on your PRs'
            : `${stats.needsAttention === 1 ? 'PR' : 'PRs'} with failing CI`
        }
        loading={isInitialLoading}
      />

      <KpiCard
        to="/bugs"
        label="Open bugs"
        icon={<Icons.Bug className="size-4" />}
        accent={stats.openBugs.length > 0 ? 'amber' : 'muted'}
        value={stats.openBugs.length}
        sub={
          stats.openBugs.length === 0
            ? 'Nothing flagged'
            : `${stats.bugsBySeverity.CRITICAL} critical · ${stats.bugsBySeverity.HIGH} high`
        }
        loading={isInitialLoading}
        extra={
          stats.openBugs.length > 0 ? (
            <span className="mt-2 inline-flex flex-wrap gap-1">
              {SEVERITY_LEVELS.map((sev) => {
                const n = stats.bugsBySeverity[sev]
                if (n === 0) return null
                return (
                  <PillButton
                    key={sev}
                    variant="outline"
                    size="sm"
                    className={cn('h-5 cursor-default pointer-events-none', SEVERITY_STYLES[sev])}
                  >
                    <Icons.Bug className="size-3" />
                    {n}
                  </PillButton>
                )
              })}
            </span>
          ) : null
        }
      />

      <KpiCard
        to="/prs"
        label="Mergeable now"
        icon={<CheckCircle2 className="size-4" />}
        accent={stats.mergeable.length > 0 ? 'emerald' : 'muted'}
        value={stats.mergeable.length}
        sub={
          stats.mergeable.length === 0
            ? 'Nothing ready to ship'
            : `${stats.mergeable.length === 1 ? 'PR is' : 'PRs are'} green and bug-free`
        }
        loading={isInitialLoading}
      />

      <KpiCard
        to="/prs"
        label="Stale"
        icon={<Clock className="size-4" />}
        accent={stats.stale.length > 0 ? 'amber' : 'muted'}
        value={stats.stale.length}
        sub={
          stats.stale.length === 0
            ? 'Nothing forgotten'
            : `Untouched for >3 days`
        }
        loading={isInitialLoading}
      />
    </section>
  )
}

type KpiAccent = 'rose' | 'emerald' | 'amber' | 'muted'

const ACCENT_VALUE_CLASS: Record<KpiAccent, string> = {
  rose: 'text-rose-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  muted: 'text-foreground',
}

const ACCENT_ICON_CLASS: Record<KpiAccent, string> = {
  rose: 'text-rose-500 bg-rose-500/10',
  emerald: 'text-emerald-500 bg-emerald-500/10',
  amber: 'text-amber-500 bg-amber-500/10',
  muted: 'text-muted-foreground bg-muted/40',
}

type KpiLinkTarget = '/prs' | '/bugs'

function KpiCard({
  to,
  label,
  icon,
  value,
  sub,
  accent,
  loading,
  extra,
}: {
  to: KpiLinkTarget
  label: string
  icon: React.ReactNode
  value: number
  sub: string
  accent: KpiAccent
  loading: boolean
  extra?: React.ReactNode
}): JSX.Element {
  const content = (
    <Card className="group relative gap-3 py-4 transition-colors hover:border-foreground/20 hover:bg-muted/40">
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md',
            ACCENT_ICON_CLASS[accent],
          )}
          aria-hidden
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div
            className={cn(
              'text-3xl font-semibold tabular-nums tracking-tight',
              ACCENT_VALUE_CLASS[accent],
            )}
          >
            {value}
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        {extra}
      </CardContent>
    </Card>
  )
  return (
    <Link to={to} className="block">
      {content}
    </Link>
  )
}

function TopPriorityCard({
  isInitialLoading,
  topPriority,
  className,
}: {
  isInitialLoading: boolean
  topPriority: GithubPullRequest[]
  className?: string
}): JSX.Element {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold">Touch these first</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ranked by failing CI, bug severity, and how long they&apos;ve sat untouched.
          </p>
        </div>
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className="px-2">
        {isInitialLoading ? (
          <div className="space-y-2 px-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topPriority.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No urgent work — everything green and recent.
          </p>
        ) : (
          <List>
            {topPriority.map((pr) => (
              <PullRequestBlockRow key={pr.id} pullRequest={pr} />
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  )
}

const repoChartConfig = {
  failing: { label: 'Failing', color: 'oklch(0.65 0.22 22)' },
  pending: { label: 'Pending', color: 'oklch(0.82 0.17 78)' },
  passing: { label: 'Passing', color: 'oklch(0.7 0.17 155)' },
  none: { label: 'No CI', color: 'oklch(0.55 0 0)' },
} satisfies ChartConfig

function RepoLoadCard({
  isInitialLoading,
  data,
  className,
}: {
  isInitialLoading: boolean
  data: DashboardStats['repoChartData']
  className?: string
}): JSX.Element {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold">PR load by repo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Where your open PRs are concentrated, stacked by CI state.
        </p>
      </CardHeader>
      <CardContent className="px-4">
        {isInitialLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open PRs to chart.
          </p>
        ) : (
          <ChartContainer config={repoChartConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} className="stroke-border/40" />
              <XAxis
                dataKey="repo"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={24}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ className: 'fill-muted/40' }}
                content={<ChartTooltipContent />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="failing" stackId="ci" fill="var(--color-failing)" radius={[0, 0, 2, 2]} />
              <Bar dataKey="pending" stackId="ci" fill="var(--color-pending)" />
              <Bar dataKey="passing" stackId="ci" fill="var(--color-passing)" />
              <Bar dataKey="none" stackId="ci" fill="var(--color-none)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function AllClearCard({ login }: { login: string | null }): JSX.Element {
  return (
    <Card className="border-dashed bg-muted/20 py-12">
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            You&apos;re clear{login ? `, ${login}` : ''}.
          </p>
          <p className="text-sm text-muted-foreground">
            No failing CI, no open bugs, nothing stale. Go build something new.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
