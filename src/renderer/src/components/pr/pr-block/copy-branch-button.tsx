import React from 'react'
import { Check, Copy, GitBranch } from 'lucide-react'

export function CopyBranchButton({ branchName }: { branchName: string }) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(branchName).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex max-w-fit items-center gap-2 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`Copy branch name: ${branchName}`}
    >
      <GitBranch className="h-3 w-3 shrink-0" />
      <span className="truncate">{branchName}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity hover:opacity-70" />
      )}
    </button>
  )
}
