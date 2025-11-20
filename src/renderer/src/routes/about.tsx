import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div id="main-content" className="rounded-lg bg-white flex-1">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2">About</h1>
        <p>This is an Electron desktop application with TanStack Router.</p>
      </div>
    </div>
  )
}
