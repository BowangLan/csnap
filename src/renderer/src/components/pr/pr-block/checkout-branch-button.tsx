import { GitBranch } from 'lucide-react'
import { toast } from 'sonner'

export function CheckoutBranchButton({
  nameWithOwner,
  branchName,
}: {
  nameWithOwner: string
  branchName: string
}) {
  function handleCheckout(e: React.MouseEvent) {
    e.stopPropagation()
    window.api.github
      .checkoutBranch(nameWithOwner, branchName)
      .then(() => {
        toast.success(`Checked out ${branchName}`)
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to checkout branch.')
      })
  }

  return (
    <button
      onClick={handleCheckout}
      className="relative z-10 pointer-events-auto inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`Checkout ${branchName} locally`}
    >
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
