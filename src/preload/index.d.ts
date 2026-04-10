import { ElectronAPI } from '@electron-toolkit/preload'
import type { GithubSettings, GithubSnapshot } from '../shared/github'
import type { Todo } from '../shared/todo'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      todos: {
        getSnapshot: () => Todo[]
        subscribe: (listener: (snapshot: Todo[]) => void) => () => void
        refresh: () => Promise<Todo[]>
        add: (text: string) => Promise<void>
        toggle: (id: string) => Promise<void>
        remove: (id: string) => Promise<void>
      }
      github: {
        getSnapshot: () => GithubSnapshot
        subscribe: (listener: (snapshot: GithubSnapshot) => void) => () => void
        refresh: () => Promise<GithubSnapshot>
        updateSettings: (partial: Partial<GithubSettings>) => Promise<GithubSnapshot>
      }
    }
  }
}
