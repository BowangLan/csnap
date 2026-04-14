import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, Copy, ExternalLink, GitCommit } from 'lucide-react'
import { toast } from 'sonner'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import { List, ListItem } from '@renderer/components/ui/list'
import type { GithubPullRequest, GithubPullRequestCommit } from '../../../../../shared/github'

function CommitCard({ item }: { item: GithubPullRequestCommit }) {
  const shortOid = item.oid.slice(0, 7)
  const time = item.authoredAt ? formatDistanceToNow(item.authoredAt, { addSuffix: true }) : 'Unknown time'

  function handleCopyHash(e: React.MouseEvent) {
    e.stopPropagation()
    void navigator.clipboard.writeText(item.oid).then(() => {
      toast.success('Commit hash copied')
    })
  }

  return (
    <ListItem className="items-start">
      <div className="flex-none pt-0.5">
        <GitCommit className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          {item.messageHeadline.trim() ? (
            <p className="text-sm leading-snug text-foreground/90">{item.messageHeadline}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">(No message)</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{time}</span>
          <button
            type="button"
            onClick={handleCopyHash}
            className="inline-flex items-center gap-1 rounded bg-muted/80 px-1 py-px font-mono tabular-nums transition-colors hover:bg-muted hover:text-foreground"
            title="Copy full commit hash"
          >
            {shortOid}
            <Copy className="size-3 shrink-0 opacity-50" />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Open commit on GitHub"
          >
            <ExternalLink className="size-3 opacity-60" />
          </a>
        </div>
      </div>
    </ListItem>
  )
}

export function CommitsSection({ pr }: { pr: GithubPullRequest }) {
  return (
    <Collapsible defaultOpen className="group/commits rounded-xl border border-border/80 bg-card/40">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
        <span className="flex items-center gap-2">
          <GitCommit className="size-4 text-muted-foreground" />
          Commits
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
            {pr.commitsCount}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/commits:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/60 px-3 py-3">
          {pr.commits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              {pr.commitsCount === 0 ? 'No commits on this branch yet.' : 'No commit details loaded.'}
            </p>
          ) : (
            <List>
              {pr.commits.map((item) => (
                <CommitCard key={item.oid} item={item} />
              ))}
            </List>
          )}
          {pr.commitsCount > pr.commits.length ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Showing the {pr.commits.length} most recent commits. Open on GitHub for full history.
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
