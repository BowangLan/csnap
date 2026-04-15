import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  BugStatus,
  GithubAccount,
  GithubSettings,
  GithubSnapshot,
  LocalRepoGitStatus,
  MacOsNotificationSound,
  PrNotificationEvent,
} from '../shared/github'
import type { Todo } from '../shared/todo'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      repoStatuses: {
        getSnapshot: () => Promise<Record<string, LocalRepoGitStatus>>
        subscribeChanged: (listener: () => void) => () => void
        syncAll: () => Promise<void>
      }
      shell: {
        openExternal: (url: string) => void
      }
      todos: {
        getSnapshot: () => Promise<Todo[]>
        subscribeChanged: (listener: () => void) => () => void
        refresh: () => Promise<Todo[]>
        add: (text: string) => Promise<void>
        toggle: (id: string) => Promise<void>
        remove: (id: string) => Promise<void>
      }
      github: {
        getSnapshot: () => Promise<GithubSnapshot>
        subscribeChanged: (listener: () => void) => () => void
        refresh: () => Promise<GithubSnapshot>
        updateSettings: (partial: Partial<GithubSettings>) => Promise<GithubSnapshot>
        setBugStatus: (
          commentId: string,
          status: BugStatus,
          manual: boolean,
        ) => Promise<GithubSnapshot>
        listAccounts: () => Promise<GithubAccount[]>
        playSound: (soundName: MacOsNotificationSound) => Promise<void>
        sendTestNotification: (event: PrNotificationEvent) => Promise<void>
        switchAccount: (login: string) => Promise<GithubSnapshot>
        squashAndMerge: (prUrl: string) => Promise<void>
        setRepoPath: (nameWithOwner: string, localPath: string) => Promise<void>
        checkoutBranch: (nameWithOwner: string, branch: string) => Promise<void>
        pickFolder: () => Promise<string | null>
      }
    }
  }
}
