import React from 'react'
import { SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@renderer/components/ui/breadcrumb'

interface AppHeaderProps {
  pageName: string
}

export function AppHeader({ pageName }: AppHeaderProps) {
  return (
    <header className="flex h-14 flex-none items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-border">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="min-w-0 max-w-[min(28rem,calc(100vw-8rem))]">
              <BreadcrumbPage className="block truncate">{pageName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div
        className="flex-1 h-full min-w-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
    </header>
  )
}
