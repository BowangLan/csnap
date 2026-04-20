import type { AggregateCiStatus } from '@renderer/lib/pr-ci'
import type { GithubPullRequest, LocalRepoGitStatus } from '../../../../../shared/github'

export type BranchMergeReadiness =
  | 'ready'
  | 'approved'
  | 'needs-rebase'
  | 'changes-requested'
  | 'review-pending'
  | 'ci-failing'
  | 'ci-pending'
  | 'conflicts'
  | 'draft'
  | 'unknown'

export interface BranchNode {
  id: string
  branchName: string
  baseBranchName: string
  pr: GithubPullRequest | null
  ciStatus: AggregateCiStatus
  readiness: BranchMergeReadiness
  isCurrentBranch: boolean
  children: BranchNode[]
  depth: number
}

export interface RepoTreeModel {
  nameWithOwner: string
  repoName: string
  defaultBranch: string
  localStatus: LocalRepoGitStatus | null
  localPath: string | null
  rootNode: BranchNode
  totalBranches: number
  readyCounts: Record<BranchMergeReadiness, number>
}
