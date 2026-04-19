import { createFileRoute } from '@tanstack/react-router'
import { BranchesPage } from '@renderer/components/pages/branches'

export const Route = createFileRoute('/branches')({
  component: BranchesPage,
})
