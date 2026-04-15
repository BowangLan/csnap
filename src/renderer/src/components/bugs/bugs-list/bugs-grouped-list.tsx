import type { GithubPullRequest, PrBug } from '../../../../../shared/github'
import { groupBugsByRepo, type BugSortMode } from './group-bugs-by-repo'
import { BugsRepoSection } from './bugs-repo-section'

export function BugsGroupedList({
  bugs,
  prById,
  sortMode,
  nestByPr
}: {
  bugs: PrBug[]
  prById: Map<string, GithubPullRequest>
  sortMode: BugSortMode
  /** Secondary grouping under each repository (indented PR blocks). */
  nestByPr: boolean
}): JSX.Element {
  const repoGroups = groupBugsByRepo(bugs, prById, sortMode)

  return (
    <div className="flex flex-col gap-1">
      {repoGroups.map((group) => (
        <BugsRepoSection
          key={group.repositoryNameWithOwner}
          group={group}
          prById={prById}
          nestByPr={nestByPr}
          sortMode={sortMode}
        />
      ))}
    </div>
  )
}
