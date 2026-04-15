import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { inferBugStatusFromComment } from '../../../../../shared/bug-detection'
import type { BugStatus, GithubPullRequest, PrBug } from '../../../../../shared/github'

/** Select value when status follows GitHub-derived detection (not pinned). */
const STATUS_FOLLOW_GITHUB = '__github__'

const MANUAL_STATUS_VALUES: BugStatus[] = ['todo', 'in-progress', 'resolved', 'ignored']

function statusLabel(status: BugStatus): string {
  switch (status) {
    case 'resolved':
      return 'Resolved'
    case 'ignored':
      return 'Ignored'
    case 'in-progress':
      return 'In progress'
    default:
      return 'To do'
  }
}

export function BugStatusSelect({
  bug,
  pr
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
}): JSX.Element {
  const selectValue = bug.statusIsManual ? bug.status : STATUS_FOLLOW_GITHUB

  const applyChange = (value: string): void => {
    if (value === STATUS_FOLLOW_GITHUB) {
      const comment = pr?.comments.find((c) => c.id === bug.commentId)
      const next = comment ? inferBugStatusFromComment(comment) : bug.status
      void window.api.github.setBugStatus(bug.commentId, next, false)
      return
    }
    void window.api.github.setBugStatus(bug.commentId, value as BugStatus, true)
  }

  return (
    <Select value={selectValue} onValueChange={applyChange}>
      <SelectTrigger
        size="sm"
        className="relative z-10 h-8 w-[min(100%,12.5rem)] text-[11px] pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SelectValue>
          {bug.statusIsManual
            ? `${statusLabel(bug.status)} · pinned`
            : `${statusLabel(bug.status)} · GitHub`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={STATUS_FOLLOW_GITHUB}>Match GitHub (comment)</SelectItem>
        <SelectSeparator />
        {MANUAL_STATUS_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            {statusLabel(s)} (manual)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
