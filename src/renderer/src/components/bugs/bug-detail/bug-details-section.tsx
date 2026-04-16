import { Copy, MapPin, Wrench, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import type { PrBug } from '../../../../../shared/github'

export function BugDetailsSection({ bug }: { bug: PrBug }) {
  const hasSuggestedFix = !!bug.suggestedFix
  const hasAiPrompt = !!bug.aiPrompt
  const hasLocations = bug.affectedLocations.length > 0

  if (!hasSuggestedFix && !hasAiPrompt && !hasLocations) {
    return null
  }

  return (
    <section className="flex flex-col gap-4">
      {hasSuggestedFix && (
        <div className="rounded-xl border border-border/80 bg-card/40">
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
            <Wrench className="size-4 text-muted-foreground" />
            Suggested Fix
          </div>
          <div className="border-t border-border/60 px-4 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {bug.suggestedFix}
            </p>
          </div>
        </div>
      )}

      {hasAiPrompt && (
        <div className="rounded-xl border border-border/80 bg-card/40">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Wand2 className="size-4 text-muted-foreground" />
              AI Prompt
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(bug.aiPrompt!)
                toast.success('AI prompt copied to clipboard')
              }}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <div className="border-t border-border/60 px-4 py-4">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/60 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground/90">
              {bug.aiPrompt}
            </pre>
          </div>
        </div>
      )}

      {hasLocations && (
        <div className="rounded-xl border border-border/80 bg-card/40">
          <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground" />
            Affected Locations
          </div>
          <div className="border-t border-border/60 px-4 py-4">
            <ul className="space-y-1.5">
              {bug.affectedLocations.map((loc) => (
                <li key={loc} className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/90">
                    {loc}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
