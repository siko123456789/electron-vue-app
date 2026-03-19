import type { App, IpcMain } from 'electron'
import { BrowserWindow } from 'electron'

export type AppIpcDeps = {
  ipcMain: IpcMain
  app: App
  shell: typeof import('electron').shell
  windowManager: {
    showMainWindow: () => void
    hideMainWindow: () => void
    toggleMainWindow: () => void
    setQuitting: (value: boolean) => void
  }
  trayManager: {
    setUnreadCount: (count: number) => void
  }
  alertManager: {
    showAlert: (payload?: any, BrowserWindowCtor?: typeof BrowserWindow) => void
  }
  testAlerts: {
    setEnabled: (enabled: boolean) => void
    isEnabled: () => boolean
  }
  getNotificationsEnabled: () => boolean
  setNotificationsEnabled: (enabled: boolean) => Promise<boolean> | boolean
}

/**
 * 注册“应用级 IPC”
 *
 * 约定：
 * - 不要在这里直接持有复杂状态，状态放在各个 manager 中
 * - main.ts 负责组装依赖、初始化 lifecycle；这里负责把渲染进程要调用的接口集中管理
 */
export function registerAppIpcHandlers(deps: AppIpcDeps) {
  const { ipcMain, app, shell } = deps

  ipcMain.handle('app/show-main-window', () => deps.windowManager.showMainWindow())
  ipcMain.handle('app/hide-main-window', () => deps.windowManager.hideMainWindow())
  ipcMain.handle('app/toggle-main-window', () => deps.windowManager.toggleMainWindow())

  ipcMain.handle('app/get-paths', () => ({ userData: app.getPath('userData') }))
  ipcMain.handle('app/open-user-data', async () => {
    const p = app.getPath('userData')
    return await shell.openPath(p)
  })

  ipcMain.handle('app/get-auto-launch', () => {
    try {
      return Boolean(app.getLoginItemSettings().openAtLogin)
    } catch {
      return false
    }
  })
  ipcMain.handle('app/set-auto-launch', (_event, enabled) => {
    const on = Boolean(enabled)
    try {
      app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('app/get-notifications-enabled', () => deps.getNotificationsEnabled())
  ipcMain.handle('app/set-notifications-enabled', async (_event, enabled) => {
    return await deps.setNotificationsEnabled(Boolean(enabled))
  })

  ipcMain.handle('app/test-alerts/set-enabled', (_event, enabled) => {
    deps.testAlerts.setEnabled(Boolean(enabled))
    return deps.testAlerts.isEnabled()
  })

  ipcMain.handle('app/quit', () => {
    deps.windowManager.setQuitting(true)
    app.quit()
  })

  ipcMain.handle('app/show-alert', (_event, payload) => {
    deps.alertManager.showAlert(payload, BrowserWindow)
  })

  ipcMain.handle('app/set-unread-count', (_event, count) => {
    deps.trayManager.setUnreadCount(Number(count || 0))
  })
}

