import './assets/base.css'
// import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryInvalidationBridge } from '@renderer/components/query-invalidation-bridge'
import { queryClient } from '@renderer/lib/query-client'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({
  routeTree,
  // Preload PR detail (and other routes) on hover so clicks navigate immediately.
  defaultPreload: 'intent',
})

document.documentElement.classList.add('dark')

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <QueryInvalidationBridge />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
