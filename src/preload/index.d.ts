import { ElectronAPI } from '@electron-toolkit/preload'
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
    }
  }
}
