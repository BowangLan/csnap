import { useId, useState } from 'react'
import { LocalRepoGitStatusBadge } from '@renderer/components/local-repo-git'
import { Icons } from '@renderer/components/icons'
import type { PullRequestsRepoGroup } from './group-pull-requests-by-repo'
import { List, ListItem } from '@renderer/components/ui/list'
import { ListSectionExpandToggle } from '@renderer/components/ui/list-section-expand-toggle'
import { PullRequestBlockRow } from '../pr-block/pr-block'

export function PullRequestsRepoSection({ group }: { group: PullRequestsRepoGroup }) {
  const [expanded, setExpanded] = useState(true)
  const listId = useId()
  const repoUrl = group.pullRequests[0]?.url.replace(/\/pull\/\d+$/, '') ?? '#'
  const [, repoName] = group.repositoryNameWithOwner.split('/')
  const headingId = `repo-heading-${repoIdFromNameWithOwner(group.repositoryNameWithOwner)}`

  return (
    <section className="min-w-0 space-y-1" aria-labelledby={headingId}>
      <ListItem className="bg-muted py-2" onClick={() => setExpanded((v) => !v)}>
        <ListSectionExpandToggle
          expanded={expanded}
          controlsId={listId}
          title={
            expanded
              ? 'Hide pull requests for this repository'
              : 'Show pull requests for this repository'
          }
          srOnlyLabel={`${expanded ? 'Collapse' : 'Expand'} ${group.repositoryNameWithOwner} pull requests`}
        />
        <div className='flex items-center gap-1.5 w-fit shrink-0'>
          <Icons.Repo className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2
            id={headingId}
            className="min-w-0 truncate text-sm font-medium text-muted-foreground"
          >
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/80 transition-colors hover:text-foreground select-none"
              title={group.repositoryNameWithOwner}
            >
              {repoName ?? group.repositoryNameWithOwner}
            </a>
          </h2>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Row Item: PR count */}
          <span className="inline-block shrink-0 select-none font-normal text-sm tabular-nums normal-case text-muted-foreground/60">
            {group.pullRequests.length}
          </span>

          <div className='flex-1'></div>

          {/* Row Item: Local diff (tracked + untracked; snapshot updates on window focus via main + query invalidation) */}
          <LocalRepoGitStatusBadge nameWithOwner={group.repositoryNameWithOwner} />
        </div>
      </ListItem>
      <div id={listId} hidden={!expanded}>
        <List>
          {group.pullRequests.map((pullRequest) => (
            <PullRequestBlockRow key={pullRequest.id} pullRequest={pullRequest} />
          ))}
        </List>
      </div>
    </section>
  )
}

function repoIdFromNameWithOwner(nameWithOwner: string): string {
  return nameWithOwner.replace(/[^a-zA-Z0-9_-]/g, '-')
}
