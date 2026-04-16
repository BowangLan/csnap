import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/bugs')({
  component: BugsLayout,
})

function BugsLayout() {
  return <Outlet />
}
