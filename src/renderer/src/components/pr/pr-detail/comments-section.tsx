import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, MapPin, MessageSquare, Wrench } from 'lucide-react'
import { Icons } from '@renderer/components/icons'
import { Markdown } from '@renderer/components/Markdown'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { useGithubSnapshot } from '@renderer/hooks/use-github-snapshot'
import type {
  GithubPullRequest,
  GithubPullRequestComment,
  PrBug,
} from '../../../../../shared/github'
import { initials } from './pr-detail-utils'

const SEVERITY_STYLES = {
  LOW:      { badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',   bar: 'bg-blue-500' },
  MEDIUM:   { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400', bar: 'bg-amber-500' },
  HIGH:     { badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400', bar: 'bg-orange-500' },
  CRITICAL: { badge: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',       bar: 'bg-red-500' },
  UNKNOWN:  { badge: 'bg-muted text-muted-foreground border-border',                          bar: 'bg-muted-foreground' },
} satisfies Record<PrBug['severity'], { badge: string; bar: string }>

function BugCallout({ bug }: { bug: PrBug }) {
  const styles = SEVERITY_STYLES[bug.severity]
  const resolved = bug.status === 'resolved'
  const shellClass = resolved
    ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-900/90 dark:text-emerald-100/90'
    : styles.badge

  return (
    <div className={`mt-3 rounded-lg border text-xs ${shellClass} overflow-hidden`}>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <Icons.Bug className="mt-px size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{resolved ? 'Bug resolved' : 'Bug detected'}</span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none ${styles.badge}`}>
              {bug.severity}
            </span>
            {bug.referenceId && (
              <span className="text-[10px] opacity-60">ref {bug.referenceId}</span>
            )}
          </div>

          <p
            className={`leading-snug opacity-90 ${resolved ? 'line-through decoration-emerald-700/40 dark:decoration-emerald-300/40' : ''}`}
          >
            {bug.title}
          </p>

          {bug.suggestedFix && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium opacity-75 hover:opacity-100">
                <Wrench className="size-3" aria-hidden />
                Suggested fix
              </summary>
              <p className="mt-1 pl-4 leading-relaxed opacity-80 whitespace-pre-wrap">{bug.suggestedFix}</p>
            </details>
          )}

          {bug.affectedLocations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <MapPin className="size-3 opacity-60" aria-hidden />
              {bug.affectedLocations.map((loc) => (
                <code key={loc} className="rounded bg-black/5 dark:bg-white/10 px-1 py-px font-mono text-[10px]">
                  {loc}
                </code>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentCard({ item, bug }: { item: GithubPullRequestComment; bug?: PrBug }) {
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
          {item.authorAvatarUrl ? (
            <AvatarImage src={item.authorAvatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback className="text-xs font-medium">{initials(author)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 space-y-1">
              {item.diffPath ? (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">Review on </span>
                  <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">
                    {item.diffPath}
                  </code>
                </p>
              ) : null}
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
            <div className="flex shrink-0 items-center gap-2">
              {bug && (
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    bug.status === 'resolved'
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : SEVERITY_STYLES[bug.severity].badge
                  }`}
                  title={
                    bug.statusIsManual
                      ? `Pinned status — ${bug.status} (${bug.severity})`
                      : bug.status === 'resolved'
                        ? `Resolved — was ${bug.severity}`
                        : `Bug detected — ${bug.severity} severity`
                  }
                >
                  <Icons.Bug className="size-2.5" aria-hidden />
                  {bug.status === 'resolved' ? 'Resolved' : 'Bug'}
                </span>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label="View comment on GitHub"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="hidden sm:inline">View on GitHub</span>
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </header>

          {hasBody ? (
            <div className="mt-4 p-4 border border-border rounded-lg">
              <Markdown className="text-foreground/90">{item.body}</Markdown>
            </div>
          ) : null}

          {bug && <BugCallout bug={bug} />}
        </div>
      </div>
    </article>
  )
}

export function CommentsSection({ pr }: { pr: GithubPullRequest }) {
  const snapshot = useGithubSnapshot()

  const bugsByCommentId = useMemo(
    () => new Map(snapshot.bugs.filter((b) => b.prId === pr.id).map((b) => [b.commentId, b])),
    [snapshot.bugs, pr.id],
  )

  const bugCount = bugsByCommentId.size

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="size-4 text-muted-foreground" />
        Comments
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
          {pr.comments.length}
        </span>
        {bugCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
            <Icons.Bug className="size-2.5" aria-hidden />
            {bugCount} bug{bugCount > 1 ? 's' : ''}
          </span>
        )}
      </h2>

      {pr.comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No comments on this pull request yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pr.comments.map((item) => (
            <CommentCard key={item.id} item={item} bug={bugsByCommentId.get(item.id)} />
          ))}
        </div>
      )}
    </section>
  )
}
