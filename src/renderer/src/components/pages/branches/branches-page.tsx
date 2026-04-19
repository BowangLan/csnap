import { useMemo, useState } from 'react'
import { GitBranch, Filter } from 'lucide-react'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import { useRepoStatuses } from '@renderer/hooks/use-repo-statuses'
import { cn } from '@renderer/lib/utils'
import { computeBranchTrees } from './compute-branch-trees'
import { RepoBranchTree } from './repo-branch-tree'
import { getReadinessDisplay } from './readiness-label'
import type { BranchMergeReadiness } from './types'

const FILTER_OPTIONS: { key: BranchMergeReadiness | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'conflicts', label: 'Conflicts' },
  { key: 'ci-failing', label: 'CI failing' },
  { key: 'changes-requested', label: 'Changes requested' },
  { key: 'review-pending', label: 'Review pending' },
  { key: 'draft', label: 'Draft' },
]

export function BranchesPage(): JSX.Element {
  const snapshot = useGithubSnapshot()
  const repoStatuses = useRepoStatuses()
  const [filter, setFilter] = useState<BranchMergeReadiness | 'all'>('all')

  const trees = useMemo(
    () => computeBranchTrees(snapshot, repoStatuses),
    [snapshot, repoStatuses],
  )

  const filteredTrees = useMemo(() => {
    if (filter === 'all') return trees
    return trees
      .map((tree) => {
        if (filter === 'ready') {
          const hasMatch = tree.readyCounts.ready > 0 || tree.readyCounts.approved > 0
          return hasMatch ? tree : null
        }
        return (tree.readyCounts[filter] ?? 0) > 0 ? tree : null
      })
      .filter(Boolean) as typeof trees
  }, [trees, filter])

  const globalCounts = useMemo(() => {
    const c: Record<BranchMergeReadiness, number> = {
      ready: 0, approved: 0, 'changes-requested': 0, 'review-pending': 0,
      'ci-failing': 0, 'ci-pending': 0, conflicts: 0, draft: 0, unknown: 0,
    }
    for (const tree of trees) {
      for (const [k, v] of Object.entries(tree.readyCounts)) {
        c[k as BranchMergeReadiness] += v
      }
    }
    return c
  }, [trees])

  const totalPrs = trees.reduce((sum, t) => sum + t.totalBranches, 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="size-4" />
          <span className="tabular-nums font-medium text-foreground">{totalPrs}</span>
          <span>open PR{totalPrs === 1 ? '' : 's'} across</span>
          <span className="tabular-nums font-medium text-foreground">{trees.length}</span>
          <span>repo{trees.length === 1 ? '' : 's'}</span>
        </div>

        <div className="mx-1 hidden h-4 w-px bg-border/60 sm:block" />

        {/* Quick status overview */}
        <div className="flex items-center gap-3">
          {(
            [
              ['ready', globalCounts.ready + globalCounts.approved],
              ['conflicts', globalCounts.conflicts],
              ['ci-failing', globalCounts['ci-failing']],
              ['ci-pending', globalCounts['ci-pending']],
              ['review-pending', globalCounts['review-pending']],
            ] as [BranchMergeReadiness, number][]
          )
            .filter(([, count]) => count > 0)
            .map(([key, count]) => {
              const display = getReadinessDisplay(key)
              return (
                <span key={key} className="flex items-center gap-1.5 text-xs" title={display.label}>
                  <span className={cn('size-2 rounded-full', display.dotClass)} />
                  <span className={cn('tabular-nums font-medium', display.textClass)}>{count}</span>
                  <span className="text-muted-foreground/60">{display.shortLabel.toLowerCase()}</span>
                </span>
              )
            })}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground/60" />
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trees */}
      {filteredTrees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-16 text-center">
          <GitBranch className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {filter === 'all'
              ? 'No open pull requests to visualize.'
              : `No branches matching "${FILTER_OPTIONS.find((f) => f.key === filter)?.label}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrees.map((tree) => (
            <RepoBranchTree key={tree.nameWithOwner} tree={tree} />
          ))}
        </div>
      )}
    </div>
  )
}
