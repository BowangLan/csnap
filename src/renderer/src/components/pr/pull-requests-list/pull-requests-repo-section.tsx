import { PullRequestBlock } from '@renderer/components/pr/pr-block'
import { Icons } from '@renderer/components/icons'
import type { PullRequestsRepoGroup } from './group-pull-requests-by-repo'

export function PullRequestsRepoSection({ group }: { group: PullRequestsRepoGroup }) {
  const repoUrl = group.pullRequests[0]?.url.replace(/\/pull\/\d+$/, '') ?? '#'
  const [, repoName] = group.repositoryNameWithOwner.split('/')
  const headingId = `repo-heading-${repoIdFromNameWithOwner(group.repositoryNameWithOwner)}`

  return (
    <section className="min-w-0 space-y-2" aria-labelledby={headingId}>
      <div className="flex min-w-0 items-center gap-2 px-1">
        <Icons.Repo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <h2
          id={headingId}
          className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title={group.repositoryNameWithOwner}
            onClick={(e) => e.stopPropagation()}
          >
            {repoName ?? group.repositoryNameWithOwner}
          </a>
          <span className="ml-1.5 font-normal normal-case tabular-nums text-muted-foreground/80">
            ({group.pullRequests.length})
          </span>
        </h2>
      </div>
      <div className="flex flex-col">
        {group.pullRequests.map((pullRequest) => (
          <PullRequestBlock key={pullRequest.id} pullRequest={pullRequest} />
        ))}
      </div>
    </section>
  )
}

function repoIdFromNameWithOwner(nameWithOwner: string): string {
  return nameWithOwner.replace(/[^a-zA-Z0-9_-]/g, '-')
}
