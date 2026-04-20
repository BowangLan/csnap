import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import { Button } from '@renderer/components/ui/button'
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

function useHistoryNavigationState() {
  const router = useRouter()
  const [state, setState] = React.useState({ canGoBack: false, canGoForward: false })

  React.useEffect(() => {
    const update = (): void => {
      const currentIndex = ((router.history.location.state as unknown as Record<string, unknown>).__TSR_index as number) ?? 0
      const canGoBack = router.history.canGoBack()
      const maxKey = '__app_navigation_max_index__'
      const storedMax = Number(window.sessionStorage.getItem(maxKey) ?? 0)
      const nextMax = Math.max(storedMax, currentIndex)
      if (storedMax !== nextMax) {
        window.sessionStorage.setItem(maxKey, String(nextMax))
      }
      setState((prev) => {
        const canGoForward = currentIndex < nextMax
        if (prev.canGoBack === canGoBack && prev.canGoForward === canGoForward) return prev
        return { canGoBack, canGoForward }
      })
    }
    update()
    return router.history.subscribe(update)
  }, [router])

  return state
}

export function AppHeader({ pageName }: AppHeaderProps) {
  const router = useRouter()
  const { canGoBack, canGoForward } = useHistoryNavigationState()

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

      {/* right side */}
      <div className="flex items-center gap-2 px-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Go back"
          title="Go back"
          disabled={!canGoBack}
          onClick={() => router.history.back()}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Go forward"
          title="Go forward"
          disabled={!canGoForward}
          onClick={() => router.history.forward()}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </header>
  )
}
