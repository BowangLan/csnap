import { ChevronDown, PenLine, Wand2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { Button } from '@renderer/components/ui/button'
import { Markdown } from '@renderer/components/Markdown'
import type { GithubPullRequest } from '../../../../../shared/github'

export function DescriptionSection({ pr }: { pr: GithubPullRequest }) {
  return (
    <Collapsible defaultOpen className="group/desc rounded-xl border border-border/80 bg-card/40">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        <span>Description</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/desc:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/60 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled>
              <Wand2 className="size-3.5 opacity-60" />
              Generate
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Edit description" disabled>
              <PenLine className="size-4 opacity-50" />
            </Button>
          </div>
          {pr.body?.trim() ? (
            <Markdown className="mt-4">{pr.body}</Markdown>
          ) : (
            <p className="mt-4 text-sm italic text-muted-foreground">No description provided.</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
