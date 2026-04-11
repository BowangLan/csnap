import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/prs')({
  component: PrsLayout
})

function PrsLayout() {
  return <Outlet />
}
