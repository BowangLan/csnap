import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { TODO_CHANNELS, REPO_STATUS_CHANNELS } from '../shared/ipc/channels'
import {
  type BugStatus,
  type GithubAccount,
  type GithubSettings,
  type MacOsNotificationSound,
  type PrNotificationEvent,
} from '../shared/github'
const GITHUB_CHANNELS = {
  snapshot: 'github:snapshot',
  changed: 'github:changed',
  refresh: 'github:refresh',
  updateSettings: 'github:update-settings',
  setBugStatus: 'github:set-bug-status',
  listAccounts: 'github:list-accounts',
  switchAccount: 'github:switch-account',
  playSound: 'github:play-sound',
  sendTestNotification: 'github:send-test-notification',
  squashMerge: 'github:squash-merge',
  setRepoPath: 'github:set-repo-path',
  checkoutBranch: 'github:checkout-branch',
  pickFolder: 'github:pick-folder',
} as const
const todoListeners = new Set<() => void>()
const repoStatusListeners = new Set<() => void>()
const githubListeners = new Set<() => void>()

const notifyListeners = (listeners: Set<() => void>): void => {
  for (const listener of listeners) {
    listener()
  }
}

ipcRenderer.on(TODO_CHANNELS.changed, () => notifyListeners(todoListeners))
ipcRenderer.on(GITHUB_CHANNELS.changed, () => notifyListeners(githubListeners))
ipcRenderer.on(REPO_STATUS_CHANNELS.changed, () => notifyListeners(repoStatusListeners))

const api = {
  repoStatuses: {
    getSnapshot: () => ipcRenderer.invoke(REPO_STATUS_CHANNELS.snapshot),
    subscribeChanged: (listener: () => void) => {
      repoStatusListeners.add(listener)
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
    getSnapshot: () => ipcRenderer.invoke(TODO_CHANNELS.snapshot),
    subscribeChanged: (listener: () => void) => {
      todoListeners.add(listener)
      return () => {
        todoListeners.delete(listener)
      }
    },
    refresh: () => ipcRenderer.invoke(TODO_CHANNELS.snapshot),
    add: (text: string) => ipcRenderer.invoke(TODO_CHANNELS.add, text),
    toggle: (id: string) => ipcRenderer.invoke(TODO_CHANNELS.toggle, id),
    remove: (id: string) => ipcRenderer.invoke(TODO_CHANNELS.remove, id),
  },
  github: {
    getSnapshot: () => ipcRenderer.invoke(GITHUB_CHANNELS.snapshot),
    subscribeChanged: (listener: () => void) => {
      githubListeners.add(listener)
      return () => {
        githubListeners.delete(listener)
      }
    },
    refresh: () => ipcRenderer.invoke(GITHUB_CHANNELS.refresh),
    updateSettings: (partial: Partial<GithubSettings>) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.updateSettings, partial),
    setBugStatus: (commentId: string, status: BugStatus, manual: boolean) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.setBugStatus, {
        commentId,
        status,
        manual,
      }),
    listAccounts: () =>
      ipcRenderer.invoke(GITHUB_CHANNELS.listAccounts) as Promise<GithubAccount[]>,
    playSound: (soundName: MacOsNotificationSound) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.playSound, soundName) as Promise<void>,
    sendTestNotification: (event: PrNotificationEvent) =>
      ipcRenderer.invoke(GITHUB_CHANNELS.sendTestNotification, event) as Promise<void>,
    switchAccount: (login: string) => ipcRenderer.invoke(GITHUB_CHANNELS.switchAccount, login),
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
