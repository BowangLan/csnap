import type { GithubPullRequest } from '../../../../shared/github'
import { CommitsSection } from './pr-detail/commits-section'
import { CommentsSection } from './pr-detail/comments-section'
import { DescriptionSection } from './pr-detail/description-section'
import { MergeCard } from './pr-detail/merge-card'
import { PrDetailHeader } from './pr-detail/pr-detail-header'
import { PrDetailSidebar } from './pr-detail/pr-detail-sidebar'
import { ReviewWaitingBanner } from './pr-detail/review-waiting-banner'

export function PullRequestDetailView({ pullRequest: pr }: { pullRequest: GithubPullRequest }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 pb-8 px-3 flex-1 min-h-0">
      <PrDetailHeader pr={pr} />

      {pr.state === 'OPEN' && <MergeCard pr={pr} />}

      <ReviewWaitingBanner pr={pr} />

      <div className="grid pb-8 min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <CommitsSection pr={pr} />
          <DescriptionSection pr={pr} />
          <CommentsSection pr={pr} />
        </div>

        <PrDetailSidebar pr={pr} />
      </div>
    </div>
  )
}
