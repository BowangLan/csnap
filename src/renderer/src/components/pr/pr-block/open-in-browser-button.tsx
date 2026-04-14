import { ExternalLink } from 'lucide-react'

export function OpenInBrowserButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="relative z-10 pointer-events-auto inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Open in browser"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  )
}
