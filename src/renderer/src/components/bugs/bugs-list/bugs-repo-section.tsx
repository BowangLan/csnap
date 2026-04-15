import { useId, useState } from 'react'
import { Icons } from '@renderer/components/icons'
import { List, ListItem } from '@renderer/components/ui/list'
import { ListSectionExpandToggle } from '@renderer/components/ui/list-section-expand-toggle'
import type { GithubPullRequest } from '../../../../../shared/github'
import { BugRow } from '../bug-block/bug-row'
import { BugsPrSection } from './bugs-pr-section'
import { groupBugsByPr, type BugSortMode, type BugsRepoGroup } from './group-bugs-by-repo'

export function BugsRepoSection({
  group,
  prById,
  nestByPr,
  sortMode
}: {
  group: BugsRepoGroup
  prById: Map<string, GithubPullRequest>
  nestByPr: boolean
  sortMode: BugSortMode
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const listId = useId()
  const firstBug = group.bugs[0]
  const firstPr = firstBug ? prById.get(firstBug.prId) : undefined
  const isUnknown = group.repositoryNameWithOwner === '__unknown__'
  const repoUrl = !isUnknown && firstPr ? firstPr.url.replace(/\/pull\/\d+$/, '') : '#'
  const [, repoName] = group.repositoryNameWithOwner.split('/')
  const headingId = `bugs-repo-heading-${repoIdFromKey(group.repositoryNameWithOwner)}`

  return (
    <section className="min-w-0 space-y-1" aria-labelledby={headingId}>
      <ListItem className="bg-muted py-2" onClick={() => setExpanded((v) => !v)}>
        <ListSectionExpandToggle
          expanded={expanded}
          controlsId={listId}
          title={
            expanded
              ? 'Hide bugs for this repository'
              : 'Show bugs for this repository'
          }
          srOnlyLabel={`${expanded ? 'Collapse' : 'Expand'} ${
            isUnknown ? 'unknown repository' : group.repositoryNameWithOwner
          } bugs`}
        />
        <div className="flex w-fit shrink-0 items-center gap-1.5">
          <Icons.Repo className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 id={headingId} className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {isUnknown ? (
              <span className="text-foreground/80 select-none">Unknown repository</span>
            ) : (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="select-none text-foreground/80 transition-colors hover:text-foreground"
                title={group.repositoryNameWithOwner}
              >
                {repoName ?? group.repositoryNameWithOwner}
              </a>
            )}
          </h2>
        </div>
        <span className="inline-block select-none font-normal text-sm tabular-nums normal-case text-muted-foreground/60">
          {group.bugs.length}
        </span>
      </ListItem>
      <div id={listId} hidden={!expanded}>
        {nestByPr ? (
          <div className="space-y-1 pl-row-indent">
            {groupBugsByPr(group.bugs, prById, sortMode).map((prGroup) => (
              <BugsPrSection key={prGroup.prId} group={prGroup} prById={prById} nested />
            ))}
          </div>
        ) : (
          <List>
            {group.bugs.map((bug) => (
              <BugRow key={bug.id} bug={bug} pr={prById.get(bug.prId)} />
            ))}
          </List>
        )}
      </div>
    </section>
  )
}

function repoIdFromKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '-')
}
