import type { App, IpcMain } from 'electron'
import { BrowserWindow, dialog, session } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Logger, LogLevel } from './logger'

export type AppIpcDeps = {
  ipcMain: IpcMain
  app: App
  shell: typeof import('electron').shell
  windowManager: {
    showMainWindow: () => void
    hideMainWindow: () => void
    toggleMainWindow: () => void
    setQuitting: (value: boolean) => void
    minimizeWindow: () => void
    toggleMaximizeWindow: () => boolean
    isWindowMaximized: () => boolean
    closeWindowFromChrome: () => void
    useFramelessWindow: () => boolean
    toggleAlwaysOnTop: () => boolean
    isAlwaysOnTop: () => boolean
  }
  trayManager: {
    setUnreadCount: (count: number, opts?: { flash?: boolean }) => void
    removeAlert?: (id: string) => void
    clearAlerts?: () => void
  }
  alertManager: {
    showAlert: (payload?: any, BrowserWindowCtor?: typeof BrowserWindow) => void
    dismissAlert?: (id: string) => { ok: boolean; remaining?: number }
    clearP0Alerts?: () => void
  }
  notifyWs: {
    start: (opts: { url: string; cookie?: string; token?: string }) => {
      ok: boolean
      msg?: string
      skipped?: boolean
    }
    stop: () => { ok: boolean }
    retry: () => { ok: boolean; msg?: string }
    send: (data: string) => { ok: boolean }
    isConnected: () => boolean
  }
  testAlerts: {
    setEnabled: (enabled: boolean) => void
    isEnabled: () => boolean
  }
  getNotificationsEnabled: () => boolean
  setNotificationsEnabled: (enabled: boolean) => Promise<boolean> | boolean
  logger: Logger
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

  ipcMain.handle('app/get-paths', () => ({
    userData: app.getPath('userData'),
    logsDir: deps.logger.getLogDir(),
  }))

  ipcMain.handle('app/get-version', () => ({
    version: app.getVersion(),
    name: app.getName(),
  }))

  /**
   * 导出本地运行诊断日志：汇总 logs 目录下的日志到单个文件，弹出另存为
   */
  ipcMain.handle('app/export-diagnostic-logs', async (event) => {
    const logDir = deps.logger.getLogDir()
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const defaultName = `sentinel-diagnostic-${stamp}.log`

    const win = BrowserWindow.fromWebContents(event.sender)
    const save = await dialog.showSaveDialog(win ?? undefined, {
      title: '导出本地运行诊断日志',
      defaultPath: path.join(app.getPath('downloads'), defaultName),
      filters: [
        { name: 'Log', extensions: ['log', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true }
    }

    const header = [
      '========== 风险治理桌面端 · 本地运行诊断日志 ==========',
      `导出时间: ${now.toISOString()}`,
      `应用版本: ${app.getVersion()}`,
      `应用名称: ${app.getName()}`,
      `日志目录: ${logDir}`,
      `平台: ${process.platform} ${process.arch}`,
      '======================================================',
      '',
    ].join('\n')

    const chunks: string[] = [header]
    let fileCount = 0

    try {
      const entries = await fs.readdir(logDir, { withFileTypes: true })
      const logFiles = entries
        .filter((e) => e.isFile() && /^app-\d{4}-\d{2}-\d{2}\.log$/i.test(e.name))
        .map((e) => e.name)
        .sort()

      if (logFiles.length === 0) {
        chunks.push('(当前日志目录暂无 app-YYYY-MM-DD.log 文件)\n')
      } else {
        for (const name of logFiles) {
          const fullPath = path.join(logDir, name)
          try {
            const content = await fs.readFile(fullPath, 'utf8')
            chunks.push(`\n----- ${name} -----\n`)
            chunks.push(content.endsWith('\n') ? content : `${content}\n`)
            fileCount += 1
          } catch {
            chunks.push(`\n----- ${name} -----\n(读取失败)\n`)
          }
        }
      }
    } catch {
      chunks.push('(无法读取日志目录)\n')
    }

    try {
      await fs.writeFile(save.filePath, chunks.join(''), 'utf8')
      return { ok: true, canceled: false, filePath: save.filePath, fileCount }
    } catch (error) {
      return {
        ok: false,
        canceled: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('app/log', (_event, payload: { level?: LogLevel; message?: string; meta?: Record<string, unknown> }) => {
    const level = payload?.level ?? 'INFO'
    const message = String(payload?.message ?? '')
    if (!message) return
    deps.logger.log(level, message, payload?.meta)
  })
  ipcMain.handle('app/open-user-data', async () => {
    const p = app.getPath('userData')
    return await shell.openPath(p)
  })

  /**
   * 按保留天数清理 logs 目录下过期日志（app-YYYY-MM-DD.log）
   * 当天日志保留
   */
  ipcMain.handle('app/cleanup-logs', async (_event, retentionDays) => {
    const days = Number(retentionDays)
    const keepDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 30
    const logDir = deps.logger.getLogDir()
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
    const todayName = (() => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `app-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.log`
    })()

    let removed = 0
    let kept = 0
    let freedBytes = 0

    try {
      const entries = await fs.readdir(logDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const name = entry.name
        if (!/^app-\d{4}-\d{2}-\d{2}\.log$/i.test(name)) {
          kept += 1
          continue
        }
        if (name === todayName) {
          kept += 1
          continue
        }
        const match = name.match(/^app-(\d{4})-(\d{2})-(\d{2})\.log$/i)
        if (!match) {
          kept += 1
          continue
        }
        const fileTime = new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
        ).getTime()
        const fullPath = path.join(logDir, name)
        if (!Number.isFinite(fileTime) || fileTime >= cutoff) {
          kept += 1
          continue
        }
        try {
          const stat = await fs.stat(fullPath)
          await fs.unlink(fullPath)
          removed += 1
          freedBytes += Number(stat.size) || 0
        } catch {
          kept += 1
        }
      }
    } catch {
      // 目录不存在等
    }

    return { removed, kept, freedBytes, retentionDays: keepDays }
  })

  /** 清理 Chromium 引擎磁盘缓存（可重建，不影响登录配置） */
  ipcMain.handle('app/clear-engine-cache', async () => {
    try {
      const ses = session.defaultSession
      await ses.clearCache()
      const clearCode = (ses as { clearCodeCaches?: (opts: { urls: string[] }) => Promise<void> })
        .clearCodeCaches
      if (typeof clearCode === 'function') {
        await clearCode.call(ses, { urls: [] })
      }
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
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

  ipcMain.handle('app/alert-dismiss', (_event, id) => {
    const alertId = String(id || '')
    const result = deps.alertManager.dismissAlert?.(alertId) || { ok: false }
    deps.trayManager.removeAlert?.(alertId)
    return result
  })

  ipcMain.handle('app/alert-clear-p0', () => {
    deps.alertManager.clearP0Alerts?.()
    deps.trayManager.clearAlerts?.()
    return { ok: true }
  })

  /** 登录态失效：窗口可见时直接进入登录页，隐藏时显示持久通知。 */
  ipcMain.handle('app/auth-expired', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const visible = Boolean(win && !win.isDestroyed() && win.isVisible() && !win.isMinimized())
    if (visible) {
      win?.webContents.send('app/navigate', { path: '/login' })
      return { ok: true, notified: false }
    }

    deps.alertManager.showAlert({
      id: 'auth-expired',
      title: '登录已失效',
      message: '请重新登录以继续接收风险通知',
      variant: 'risk',
      priority: 0,
      sound: false,
      autoDismissSeconds: 0,
    }, BrowserWindow)
    return { ok: true, notified: true }
  })

  ipcMain.handle('app/auth-expired-clear', () => {
    deps.alertManager.dismissAlert?.('auth-expired')
    deps.trayManager.removeAlert?.('auth-expired')
    return { ok: true }
  })

  ipcMain.handle('app/set-unread-count', (_event, payload) => {
    if (payload && typeof payload === 'object') {
      const count = Number((payload as any).count || 0)
      const flash = Boolean((payload as any).flash)
      deps.trayManager.setUnreadCount(count, { flash })
      return
    }
    deps.trayManager.setUnreadCount(Number(payload || 0))
  })

  ipcMain.handle('app/notify-ws/start', (_event, opts) => {
    return deps.notifyWs.start(opts || {})
  })

  ipcMain.handle('app/notify-ws/stop', () => {
    return deps.notifyWs.stop()
  })

  ipcMain.handle('app/notify-ws/status', () => {
    return { connected: deps.notifyWs.isConnected() }
  })

  ipcMain.handle('app/notify-ws/retry', () => {
    return deps.notifyWs.retry()
  })

  ipcMain.on('notify-ws/send', (_event, data) => {
    deps.notifyWs.send(String(data ?? ''))
  })

  ipcMain.handle('app/use-frameless-window', () => deps.windowManager.useFramelessWindow())

  ipcMain.handle('window/minimize', () => {
    deps.windowManager.minimizeWindow()
  })

  ipcMain.handle('window/maximize-toggle', () => deps.windowManager.toggleMaximizeWindow())

  ipcMain.handle('window/is-maximized', () => deps.windowManager.isWindowMaximized())

  ipcMain.handle('window/close', () => {
    deps.windowManager.closeWindowFromChrome()
  })

  ipcMain.handle('window/always-on-top-toggle', () => deps.windowManager.toggleAlwaysOnTop())

  ipcMain.handle('window/is-always-on-top', () => deps.windowManager.isAlwaysOnTop())
}
