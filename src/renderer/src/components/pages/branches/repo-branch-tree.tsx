import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderGit2 } from 'lucide-react'
import { Icons } from '@renderer/components/icons'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import type { RepoTreeModel } from './types'
import { BranchTreeNode } from './branch-tree-node'
import { getReadinessDisplay } from './readiness-label'

function ReadinessSummary({ counts }: { counts: RepoTreeModel['readyCounts'] }): JSX.Element {
  const items = [
    { key: 'ready' as const, count: counts.ready + counts.approved },
    { key: 'ci-pending' as const, count: counts['ci-pending'] },
    { key: 'review-pending' as const, count: counts['review-pending'] },
    { key: 'changes-requested' as const, count: counts['changes-requested'] },
    { key: 'ci-failing' as const, count: counts['ci-failing'] },
    { key: 'conflicts' as const, count: counts.conflicts },
    { key: 'draft' as const, count: counts.draft },
  ].filter((item) => item.count > 0)

  if (items.length === 0) return <></>

  return (
    <div className="flex items-center gap-1.5">
      {items.map(({ key, count }) => {
        const display = getReadinessDisplay(key)
        return (
          <span key={key} className="flex items-center gap-1 text-[10px]" title={display.label}>
            <span className={cn('size-1.5 rounded-full', display.dotClass)} />
            <span className={cn('tabular-nums', display.textClass)}>{count}</span>
          </span>
        )
      })}
    </div>
  )
}

export function RepoBranchTree({ tree }: { tree: RepoTreeModel }): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const hasLocalClone = tree.localPath !== null

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-card/50">
      {/* Repo header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors',
          'hover:bg-muted/30',
          expanded ? 'border-border/50' : 'border-transparent',
        )}
      >
        <span className="flex size-4 items-center justify-center text-muted-foreground/70">
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>

        <Icons.Repo className="size-4 shrink-0 text-muted-foreground" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium">{tree.repoName}</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground/60">
            {tree.nameWithOwner}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ReadinessSummary counts={tree.readyCounts} />

          {hasLocalClone ? (
            <Badge variant="secondary" size="sm" className="text-[9px] uppercase tracking-wider font-normal">
              <FolderGit2 className="mr-0.5 size-2.5" />
              Local
            </Badge>
          ) : null}

          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {tree.totalBranches} PR{tree.totalBranches === 1 ? '' : 's'}
          </span>
        </div>
      </button>

      {/* Tree body */}
      {expanded ? (
        <div className="px-4 py-3">
          <BranchTreeNode node={tree.rootNode} isLast isRoot />
        </div>
      ) : null}
    </section>
  )
}
