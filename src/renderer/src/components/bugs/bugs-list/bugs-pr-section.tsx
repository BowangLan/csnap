import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Icons } from '@renderer/components/icons'
import { List, ListItem } from '@renderer/components/ui/list'
import { ListSectionExpandToggle } from '@renderer/components/ui/list-section-expand-toggle'
import { deriveCiStatus } from '@renderer/lib/pr-ci'
import { cn } from '@renderer/lib/utils'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'
import { BugRow } from '../bug-block/bug-row'
import { SEVERITY_STYLES } from '../bug-block/bug-severity-badge'
import type { BugsPrGroup } from './group-bugs-by-repo'
import { PillButton } from '@renderer/components/ui/pill-button'

const CI_DOT_CLASS = {
  pending: 'bg-amber-400',
  failing: 'bg-rose-500',
  passing: 'bg-emerald-500',
} as const

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

export function BugsPrSection({
  group,
  prById,
  nested = false
}: {
  group: BugsPrGroup
  prById: Map<string, GithubPullRequest>
  /** When true, rendered under a repository section (secondary heading, no repo subtitle). */
  nested?: boolean
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const listId = useId()
  const pr = prById.get(group.prId)
  const ciStatus = pr ? deriveCiStatus(pr.ciStatuses) : null
  const headingId = `bugs-pr-heading-${safeId(group.prId)}`
  const title = pr?.title ?? 'Unknown pull request'
  const subtitle = !nested && pr ? pr.repositoryNameWithOwner : null
  const HeadingTag = nested ? 'h3' : 'h2'
  const severityCounts = countBugsBySeverity(group.bugs)

  return (
    <section className="min-w-0 space-y-1" aria-labelledby={headingId}>
      <ListItem
        className={nested ? 'bg-muted/40 py-2' : 'bg-muted py-2'}
        onClick={() => setExpanded((v) => !v)}
      >
        <ListSectionExpandToggle
          expanded={expanded}
          controlsId={listId}
          title={
            expanded
              ? 'Hide bugs for this pull request'
              : 'Show bugs for this pull request'
          }
          srOnlyLabel={`${expanded ? 'Collapse' : 'Expand'} bugs for pull request ${title}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <div className="flex-none shrink-0 relative">
              <Icons.PullRequest
                className="size-4 text-muted-foreground pointer-events-none flex-none"
                aria-hidden
              />
              {ciStatus ? (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-background',
                    CI_DOT_CLASS[ciStatus]
                  )}
                />
              ) : null}
            </div>
            <HeadingTag
              id={headingId}
              className="min-w-0 truncate text-sm font-medium text-foreground"
            >
              {pr ? (
                <Link
                  to="/prs/$prId"
                  params={{ prId: pr.id }}
                  className="select-none text-foreground/80 transition-colors hover:text-foreground"
                  title={title}
                  onClick={(e) => e.stopPropagation()}
                >
                  #{pr.number} {title}
                </Link>
              ) : (
                <span className="select-none text-foreground/80">{title}</span>
              )}
            </HeadingTag>
            <span className="inline-flex flex-wrap items-center gap-1 shrink-0 pointer-events-none">
              {SEVERITY_LEVELS.map((sev) => {
                const n = severityCounts[sev]
                if (n === 0) return null
                return (
                  <PillButton
                    key={sev}
                    variant="outline"
                    className={cn(
                      SEVERITY_STYLES[sev]
                    )}
                  >
                    <Icons.Bug className="size-3.5" />
                    {n}
                  </PillButton>
                )
              })}
            </span>
          </div>
          {subtitle ? (
            <p className="truncate pl-6 text-xs text-muted-foreground" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </ListItem>
      <div
        id={listId}
        hidden={!expanded}
        className={"pl-row-indent"}
      >
        <List>
          {group.bugs.map((bug) => (
            <BugRow
              key={bug.id}
              bug={bug}
              pr={prById.get(bug.prId)}
              showPr={!nested}
            />
          ))}
        </List>
      </div>
    </section>
  )
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-')
}
