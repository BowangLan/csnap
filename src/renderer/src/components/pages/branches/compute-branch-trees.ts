import { deriveCiStatus } from '@renderer/lib/pr-ci'
import type { GithubPullRequest, GithubSnapshot, LocalRepoGitStatus } from '../../../../../shared/github'
import type { BranchMergeReadiness, BranchNode, RepoTreeModel } from './types'

function deriveReadiness(pr: GithubPullRequest): BranchMergeReadiness {
  if (pr.isDraft) return 'draft'

  if (pr.mergeable === 'CONFLICTING') return 'conflicts'

  const ci = deriveCiStatus(pr.ciStatuses)
  if (ci === 'failing') return 'ci-failing'

  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes-requested'

  if (ci === 'pending') return 'ci-pending'

  if (pr.reviewDecision === 'APPROVED') {
    if (pr.mergeable === 'MERGEABLE') return 'ready'
    return 'approved'
  }

  if (pr.reviewDecision === 'REVIEW_REQUIRED' || pr.reviewDecision === null) {
    return 'review-pending'
  }

  return 'unknown'
}

function buildTree(
  pullRequests: GithubPullRequest[],
  defaultBranch: string,
  currentBranch: string | null,
): BranchNode {
  const prByHead = new Map<string, GithubPullRequest>()
  for (const pr of pullRequests) {
    prByHead.set(pr.headRefName, pr)
  }

  const branchChildren = new Map<string, Set<string>>()
  for (const pr of pullRequests) {
    const base = pr.baseRefName ?? defaultBranch
    if (!branchChildren.has(base)) branchChildren.set(base, new Set())
    branchChildren.get(base)!.add(pr.headRefName)
  }

  function buildNode(branchName: string, baseName: string, depth: number): BranchNode {
    const pr = prByHead.get(branchName) ?? null
    const children = Array.from(branchChildren.get(branchName) ?? [])
      .map((child) => buildNode(child, branchName, depth + 1))
      .sort((a, b) => {
        const readinessOrder: BranchMergeReadiness[] = [
          'ready', 'approved', 'ci-pending', 'review-pending',
          'changes-requested', 'ci-failing', 'conflicts', 'draft', 'unknown',
        ]
        const ra = readinessOrder.indexOf(a.readiness)
        const rb = readinessOrder.indexOf(b.readiness)
        if (ra !== rb) return ra - rb
        return a.branchName.localeCompare(b.branchName)
      })

    return {
      id: `${branchName}`,
      branchName,
      baseBranchName: baseName,
      pr,
      ciStatus: pr ? deriveCiStatus(pr.ciStatuses) : null,
      readiness: pr ? deriveReadiness(pr) : 'unknown',
      isCurrentBranch: branchName === currentBranch,
      children,
      depth,
    }
  }

  return buildNode(defaultBranch, '', 0)
}

function countNodes(node: BranchNode): number {
  return node.children.reduce((sum, child) => sum + countNodes(child), node.children.length)
}

function countReadiness(node: BranchNode, counts: Record<BranchMergeReadiness, number>): void {
  for (const child of node.children) {
    counts[child.readiness] = (counts[child.readiness] ?? 0) + 1
    countReadiness(child, counts)
  }
}

export function computeBranchTrees(
  snapshot: GithubSnapshot,
  repoStatuses: Record<string, LocalRepoGitStatus>,
): RepoTreeModel[] {
  const { pullRequests, repositories, settings } = snapshot

  const prsByRepo = new Map<string, GithubPullRequest[]>()
  for (const pr of pullRequests) {
    const key = pr.repositoryNameWithOwner
    if (!prsByRepo.has(key)) prsByRepo.set(key, [])
    prsByRepo.get(key)!.push(pr)
  }

  const repoNames = new Set<string>()
  for (const pr of pullRequests) repoNames.add(pr.repositoryNameWithOwner)

  const repoByName = new Map(repositories.map((r) => [r.nameWithOwner, r]))

  const trees: RepoTreeModel[] = []
  for (const nameWithOwner of repoNames) {
    const repo = repoByName.get(nameWithOwner)
    const repoPrs = prsByRepo.get(nameWithOwner) ?? []
    if (repoPrs.length === 0) continue

    const defaultBranch = repo?.defaultBranch ?? 'main'
    const localStatus = repoStatuses[nameWithOwner] ?? null
    const localPath = settings.localRepoPaths[nameWithOwner] ?? null

    const rootNode = buildTree(repoPrs, defaultBranch, localStatus?.branch ?? null)

    const readyCounts: Record<BranchMergeReadiness, number> = {
      ready: 0, approved: 0, 'changes-requested': 0, 'review-pending': 0,
      'ci-failing': 0, 'ci-pending': 0, conflicts: 0, draft: 0, unknown: 0,
    }
    countReadiness(rootNode, readyCounts)

    trees.push({
      nameWithOwner,
      repoName: nameWithOwner.split('/').pop() ?? nameWithOwner,
      defaultBranch,
      localStatus,
      localPath,
      rootNode,
      totalBranches: countNodes(rootNode),
      readyCounts,
    })
  }

  trees.sort((a, b) => {
    const aHasLocal = a.localStatus !== null
    const bHasLocal = b.localStatus !== null
    if (aHasLocal !== bHasLocal) return aHasLocal ? -1 : 1
    if (b.totalBranches !== a.totalBranches) return b.totalBranches - a.totalBranches
    return a.nameWithOwner.localeCompare(b.nameWithOwner)
  })

  return trees
}
