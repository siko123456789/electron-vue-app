import type { BrowserWindow } from 'electron'
import { screen,nativeImage } from 'electron'
import * as path from 'node:path'
import { getAppIconPathForWindow } from '../main'

export type WindowManagerDeps = {
  startedFromAutoStart: boolean
  MAIN_DIST: string
  RENDERER_DIST: string
  VITE_DEV_SERVER_URL?: string
  appRoot: string
  onReadyToShow?: () => void
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

/**
 * 主窗口管理
 * - 负责创建/显示/隐藏主窗口
 * - 负责开发环境打开 devtools、F12 快捷键
 * - 关闭按钮改为“隐藏到托盘”（不退出）
 */
export function createWindowManager(deps: WindowManagerDeps) {
  let win: BrowserWindow | null = null
  let isQuitting = false
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
    win.focus()
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

    // 如果有 winState，使用记忆的位置和大小，否则使用默认值
    const bounds = winState ? {
      x: winState.x,
      y: winState.y,
      width: winState.width,
      height: winState.height,
    } : undefined
    const hasPosition = Number.isInteger(bounds?.x) && Number.isInteger(bounds?.y)

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const minWidth = 800
    const minHeight = 600
    const defaultWidth = Math.max(minWidth, Math.floor(screenWidth * 0.7))
    const defaultHeight = Math.max(minHeight, Math.floor(screenHeight * 0.78))

    // 优先使用记忆中的窗口大小；首次启动时使用一套基础默认尺寸
    const windowWidth = bounds?.width || defaultWidth
    const windowHeight = bounds?.height || defaultHeight

    win = new BrowserWindowCtor({
      x: hasPosition ? bounds?.x : undefined,  // 使用记忆的 X 坐标
      y: hasPosition ? bounds?.y : undefined,  // 使用记忆的 Y 坐标
      width: windowWidth,
      height: windowHeight,
      minWidth,
      minHeight,
      center: !hasPosition,  // 如果有位置参数就不居中，否则居中
      resizable: true,
      autoHideMenuBar: true,
      show: !deps.startedFromAutoStart,
      // Use the same icon resolution logic as tray/icon (works for both dev and packaged builds).
      icon: nativeImage.createFromPath(getAppIconPathForWindow()),
      webPreferences: {
        preload: path.join(deps.MAIN_DIST, 'preload.mjs'),
      }
    })

    // 如果有 winState，让它接管窗口（监听 move 和 resize 事件，自动保存状态）
    // 必须在窗口创建后立即调用，在设置其他事件监听器之前
    if (winState && win) {
      winState.manage(win)
    }

    win.on('close', (event) => {
      if (isQuitting) return
      // 关闭主窗口时，改为托盘常驻（不退出）
      persistWindowState()
      event.preventDefault()
      win?.hide()
    })

    win.on('ready-to-show', () => {
      if (deps.startedFromAutoStart) win?.hide()
      deps.onReadyToShow?.()
    })

    if (deps.VITE_DEV_SERVER_URL) {
      win.loadURL(deps.VITE_DEV_SERVER_URL)
      win.webContents.openDevTools()
    } else {
      win.loadFile(path.join(deps.RENDERER_DIST, 'index.html'))
    }

    win.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12') {
        win?.webContents.toggleDevTools()
      }
    })
  }

  // window-all-closed：托盘常驻策略下不退出，只清引用
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
  }
}
