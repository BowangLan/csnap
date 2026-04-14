import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@renderer/lib/utils'

interface MarkdownProps {
  children: string | undefined
  className?: string
}

/**
 * Renders a GitHub-flavored markdown string with consistent prose styling
 * that respects the app's CSS variable-based dark/light theme.
 */
export function Markdown({ children, className }: MarkdownProps) {
  if (!children?.trim()) return null
  return (
    <div className={cn('markdown-body text-sm leading-relaxed text-foreground/90', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 text-lg font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-base font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-3 text-sm font-medium text-foreground first:mt-0">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 leading-relaxed last:mb-0">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                if (href) {
                  e.preventDefault()
                  window.api.shell.openExternal(href)
                }
              }}
              className="cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} className="max-w-full rounded" />
          ),
          ul: ({ children }) => (
            <ul className="mb-2.5 ml-4 list-disc space-y-0.5 [&_ul]:mt-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2.5 ml-4 list-decimal space-y-0.5 [&_ol]:mt-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClass }) => {
            // Inline code (no language class) vs fenced code block
            const isBlock = codeClass?.startsWith('language-')
            if (isBlock) {
              return (
                <code className="block overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground/90">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-2.5 overflow-x-auto rounded-md border border-border/60 bg-muted/60 px-3 py-2.5 font-mono text-xs leading-relaxed">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-4 border-border/60" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="text-muted-foreground line-through">{children}</del>
          ),
          table: ({ children }) => (
            <div className="my-2.5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border/60 bg-muted/40">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">{children}</tbody>
          ),
          tr: ({ children }) => <tr className="hover:bg-muted/30">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-xs text-foreground/90">{children}</td>
          ),
          // Task list checkboxes (GFM)
          input: ({ type, checked, disabled }) => {
            if (type !== 'checkbox') return null
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                readOnly
                className="mr-1.5 size-3.5 cursor-default accent-blue-600 dark:accent-blue-400"
              />
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
