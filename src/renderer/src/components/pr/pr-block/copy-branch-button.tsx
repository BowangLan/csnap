import { Copy, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

export function CopyBranchButton({ branchName }: { branchName: string }) {
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    void navigator.clipboard.writeText(branchName).then(() => {
      toast.success('Branch name copied')
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="relative z-10 pointer-events-auto inline-flex max-w-fit items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`Copy branch name: ${branchName}`}
    >
      <GitBranch className="h-3 w-3 shrink-0" />
      <span className="truncate">{branchName}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity hover:opacity-70" />
    </button>
  )
}
