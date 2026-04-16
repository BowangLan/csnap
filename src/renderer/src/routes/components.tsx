import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Heart, Plus, Trash2, Send, Check, X, Loader2, ArrowRight, Star, Download } from 'lucide-react'
import { PillButton } from '@renderer/components/ui/pill-button'
import { Separator } from '@renderer/components/ui/separator'

export const Route = createFileRoute('/components')({
  component: ComponentsPage,
})

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  )
}

function ComponentsPage() {
  const [loading, setLoading] = useState(false)

  const handleLoadingClick = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Component System</h1>
        <p className="text-sm text-muted-foreground">Interactive showcase of UI components.</p>
      </div>

      <Separator />

      {/* PillButton */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">PillButton</h2>
          <p className="text-sm text-muted-foreground">
            A compact button variant with pill-like proportions. Shares the same variant and size API as Button.
          </p>
        </div>

        <Section title="Variants">
          <PillButton variant="default">Default</PillButton>
          <PillButton variant="secondary">Secondary</PillButton>
          <PillButton variant="destructive">Destructive</PillButton>
          <PillButton variant="outline">Outline</PillButton>
          <PillButton variant="ghost">Ghost</PillButton>
          <PillButton variant="link">Link</PillButton>
        </Section>

        <Section title="Sizes" description="default · sm · lg">
          <PillButton size="default">Default</PillButton>
          <PillButton size="sm">Small</PillButton>
          <PillButton size="lg">Large</PillButton>
        </Section>

        <Section title="With Icons">
          <PillButton><Plus /> Create</PillButton>
          <PillButton variant="destructive"><Trash2 /> Delete</PillButton>
          <PillButton variant="outline"><Download /> Export</PillButton>
          <PillButton variant="secondary"><Star /> Favorite</PillButton>
          <PillButton variant="ghost"><Heart /> Like</PillButton>
        </Section>

        <Section title="Icon-only" description="icon · icon-sm · icon-lg">
          <PillButton size="icon-sm" variant="outline" aria-label="Add"><Plus /></PillButton>
          <PillButton size="icon" variant="outline" aria-label="Send"><Send /></PillButton>
          <PillButton size="icon-lg" variant="outline" aria-label="Continue"><ArrowRight /></PillButton>
        </Section>

        <Section title="States">
          <PillButton disabled>Disabled</PillButton>
          <PillButton disabled variant="outline">Disabled Outline</PillButton>
          <PillButton onClick={handleLoadingClick} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Check />}
            {loading ? 'Saving…' : 'Save'}
          </PillButton>
        </Section>

        <Section title="Variant × Size Matrix">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Variant</th>
                  <th className="pb-2 pr-4 text-left font-medium">Default</th>
                  <th className="pb-2 pr-4 text-left font-medium">Small</th>
                  <th className="pb-2 text-left font-medium">Large</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {(['default', 'secondary', 'destructive', 'outline', 'ghost'] as const).map((variant) => (
                  <tr key={variant}>
                    <td className="py-1.5 pr-4 font-mono text-muted-foreground">{variant}</td>
                    <td className="py-1.5 pr-4">
                      <PillButton variant={variant} size="default"><X /> {variant}</PillButton>
                    </td>
                    <td className="py-1.5 pr-4">
                      <PillButton variant={variant} size="sm"><X /> {variant}</PillButton>
                    </td>
                    <td className="py-1.5">
                      <PillButton variant={variant} size="lg"><X /> {variant}</PillButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  )
}
