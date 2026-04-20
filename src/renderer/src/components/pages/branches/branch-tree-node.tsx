import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import type { BranchMergeReadiness, BranchNode } from './types'
import { getReadinessDisplay } from './readiness-label'

function ReadinessBadgeIcon({ readiness, mergeable }: { readiness: BranchMergeReadiness; mergeable: string | null }): JSX.Element | null {
  if (readiness === 'ready' && mergeable === 'MERGEABLE') return <GitMerge className="mr-0.5 size-2.5" />
  if (readiness === 'needs-rebase') return <RefreshCw className="mr-0.5 size-2.5" />
  if (readiness === 'conflicts') return <ArrowDownToLine className="mr-0.5 size-2.5" />
  return null
}

function BranchNodeCard({ node, defaultBranch }: { node: BranchNode; defaultBranch: string }): JSX.Element {
  const { pr, readiness, isCurrentBranch, branchName, baseBranchName } = node
  const display = getReadinessDisplay(readiness)
  const showBase = pr && baseBranchName && baseBranchName !== defaultBranch

  return (
    <div
      className={cn(
        'group relative flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
        isCurrentBranch
          ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20'
          : 'border-border/60 bg-card hover:bg-muted/40',
      )}
    >
      {/* Status dot */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('size-2 shrink-0 rounded-full', display.dotClass)} />
        </TooltipTrigger>
        <TooltipContent side="top">{display.label}</TooltipContent>
      </Tooltip>

      {/* Branch icon */}
      {pr ? (
        <GitPullRequest
          className={cn('size-3.5 shrink-0', isCurrentBranch ? 'text-emerald-500' : 'text-muted-foreground')}
        />
      ) : (
        <GitBranch
          className={cn('size-3.5 shrink-0', isCurrentBranch ? 'text-emerald-500' : 'text-muted-foreground/60')}
        />
      )}

      {/* Branch name + PR info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate font-mono text-xs font-medium',
              isCurrentBranch ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground',
            )}
            title={branchName}
          >
            {branchName}
          </span>
          {isCurrentBranch ? (
            <Badge variant="secondary" size="sm" className="text-[9px] uppercase tracking-wider font-semibold">
              HEAD
            </Badge>
          ) : null}
          {showBase ? (
            <span className="hidden items-center gap-0.5 text-[10px] text-muted-foreground/50 sm:flex" title={`Based on ${baseBranchName}`}>
              <ArrowDownToLine className="size-2.5" />
              <span className="font-mono">{baseBranchName}</span>
            </span>
          ) : null}
        </div>

        {pr ? (
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0 font-mono">#{pr.number}</span>
            <span className="min-w-0 truncate" title={pr.title}>
              {pr.title}
            </span>
          </div>
        ) : null}
      </div>

      {/* Right side: readiness badge + metadata */}
      <div className="flex shrink-0 items-center gap-2">
        {pr ? (
          <>
            {/* Changes */}
            <span className="hidden items-center gap-1 text-[10px] tabular-nums text-muted-foreground sm:flex">
              <span className="text-emerald-600 dark:text-emerald-400">+{pr.additions}</span>
              <span className="text-rose-600 dark:text-rose-400">−{pr.deletions}</span>
            </span>

            {/* Merge readiness tag */}
            <Badge
              variant="outline"
              size="sm"
              className={cn('font-medium text-[10px]', display.bgClass, display.textClass)}
            >
              <ReadinessBadgeIcon readiness={readiness} mergeable={pr.mergeable} />
              {display.shortLabel}
            </Badge>

            {/* Time */}
            <span className="hidden text-[10px] text-muted-foreground/60 lg:inline">
              {formatDistanceToNow(pr.updatedAt, { addSuffix: true })}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Link
                to="/prs/$prId"
                params={{ prId: pr.id }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                title="View PR details"
              >
                <GitPullRequest className="size-3" />
              </Link>
              <a
                href={pr.url}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                title="Open on GitHub"
                onClick={(e) => {
                  e.preventDefault()
                  window.api.shell.openExternal(pr.url)
                }}
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function BranchTreeNode({
  node,
  isLast,
  isRoot = false,
  defaultBranch,
}: {
  node: BranchNode
  isLast: boolean
  isRoot?: boolean
  defaultBranch: string
}): JSX.Element {
  const hasChildren = node.children.length > 0
  const [expanded, setExpanded] = useState(true)

  if (isRoot) {
    return (
      <div className="space-y-0">
        {/* Root branch (main/master) */}
        <div className="flex items-center gap-2 px-1 py-1">
          <GitBranch className="size-4 shrink-0 text-muted-foreground/70" />
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {node.branchName}
          </span>
          {node.isCurrentBranch ? (
            <Badge variant="secondary" size="sm" className="text-[9px] uppercase tracking-wider font-semibold">
              HEAD
            </Badge>
          ) : null}
          {hasChildren ? (
            <span className="text-[10px] text-muted-foreground/50">
              {node.children.length} branch{node.children.length === 1 ? '' : 'es'}
            </span>
          ) : null}
        </div>

        {/* Children */}
        {hasChildren ? (
          <div className="ml-2">
            {node.children.map((child, i) => (
              <BranchTreeNode
                key={child.id}
                node={child}
                isLast={i === node.children.length - 1}
                defaultBranch={defaultBranch}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative flex min-w-0">
      {/* Tree connector lines */}
      <div className="relative flex w-6 shrink-0 flex-col items-center">
        {/* Vertical line from parent */}
        <div
          className={cn(
            'absolute left-1/2 top-0 w-px -translate-x-1/2 bg-border/70',
            isLast ? 'h-8' : 'h-full',
          )}
        />
        {/* Horizontal line to node */}
        <div className="absolute left-1/2 top-[30px] h-px w-3 bg-border/70" />
        {/* Dot at junction */}
        <div className="absolute left-1/2 top-[28px] size-1.5 -translate-x-1/2 rounded-full bg-border" />
      </div>

      {/* Node content */}
      <div className="min-w-0 flex-1 pb-1.5 pt-1">
        <div className="flex items-start gap-1">
          {/* Expand/collapse if has children */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <BranchNodeCard node={node} defaultBranch={defaultBranch} />
          </div>
        </div>

        {/* Render children recursively */}
        {hasChildren && expanded ? (
          <div className="mt-0.5 min-w-0 ml-2">
            {node.children.map((child, i) => (
              <BranchTreeNode
                key={child.id}
                node={child}
                isLast={i === node.children.length - 1}
                defaultBranch={defaultBranch}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
