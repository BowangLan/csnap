import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index
})

function Index() {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div id="main-content" className="rounded-lg bg-white flex-1">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-black mb-2">Welcome Home</h1>
        <p className="text-black">MainContent</p>
      </div>
    </div>
  )
}
