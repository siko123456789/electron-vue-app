import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import windowStateKeeper from 'electron-window-state'

import { createTrayManager } from './main/tray-manager'
import { createConfigStore } from './main/config'
import { registerHttpRequestIpc } from './main/ipc-http'
import { createWindowManager } from './main/window-manager'
import { createAlertManager } from './main/alert-manager'
import { createTestAlertsRunner } from './main/test-alerts'
import { registerAppIpcHandlers } from './main/app-ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.commandLine.appendSwitch('ignore-certificate-errors')

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const APP_ID = 'com.risk.app'
const startedFromAutoStart = process.argv.includes('--autostart')

let notificationsEnabled = true

const windowManager = createWindowManager({
  startedFromAutoStart,
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL,
  appRoot: String(process.env.APP_ROOT || ''),
  onReadyToShow: () => trayManager.onMainWindowReady(),
})

const SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock()
if (!SINGLE_INSTANCE_LOCK) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = windowManager.getWin()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

function getAppIcon() {
  const ico = path.join(process.env.APP_ROOT!, 'public', 'icon.ico')
  const png = path.join(process.env.APP_ROOT!, 'public', 'lanhu_logo.png')
  const iconPath = process.platform === 'win32' ? ico : png
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? nativeImage.createFromPath(png) : image
}

function showMainWindow() {
  windowManager.showMainWindow()
}

function hideMainWindow() {
  windowManager.hideMainWindow()
}

function toggleMainWindow() {
  windowManager.toggleMainWindow()
}

function openEventsPageFromNotification(payload?: { id?: string }) {
  showMainWindow()
  try {
    windowManager.getWin()?.webContents.send('app/navigate', {
      path: '/events',
      alertId: payload?.id || '',
    })
  } catch {
    // ignore
  }
}

const trayManager = createTrayManager({
  getWin: () => windowManager.getWin(),
  getAppIcon: () => getAppIcon(),
  toggleMainWindow,
  showMainWindow,
  hideMainWindow,
  onAlertClick: (alert) => openEventsPageFromNotification(alert),
  onQuitRequest: () => {
    windowManager.setQuitting(true)
    app.quit()
  },
  onTestAlertsEnabled: (enabled) => testAlerts.setEnabled(enabled),
})

function createTray() {
  trayManager.createTray()
}

function isMainWindowHidden() {
  return trayManager.isMainWindowHidden()
}

export function setUnreadCount(count: number) {
  trayManager.setUnreadCount(count)
}

const alertManager = createAlertManager({
  MAIN_DIST,
  getWin: () => windowManager.getWin(),
  isNotificationsEnabled: () => notificationsEnabled,
  onAppAlertToRenderer: (payload) => {
    try {
      trayManager.recordAlert(payload)
      windowManager.getWin()?.webContents.send('app/alert', payload)
    } catch {
      // ignore
    }
  },
  onBalloonWhenHidden: (payload) => trayManager.maybeShowBalloonWhenHidden(payload),
  onAlertClick: (payload) => openEventsPageFromNotification(payload),
})

const testAlerts = createTestAlertsRunner({
  isMainWindowHidden: () => isMainWindowHidden(),
  showAlert: (payload) => alertManager.showAlert(payload as any, BrowserWindow),
})

export function showAlert(payload?: any) {
  alertManager.showAlert(payload, BrowserWindow)
}

function createWindow() {
  const winState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  })

  console.log('========= 窗口记忆状态 =========')
  console.log('X坐标:', winState.x)
  console.log('Y坐标:', winState.y)
  console.log('宽度:', winState.width)
  console.log('高度:', winState.height)
  console.log('===============================')

  windowManager.createWindow(BrowserWindow, winState)
}

app.on('window-all-closed', () => {
  windowManager.onAllWindowsClosed()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  windowManager.setQuitting(true)
  alertManager.stopAlertBeep()
  testAlerts.stop()
  trayManager.stopTrayBlink()
})

function setTestAlertsEnabled(enabled: boolean) {
  testAlerts.setEnabled(enabled)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    try {
      app.setAppUserModelId(APP_ID)
    } catch {
      // ignore
    }
  }

  const configStore = createConfigStore(path.join(app.getPath('userData'), 'app-config.json'))

  session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))

  createTray()

  configStore.loadAppConfig().then((cfg) => {
    notificationsEnabled = cfg.notificationsEnabled !== false
  })

  registerHttpRequestIpc(ipcMain, session.defaultSession)

  registerAppIpcHandlers({
    ipcMain,
    app,
    shell,
    windowManager,
    trayManager,
    alertManager,
    testAlerts,
    getNotificationsEnabled: () => notificationsEnabled,
    setNotificationsEnabled: async (enabled) => {
      notificationsEnabled = Boolean(enabled)
      await configStore.saveAppConfig({ notificationsEnabled })
      return notificationsEnabled
    },
  })

  createWindow()

  if (process.argv.includes('--test-alerts')) {
    setTestAlertsEnabled(true)
  }
})
