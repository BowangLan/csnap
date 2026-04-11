import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@renderer/components/ui/sonner'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { AppSidebar } from '@renderer/components/AppSidebar'
import { Separator } from '@renderer/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@renderer/components/ui/breadcrumb'
import appCss from '@renderer/assets/base.css?url'

const RootLayout = () => {
  const location = useLocation()

  // Simple breadcrumb logic
  const path = location.pathname
  const pageName = path === '/' ? 'Home' : path.slice(1).charAt(0).toUpperCase() + path.slice(2)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-border/40">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">App</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {/* Draggable region for the main content header */}
          <div
            className="flex-1 h-full"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          />
        </header>
        <div className="flex flex-1 flex-col gap-4 py-4 px-2 pt-0 mt-4">
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
