import { ElectronAPI } from '@electron-toolkit/preload'

export interface Todo {
  id: number
  text: string
  completed: boolean
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getTodos: () => Promise<Todo[]>
      addTodo: (text: string) => Promise<Todo>
      toggleTodo: (id: number) => Promise<void>
      deleteTodo: (id: number) => Promise<void>
    }
  }
}
