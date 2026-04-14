import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { Markdown } from '@renderer/components/Markdown'
import { Avatar, AvatarFallback } from '@renderer/components/ui/avatar'
import type { GithubPullRequest, GithubPullRequestComment } from '../../../../../shared/github'
import { initials } from './pr-detail-utils'

function CommentCard({ item }: { item: GithubPullRequestComment }) {
  const author = item.authorLogin ?? 'Unknown'
  const createdIso = new Date(item.createdAt).toISOString()
  const relative = formatDistanceToNow(item.createdAt, { addSuffix: true })
  const hasBody = item.body.trim().length > 0

  return (
    <article
      className="overflow-hidden"
      aria-labelledby={`comment-${item.id}-author`}
    >
      <div className="flex gap-3 py-4">
        <Avatar className="mt-0.5 size-9 shrink-0" aria-hidden>
          <AvatarFallback className="text-xs font-medium">{initials(author)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 space-y-1">
              <h3
                id={`comment-${item.id}-author`}
                className="truncate text-sm font-semibold leading-tight text-foreground"
              >
                {author}
              </h3>
              <p className="text-xs leading-snug text-muted-foreground">
                <span className="sr-only">Commented </span>
                <time dateTime={createdIso}>{relative}</time>
              </p>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              aria-label="View comment on GitHub"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="hidden sm:inline">View on GitHub</span>
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </header>

          {hasBody ? (
            <div className="mt-4 p-4 border border-border rounded-lg">
              <Markdown className="text-foreground/90">{item.body}</Markdown>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function CommentsSection({ pr }: { pr: GithubPullRequest }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="size-4 text-muted-foreground" />
        Comments
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
          {pr.commentsCount}
        </span>
      </h2>

      {pr.comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No comments on this pull request yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pr.comments.map((item) => (
            <CommentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
