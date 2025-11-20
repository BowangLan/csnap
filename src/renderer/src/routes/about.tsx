import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Versions } from '@renderer/components/Versions'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="p-4 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">About</h1>
      <Card>
        <CardHeader>
          <CardTitle>Application Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This is an Electron desktop application built with React, TypeScript, TailwindCSS, and TanStack Router.
          </p>
          <Versions />
        </CardContent>
      </Card>
    </div>
  )
}
