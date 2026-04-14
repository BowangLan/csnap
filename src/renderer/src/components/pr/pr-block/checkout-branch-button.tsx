import { GitBranch } from 'lucide-react'
import { toast } from 'sonner'

export function CheckoutBranchButton({
  nameWithOwner,
  branch,
  hasLocalPath,
}: {
  nameWithOwner: string
  branch: string
  hasLocalPath: boolean
}) {
  async function handleCheckout(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await window.api.github.checkoutBranch(nameWithOwner, branch)
      toast.success(`Checked out ${branch}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={!hasLocalPath}
      className="relative z-10 pointer-events-auto inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      title={
        hasLocalPath
          ? `Checkout branch: ${branch}`
          : `No local path configured for ${nameWithOwner} — set one in Settings`
      }
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
