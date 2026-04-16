import type { GithubPullRequest, PrBug } from '../../../../../shared/github'
import { BugDetailHeader } from './bug-detail-header'
import { BugDetailSidebar } from './bug-detail-sidebar'
import { BugDetailsSection } from './bug-details-section'
import { BugSourceComment } from './bug-source-comment'

export function BugDetailView({
  bug,
  pr,
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-3 pb-8 flex-1 min-h-0">
      <BugDetailHeader bug={bug} pr={pr} />

      <div className="grid min-w-0 gap-4 pb-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <BugDetailsSection bug={bug} />
          <BugSourceComment bug={bug} pr={pr} />
        </div>

        <BugDetailSidebar bug={bug} pr={pr} />
      </div>
    </div>
  )
}
