import type { GithubPullRequest } from '../../../../../shared/github'
import { Badge } from '@renderer/components/ui/badge'
import { extractLinearIssueId } from '@renderer/lib/pr-linear'

export function LinearIssueBadge({ pr }: { pr: GithubPullRequest }) {
  const issueId = extractLinearIssueId(pr)
  if (!issueId) return null
  return (
    <Badge
      asChild
      variant="outline"
      className="border-violet-300/60 bg-violet-500/10 px-1.5 text-violet-700 transition-colors [a&]:hover:bg-violet-500/20 [a&]:hover:text-violet-700 dark:border-violet-500/40 dark:text-violet-300 dark:[a&]:hover:bg-violet-500/20 dark:[a&]:hover:text-violet-300"
    >
      <a
        href={`https://linear.app/issue/${issueId}`}
        target="_blank"
        rel="noreferrer"
        title={`Open Linear issue ${issueId}`}
      >
        {issueId}
      </a>
    </Badge>
  )
}
