import type { LocalRepoGitStatus } from '../../../../shared/github'

export function localDiffTooltip(s: LocalRepoGitStatus): string {
  const bits = [
    `${s.linesAdded} added`,
    `${s.linesModified} modified`,
    `${s.linesDeleted} deleted`,
  ]
  if (s.untrackedCount > 0) bits.push(`${s.untrackedCount} untracked files`)
  if (s.hasConflicts) bits.push('merge conflicts')
  return `${bits.join(' · ')} — ${s.localPath}`
}

const DIFF_DIM = 'text-muted-foreground/45'

export function LineDiffTriplet({
  linesAdded,
  linesModified,
  linesDeleted,
}: {
  linesAdded: number
  linesModified: number
  linesDeleted: number
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className={linesAdded ? 'text-emerald-600 dark:text-emerald-400' : DIFF_DIM}>+{linesAdded}</span>
      <span className={linesModified ? 'text-amber-600 dark:text-amber-400' : DIFF_DIM}>~{linesModified}</span>
      <span className={linesDeleted ? 'text-rose-600 dark:text-rose-400' : DIFF_DIM}>−{linesDeleted}</span>
    </span>
  )
}

export function RepoDiffLineStats({ status }: { status: LocalRepoGitStatus }): JSX.Element {
  const { linesAdded, linesModified, linesDeleted, untrackedCount, hasConflicts } = status
  const hasLineDiff = linesAdded > 0 || linesDeleted > 0 || linesModified > 0

  if (hasConflicts) {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">Conflicts</span>
        <span className="text-border" aria-hidden>
          ·
        </span>
        <LineDiffTriplet
          linesAdded={linesAdded}
          linesModified={linesModified}
          linesDeleted={linesDeleted}
        />
        {untrackedCount > 0 ? (
          <>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <span className={DIFF_DIM}>{untrackedCount} untracked</span>
          </>
        ) : null}
      </span>
    )
  }

  if (!hasLineDiff && untrackedCount > 0) {
    return <span className={DIFF_DIM}>{untrackedCount} untracked</span>
  }

  if (!hasLineDiff && untrackedCount === 0 && status.changedCount > 0) {
    return (
      <span className={DIFF_DIM}>
        {status.changedCount} file{status.changedCount === 1 ? '' : 's'} changed
      </span>
    )
  }

  if (!hasLineDiff && untrackedCount === 0) {
    return <span className={DIFF_DIM}>clean</span>
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <LineDiffTriplet
        linesAdded={linesAdded}
        linesModified={linesModified}
        linesDeleted={linesDeleted}
      />
      {untrackedCount > 0 ? (
        <>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span className={DIFF_DIM}>{untrackedCount} untracked</span>
        </>
      ) : null}
    </span>
  )
}
