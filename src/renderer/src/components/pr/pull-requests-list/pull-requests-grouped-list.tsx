import type { GithubPullRequest } from '../../../../../shared/github'
import { groupPullRequestsByRepo } from './group-pull-requests-by-repo'
import { PullRequestsRepoSection } from './pull-requests-repo-section'

export function PullRequestsGroupedList({ pullRequests }: { pullRequests: GithubPullRequest[] }) {
  const groups = groupPullRequestsByRepo(pullRequests)

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <PullRequestsRepoSection key={group.repositoryNameWithOwner} group={group} />
      ))}
    </div>
  )
}
