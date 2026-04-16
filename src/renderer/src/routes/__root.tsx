import React from 'react'
import { createRootRoute, Outlet, useLocation, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@renderer/components/ui/sonner'
import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { AppSidebar } from '@renderer/components/AppSidebar'
import { AppHeader } from '@renderer/components/AppHeader'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import appCss from '@renderer/assets/base.css?url'

const PR_DETAIL_PATH = /^\/prs\/([^/]+)$/
const BUG_DETAIL_PATH = /^\/bugs\/([^/]+)$/

function breadcrumbLabelFromPath(
  pathname: string,
  pullRequests: { id: string; title: string }[],
  bugs?: { id: string; title: string }[],
): string {
  if (pathname === '/' || pathname === '') {
    return 'Home'
  }

  const prMatch = pathname.match(PR_DETAIL_PATH)
  if (prMatch) {
    const prId = prMatch[1]
    const pullRequest = pullRequests.find((candidate) => candidate.id === prId)
    if (pullRequest) {
      return pullRequest.title
    }
    return 'Pull request'
  }

  const bugMatch = pathname.match(BUG_DETAIL_PATH)
  if (bugMatch) {
    const bugId = bugMatch[1]
    const bug = bugs?.find((candidate) => candidate.id === bugId)
    if (bug) {
      return bug.title
    }
    return 'Bug'
  }

  if (pathname === '/prs' || pathname === '/prs/') {
    return 'Pull requests'
  }

  if (pathname === '/bugs' || pathname === '/bugs/') {
    return 'Bugs'
  }

  const path = pathname.startsWith('/') ? pathname.slice(1) : pathname
  if (!path) {
    return 'Home'
  }
  return path.charAt(0).toUpperCase() + path.slice(1)
}

const RootLayout = () => {
  const location = useLocation()
  const snapshot = useGithubSnapshot()
  const isRouteBusy = useRouterState({
    select: (s) => s.isTransitioning || s.isLoading,
  })

  const pageName = React.useMemo(
    () => breadcrumbLabelFromPath(location.pathname, snapshot.pullRequests, snapshot.bugs),
    [location.pathname, snapshot.pullRequests, snapshot.bugs],
  )

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      {isRouteBusy ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-200 h-0.5 overflow-hidden bg-primary/15"
          aria-hidden
        >
          <div className="h-full w-full origin-left animate-pulse bg-primary/90 motion-reduce:animate-none" />
        </div>
      ) : null}
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AppHeader pageName={pageName} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4 pt-0 pt-2">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
      <TanStackRouterDevtools />
    </SidebarProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  head: () => ({ links: [{ rel: 'stylesheet', href: appCss }] })
})
