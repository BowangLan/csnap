import { GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@renderer/lib/utils'

export function CheckoutBranchButton({
  nameWithOwner,
  branch,
  hasLocalPath,
  isActive,
}: {
  nameWithOwner: string
  branch: string
  hasLocalPath: boolean
  isActive: boolean
}) {
  async function handleCheckout(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await window.api.github.checkoutBranch(nameWithOwner, branch)
      toast.success(`Checked out ${branch}`)
      void window.api.repoStatuses.syncAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={!hasLocalPath}
      className={cn(
        'relative z-10 pointer-events-auto inline-flex items-center justify-center rounded p-1 transition-colors',
        'disabled:pointer-events-none disabled:opacity-30',
        isActive
          ? 'text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      title={
        isActive
          ? `On this branch: ${branch}`
          : hasLocalPath
            ? `Checkout branch: ${branch}`
            : `No local path configured for ${nameWithOwner} — set one in Settings`
      }
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
