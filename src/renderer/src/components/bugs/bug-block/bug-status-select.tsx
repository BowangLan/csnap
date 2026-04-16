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
import { PillButton } from '@renderer/components/ui/pill-button'
import { cn } from '@renderer/lib/utils'

/** Select value when status follows GitHub-derived detection (not pinned). */
const STATUS_FOLLOW_GITHUB = '__github__'

const MANUAL_STATUS_VALUES: BugStatus[] = ['todo', 'in-progress', 'resolved', 'ignored']

const statusBgColorMap: Record<BugStatus, string> = {
  'todo': 'bg-blue-500',
  'in-progress': 'bg-orange-500',
  'resolved': 'bg-green-500',
  'ignored': 'bg-muted-foreground'
}

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
        asChild
      >
        <PillButton variant="outline" type="button" className="pointer-events-auto">
          <div
            className={cn('size-2 shrink-0 rounded-full', statusBgColorMap[bug.status])}
            aria-hidden
          />
          <SelectValue>
            {bug.statusIsManual
              ? `${statusLabel(bug.status)} · pinned`
              : `${statusLabel(bug.status)} · GitHub`}
          </SelectValue>
        </PillButton>
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
