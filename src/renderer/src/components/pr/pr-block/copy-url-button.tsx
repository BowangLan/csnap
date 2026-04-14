import { Link } from 'lucide-react'
import { toast } from 'sonner'

export function CopyUrlButton({ url }: { url: string }) {
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    void navigator.clipboard.writeText(url).then(() => {
      toast.success('PR URL copied')
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="relative z-10 pointer-events-auto inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={`Copy PR URL: ${url}`}
    >
      <Link className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
