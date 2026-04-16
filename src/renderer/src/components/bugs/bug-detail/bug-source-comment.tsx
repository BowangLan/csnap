import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Markdown } from '@renderer/components/Markdown'
import type { GithubPullRequest, PrBug } from '../../../../../shared/github'

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export function BugSourceComment({
  bug,
  pr,
}: {
  bug: PrBug
  pr: GithubPullRequest | undefined
}) {
  const comment = pr?.comments.find((c) => c.id === bug.commentId)

  if (!comment) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare className="size-4 text-muted-foreground" />
          Source Comment
        </h2>
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          The original comment that detected this bug is not available.
        </p>
      </section>
    )
  }

  const author = comment.authorLogin ?? 'Unknown'
  const createdIso = new Date(comment.createdAt).toISOString()
  const relative = formatDistanceToNow(comment.createdAt, { addSuffix: true })
  const hasBody = comment.body.trim().length > 0

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="size-4 text-muted-foreground" />
        Source Comment
      </h2>

      <article className="rounded-xl border border-border/80 bg-card/40 overflow-hidden">
        <div className="flex gap-3 px-4 py-4">
          <Avatar className="mt-0.5 size-9 shrink-0" aria-hidden>
            {comment.authorAvatarUrl ? (
              <AvatarImage src={comment.authorAvatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="text-xs font-medium">{initials(author)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 space-y-1">
                {comment.diffPath && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">Review on </span>
                    <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">
                      {comment.diffPath}
                    </code>
                  </p>
                )}
                <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {author}
                </h3>
                <p className="text-xs leading-snug text-muted-foreground">
                  <time dateTime={createdIso}>{relative}</time>
                </p>
              </div>
              <a
                href={comment.url}
                target="_blank"
                rel="noreferrer"
                aria-label="View comment on GitHub"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <span className="hidden sm:inline">View on GitHub</span>
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </header>

            {hasBody && (
              <div className="mt-4 rounded-lg border border-border p-4">
                <Markdown className="text-foreground/90">{comment.body}</Markdown>
              </div>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}
