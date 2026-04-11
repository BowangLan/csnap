import { Skeleton } from '@renderer/components/ui/skeleton'

export function PullRequestRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-3 py-2.5 last:border-b-0">
      <Skeleton className="size-8 shrink-0 rounded-md" />

      <div className="min-w-0 flex-1 basis-[min(100%,12rem)] space-y-1.5">
        <Skeleton className="h-4 w-[min(24rem,100%)]" />
        <Skeleton className="h-3 w-48 md:hidden" />
      </div>

      <Skeleton className="hidden h-3 w-40 md:block" />

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
      </div>
    </div>
  )
}
