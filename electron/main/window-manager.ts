import type { BrowserWindow } from 'electron'
import { screen, nativeImage } from 'electron'
import * as path from 'node:path'
import { getAppIconPathForWindow } from '../main'

/**
 * 无边框窗口：Topbar 拖动移动，双击放大/还原（无自绘窗口按钮）
 * 改 false 可恢复系统默认标题栏
 */
const USE_FRAMELESS_WINDOW = true

export type WindowManagerDeps = {
  startedFromAutoStart: boolean
  MAIN_DIST: string
  RENDERER_DIST: string
  VITE_DEV_SERVER_URL?: string
  appRoot: string
  onReadyToShow?: () => void
  onMainWindowShown?: () => void
}

// 窗口状态管理器类型（从 electron-window-state 导入）
export type WindowState = {
  x?: number
  y?: number
  width: number
  height: number
  saveState: (win: BrowserWindow) => void
  manage: (win: BrowserWindow) => void
}

function useFramelessWindow() {
  return USE_FRAMELESS_WINDOW && process.platform === 'win32'
}

/**
 * 主窗口管理
 * - 负责创建/显示/隐藏主窗口
 * - 负责开发环境打开 devtools、F12 快捷键
 * - 关闭按钮改为“隐藏到托盘”（不退出）
 */
export function createWindowManager(deps: WindowManagerDeps) {
  let win: BrowserWindow | null = null
  let isQuitting = false
  let pinnedOnTop = false
  let currentWindowState: WindowState | undefined

  function persistWindowState() {
    if (!win || !currentWindowState) return
    try {
      currentWindowState.saveState(win)
    } catch {
      // ignore
    }
  }

  function getWin() {
    return win
  }

  function setQuitting(value: boolean) {
    isQuitting = value
  }

  function showMainWindow() {
    if (!win) return
    win.show()
    if (pinnedOnTop) {
      applyAlwaysOnTop(true)
    }
    win.focus()
    try {
      deps.onMainWindowShown?.()
    } catch {
      // ignore
    }
  }

  function hideMainWindow() {
    if (!win) return
    persistWindowState()
    win.hide()
  }

  function toggleMainWindow() {
    if (!win) return
    if (win.isVisible()) hideMainWindow()
    else showMainWindow()
  }

  function minimizeWindow() {
    win?.minimize()
  }

  function toggleMaximizeWindow() {
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  }

  function isWindowMaximized() {
    return win?.isMaximized() ?? false
  }

  function closeWindowFromChrome() {
    win?.close()
  }

  function applyAlwaysOnTop(enabled: boolean) {
    if (!win) return false

    const on = Boolean(enabled)

    if (!on) {
      win.setAlwaysOnTop(false)
      pinnedOnTop = false
      return win.isAlwaysOnTop()
    }

    if (process.platform === 'win32') {
      const levels = ['screen-saver', 'pop-up-menu', 'floating'] as const
      for (const level of levels) {
        try {
          win.setAlwaysOnTop(true, level)
          break
        } catch {
          // try next level
        }
      }
    } else {
      win.setAlwaysOnTop(true)
    }

    if (win.isVisible()) {
      win.show()
      win.moveTop()
      win.focus()
    }

    pinnedOnTop = win.isAlwaysOnTop()
    return pinnedOnTop
  }

  function toggleAlwaysOnTop() {
    if (!win) return false
    return applyAlwaysOnTop(!win.isAlwaysOnTop())
  }

  function isAlwaysOnTop() {
    return win?.isAlwaysOnTop() ?? false
  }

  function notifyMaximizeChanged() {
    win?.webContents.send('window/maximize-changed', win.isMaximized())
  }

  /**
   * 创建主窗口
   * @param BrowserWindowCtor BrowserWindow 构造函数
   * @param winState 窗口状态管理器（用于记忆窗口位置和大小）
   */
  function createWindow(
    BrowserWindowCtor: typeof BrowserWindow,
    winState?: WindowState
  ) {
    currentWindowState = winState

    const bounds = winState ? {
      x: winState.x,
      y: winState.y,
      width: winState.width,
      height: winState.height,
    } : undefined
    const hasPosition = Number.isInteger(bounds?.x) && Number.isInteger(bounds?.y)

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const minWidth = 1000
    const minHeight = 800
    const defaultWidth = Math.max(minWidth, Math.floor(screenWidth * 0.7))
    const defaultHeight = Math.max(minHeight, Math.floor(screenHeight * 0.78))

    const windowWidth = bounds?.width || defaultWidth
    const windowHeight = bounds?.height || defaultHeight

    win = new BrowserWindowCtor({
      x: hasPosition ? bounds?.x : undefined,
      y: hasPosition ? bounds?.y : undefined,
      width: windowWidth,
      height: windowHeight,
      minWidth,
      minHeight,
      center: !hasPosition,
      resizable: true,
      autoHideMenuBar: true,
      show: !deps.startedFromAutoStart,
      title: '',
      ...(useFramelessWindow() ? { frame: false } : {}),
      icon: nativeImage.createFromPath(getAppIconPathForWindow()),
      webPreferences: {
        preload: path.join(deps.MAIN_DIST, 'preload.mjs'),
      }
    })

    win.on('page-title-updated', (event) => {
      event.preventDefault()
      win?.setTitle('')
    })

    if (winState && win) {
      winState.manage(win)
    }

    win.on('close', (event) => {
      if (isQuitting) return
      persistWindowState()
      event.preventDefault()
      win?.hide()
    })

    win.on('maximize', notifyMaximizeChanged)
    win.on('unmaximize', notifyMaximizeChanged)

    win.on('ready-to-show', () => {
      if (deps.startedFromAutoStart) win?.hide()
      deps.onReadyToShow?.()
    })

    if (deps.VITE_DEV_SERVER_URL) {
      win.loadURL(deps.VITE_DEV_SERVER_URL)
    } else {
      win.loadFile(path.join(deps.RENDERER_DIST, 'index.html'))
    }

    win.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12') {
        win?.webContents.toggleDevTools()
      }
    })
  }

  function onAllWindowsClosed() {
    currentWindowState = undefined
    win = null
  }

  return {
    getWin,
    setQuitting,
    showMainWindow,
    hideMainWindow,
    toggleMainWindow,
    createWindow,
    onAllWindowsClosed,
    minimizeWindow,
    toggleMaximizeWindow,
    isWindowMaximized,
    closeWindowFromChrome,
    useFramelessWindow,
    toggleAlwaysOnTop,
    isAlwaysOnTop,
  }
}
