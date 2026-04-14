import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { TODO_CHANNELS } from '../shared/livestore/channels'
import { type GithubAccount, type GithubSettings, type GithubSnapshot, type MacOsNotificationSound } from '../shared/github'
import type { Todo } from '../shared/todo'

let todosSnapshot: Todo[] = []
const todoListeners = new Set<(snapshot: Todo[]) => void>()
const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  refresh: 'github:refresh',
  updateSettings: 'github:update-settings',
  listAccounts: 'github:list-accounts',
  switchAccount: 'github:switch-account',
  playSound: 'github:play-sound',
} as const
let githubSnapshot: GithubSnapshot = {
  auth: {
    isAuthenticated: false,
    activeLogin: null,
  },
  repositories: [],
  pullRequests: [],
  settings: {
    refreshIntervalSeconds: 60,
    soundOnPrUpdates: true,
    notificationSound: 'Glass' as MacOsNotificationSound,
  },
  sync: {
    isRefreshing: false,
    lastRefreshedAt: null,
    lastUpdateDetectedAt: null,
    lastError: null,
  },
}
const githubListeners = new Set<(snapshot: GithubSnapshot) => void>()

const notifyTodoListeners = (nextSnapshot: Todo[]): void => {
  todosSnapshot = nextSnapshot
  for (const listener of todoListeners) {
    listener(todosSnapshot)
  }
}

const notifyGithubListeners = (): void => {
  for (const listener of githubListeners) {
    listener(githubSnapshot)
  }
}

/** Apply snapshot data immediately; notify React listeners on the next microtask so clicks/navigation win the event loop. */
const setGithubSnapshotDeferred = (nextSnapshot: GithubSnapshot): void => {
  githubSnapshot = nextSnapshot
  queueMicrotask(() => {
    notifyGithubListeners()
  })
}

const refreshTodos = async (): Promise<Todo[]> => {
  const nextSnapshot = await ipcRenderer.invoke(TODO_CHANNELS.snapshot)
  notifyTodoListeners(nextSnapshot as Todo[])
  return todosSnapshot
}

ipcRenderer.on(TODO_CHANNELS.changed, (_event, nextSnapshot: Todo[]) => {
  notifyTodoListeners(nextSnapshot)
})

ipcRenderer.on(GITHUB_CHANNELS.changed, (_event, nextSnapshot: GithubSnapshot) => {
  setGithubSnapshotDeferred(nextSnapshot)
})

void refreshTodos()
void ipcRenderer.invoke(GITHUB_CHANNELS.snapshot).then((nextSnapshot) => {
  setGithubSnapshotDeferred(nextSnapshot as GithubSnapshot)
})

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
  github: {
    getSnapshot: () => githubSnapshot,
    subscribe: (listener: (snapshot: GithubSnapshot) => void) => {
      githubListeners.add(listener)
      listener(githubSnapshot)

      return () => {
        githubListeners.delete(listener)
      }
    },
    refresh: async () => {
      const nextSnapshot = (await ipcRenderer.invoke(GITHUB_CHANNELS.refresh)) as GithubSnapshot
      setGithubSnapshotDeferred(nextSnapshot)
      return nextSnapshot
    },
    updateSettings: async (partial: Partial<GithubSettings>) => {
      const nextSnapshot = (await ipcRenderer.invoke(
        GITHUB_CHANNELS.updateSettings,
        partial,
      )) as GithubSnapshot
      setGithubSnapshotDeferred(nextSnapshot)
      return nextSnapshot
    },
    listAccounts: () =>
      ipcRenderer.invoke(GITHUB_CHANNELS.listAccounts) as Promise<GithubAccount[]>,
    playSound: (soundName: MacOsNotificationSound) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.playSound, soundName) as Promise<void>,
    switchAccount: async (login: string) => {
      const nextSnapshot = (await ipcRenderer.invoke(
        GITHUB_CHANNELS.switchAccount,
        login,
      )) as GithubSnapshot
      setGithubSnapshotDeferred(nextSnapshot)
      return nextSnapshot
    },
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
