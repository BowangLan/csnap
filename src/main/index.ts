import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { GithubSyncService } from './github-sync-service'
import { AppDatabase } from './db/client'
import { GithubStoreService } from './db/github-store'
import { TodoStoreService } from './db/todo-store'
import { RepoStatusStore } from './db/repo-status-store'
import { AppLifecycleService } from './app-lifecycle'

const WINDOW_WIDTH = 1200
const WINDOW_HEIGHT = 800
const NAVBAR_HEIGHT = 56

const database = new AppDatabase()
const todoStore = new TodoStoreService(database)
const githubStore = new GithubStoreService(database)
const githubSyncService = new GithubSyncService(githubStore)
const repoStatusStore = new RepoStatusStore()
const lifecycle = new AppLifecycleService(githubSyncService, repoStatusStore)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: {
      x: 16,
      y: NAVBAR_HEIGHT / 2 - 8,
    },
    vibrancy: 'fullscreen-ui',
    backgroundMaterial: 'acrylic',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Attach focus listener here in main — the renderer no longer needs to call
  // window.api.github.refresh() on focus; that is now handled centrally.
  lifecycle.attachWindow(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.csnap.app')
  database.init()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.removeAllListeners('ping')
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('shell:open-external', (_event, url: string) => {
    void shell.openExternal(url)
  })

  // Initialise IPC-backed services before creating the window so the renderer
  // can paint from persisted SQLite state immediately.
  await todoStore.init()
  await githubStore.init()
  await githubSyncService.init()
  await repoStatusStore.init()
  lifecycle.registerIpcHandlers()

  createWindow()

  // Local git status sync can happen after first paint.
  void lifecycle.onAppLoad()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void githubSyncService.shutdown()
  void githubStore.shutdown()
  void todoStore.shutdown()
  void repoStatusStore.shutdown()
  lifecycle.unregisterIpcHandlers()
  database.shutdown()
})
