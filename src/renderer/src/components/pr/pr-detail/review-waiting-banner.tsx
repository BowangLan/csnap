import * as React from 'react'
import { Button } from '@renderer/components/ui/button'
import type { GithubPullRequest } from '../../../../../shared/github'

export function ReviewWaitingBanner({ pr }: { pr: GithubPullRequest }) {
  const [visible, setVisible] = React.useState(true)

  if (!visible || pr.reviewDecision != null || pr.state !== 'OPEN') {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground/90">
        This PR is waiting for review. Open it on GitHub to leave a full review with comments.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" asChild>
          <a href={pr.url} target="_blank" rel="noreferrer">
            Open on GitHub
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
