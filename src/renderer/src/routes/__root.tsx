import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Navbar from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'

const RootLayout = () => (
  <div className="flex flex-col items-stretch bg-blue-500/20 rounded-lg overflow-hidden">
    <Navbar />
    <div className="flex flex-row items-stretch min-h-0 flex-1 pb-2 gap-2 px-2">
      <Sidebar />
      <Outlet />
    </div>
    <TanStackRouterDevtools />
  </div>
)

export const Route = createRootRoute({ component: RootLayout })
