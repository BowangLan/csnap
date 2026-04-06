import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { TODO_CHANNELS } from '../shared/livestore/channels'
import type { Todo } from '../shared/todo'

let todosSnapshot: Todo[] = []
const todoListeners = new Set<(snapshot: Todo[]) => void>()

const notifyTodoListeners = (nextSnapshot: Todo[]): void => {
  todosSnapshot = nextSnapshot
  for (const listener of todoListeners) {
    listener(todosSnapshot)
  }
}

const refreshTodos = async (): Promise<Todo[]> => {
  const nextSnapshot = await ipcRenderer.invoke(TODO_CHANNELS.snapshot)
  notifyTodoListeners(nextSnapshot as Todo[])
  return todosSnapshot
}

ipcRenderer.on(TODO_CHANNELS.changed, (_event, nextSnapshot: Todo[]) => {
  notifyTodoListeners(nextSnapshot)
})

void refreshTodos()

const api = {
  todos: {
    getSnapshot: () => todosSnapshot,
    subscribe: (listener: (snapshot: Todo[]) => void) => {
      todoListeners.add(listener)
      listener(todosSnapshot)

      return () => {
        todoListeners.delete(listener)
      }
    },
    refresh: refreshTodos,
    add: (text: string) => ipcRenderer.invoke(TODO_CHANNELS.add, text),
    toggle: (id: string) => ipcRenderer.invoke(TODO_CHANNELS.toggle, id),
    remove: (id: string) => ipcRenderer.invoke(TODO_CHANNELS.remove, id),
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
