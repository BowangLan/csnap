import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { TODO_CHANNELS, REPO_STATUS_CHANNELS } from '../shared/livestore/channels'
import {
  DEFAULT_GITHUB_SETTINGS,
  type GithubAccount,
  type GithubSettings,
  type GithubSnapshot,
  type LocalRepoGitStatus,
  type MacOsNotificationSound,
  type PrNotificationEvent,
} from '../shared/github'
import type { Todo } from '../shared/todo'

let todosSnapshot: Todo[] = []
const todoListeners = new Set<(snapshot: Todo[]) => void>()

let repoStatusSnapshot: Record<string, LocalRepoGitStatus> = {}
const repoStatusListeners = new Set<(snapshot: Record<string, LocalRepoGitStatus>) => void>()
const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  refresh: 'github:refresh',
  updateSettings: 'github:update-settings',
  listAccounts: 'github:list-accounts',
  switchAccount: 'github:switch-account',
  playSound: 'github:play-sound',
  sendTestNotification: 'github:send-test-notification',
  squashMerge: 'github:squash-merge',
  setRepoPath: 'github:set-repo-path',
  checkoutBranch: 'github:checkout-branch',
  pickFolder: 'github:pick-folder',
} as const
let githubSnapshot: GithubSnapshot = {
  auth: {
    isAuthenticated: false,
    activeLogin: null,
  },
  repositories: [],
  pullRequests: [],
  settings: DEFAULT_GITHUB_SETTINGS,
  sync: {
    isRefreshing: false,
    lastRefreshedAt: null,
    lastUpdateDetectedAt: null,
    lastError: null,
  },
  localRepoStatuses: {},
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

const notifyRepoStatusListeners = (next: Record<string, LocalRepoGitStatus>): void => {
  repoStatusSnapshot = next
  for (const listener of repoStatusListeners) {
    listener(repoStatusSnapshot)
  }
}

ipcRenderer.on(TODO_CHANNELS.changed, (_event, nextSnapshot: Todo[]) => {
  notifyTodoListeners(nextSnapshot)
})

ipcRenderer.on(GITHUB_CHANNELS.changed, (_event, nextSnapshot: GithubSnapshot) => {
  setGithubSnapshotDeferred(nextSnapshot)
})

ipcRenderer.on(
  REPO_STATUS_CHANNELS.changed,
  (_event, next: Record<string, LocalRepoGitStatus>) => {
    notifyRepoStatusListeners(next)
  },
)

void refreshTodos()
void ipcRenderer.invoke(GITHUB_CHANNELS.snapshot).then((nextSnapshot) => {
  setGithubSnapshotDeferred(nextSnapshot as GithubSnapshot)
})
void ipcRenderer
  .invoke(REPO_STATUS_CHANNELS.snapshot)
  .then((next) => notifyRepoStatusListeners(next as Record<string, LocalRepoGitStatus>))

const api = {
  repoStatuses: {
    getSnapshot: () => repoStatusSnapshot,
    subscribe: (listener: (snapshot: Record<string, LocalRepoGitStatus>) => void) => {
      repoStatusListeners.add(listener)
      listener(repoStatusSnapshot)
      return () => {
        repoStatusListeners.delete(listener)
      }
    },
    syncAll: (): Promise<void> => ipcRenderer.invoke(REPO_STATUS_CHANNELS.syncAll),
  },
  shell: {
    openExternal: (url: string): void => {
      ipcRenderer.send('shell:open-external', url)
    },
  },
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
    sendTestNotification: (event: PrNotificationEvent) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.sendTestNotification, event) as Promise<void>,
    switchAccount: async (login: string) => {
      const nextSnapshot = (await ipcRenderer.invoke(
        GITHUB_CHANNELS.switchAccount,
        login,
      )) as GithubSnapshot
      setGithubSnapshotDeferred(nextSnapshot)
      return nextSnapshot
    },
    squashAndMerge: (prUrl: string) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.squashMerge, prUrl) as Promise<void>,
    setRepoPath: (nameWithOwner: string, localPath: string) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.setRepoPath, nameWithOwner, localPath) as Promise<void>,
    checkoutBranch: (nameWithOwner: string, branch: string) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.checkoutBranch, nameWithOwner, branch) as Promise<void>,
    pickFolder: () =>
      ipcRenderer.invoke(GITHUB_CHANNELS.pickFolder) as Promise<string | null>,
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
