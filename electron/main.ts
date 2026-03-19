/**
 * Electron 主进程入口文件
 *
 * 负责应用的核心功能：
 * - 窗口管理（创建、显示、隐藏、记忆状态）
 * - 系统托盘（右键菜单、悬浮预览、未读数显示）
 * - 通知管理（右上角弹窗、声音提示、托盘气泡）
 * - IPC 通信（渲染进程与主进程之间的消息传递）
 * - 配置管理（通知开关等用户设置）1
 */

import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import windowStateKeeper from 'electron-window-state'

// 导入各个功能模块
import { createTrayManager } from './main/tray-manager'           // 系统托盘管理
import { createConfigStore } from './main/config'                 // 配置存储
import { registerHttpRequestIpc } from './main/ipc-http'           // HTTP 请求 IPC 处理
import { createWindowManager } from './main/window-manager'       // 主窗口管理
import { createAlertManager } from './main/alert-manager'         // 告警通知管理
import { createTestAlertsRunner } from './main/test-alerts'        // 测试告警功能
import { registerAppIpcHandlers } from './main/app-ipc'            // 应用级 IPC 处理器

// ============= 路径配置 =============

/**
 * 获取当前文件的目录路径
 * __dirname 在 ESM 模式下需要手动计算
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 忽略 HTTPS 证书错误
 * 仅用于开发环境和内部自签名证书场景
 * 生产环境应使用正规的 SSL 证书
 */
app.commandLine.appendSwitch('ignore-certificate-errors')

/**
 * 设置环境变量：应用根目录
 * 这个目录用于定位资源文件（图标、配置等）
 */
process.env.APP_ROOT = path.join(__dirname, '..')

/**
 * Vite 开发服务器地址（仅在开发模式下可用）
 * 开发时会设置为 http://localhost:5173
 * 生产模式时为 undefined
 */
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

/**
 * 主进程代码的编译输出目录
 * 包含 main.js、preload.mjs 等文件
 */
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')

/**
 * 渲染进程代码的编译输出目录
 * 包含 index.html、assets、js/css 等前端资源
 */
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

/**
 * 静态资源目录
 * 开发模式：指向 public 目录
 * 生产模式：Vite 会将 public 复制到 dist 目录，所以指向 dist
 */
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// ============= 应用标识 =============

/**
 * Windows 上应用的唯一标识符（AppUserModelId）
 * 用于任务栏图标、跳转列表、通知等功能
 * 格式：反向域名风格
 */
const APP_ID = 'com.risk.app'

/**
 * 检查是否通过开机自启动启动应用
 * 如果启动参数包含 --autostart，说明是开机自启动的
 * 开机自启动时应该隐藏主窗口，只在托盘运行
 */
const startedFromAutoStart = process.argv.includes('--autostart')

// ============= 全局状态 =============

/**
 * 通知开关（全局变量）
 * 控制是否启用通知功能（弹窗、声音、气泡等）
 * 默认为 true（启用）
 * 用户可以在设置中更改，会保存到配置文件
 */
let notificationsEnabled = true

// ============= 创建窗口管理器 =============

/**
 * 创建主窗口管理器
 *
 * windowManager 负责主窗口的创建、显示、隐藏等操作
 * 它会记录窗口的引用，提供统一的窗口控制接口
 */
const windowManager = createWindowManager({
  startedFromAutoStart,        // 告诉窗口管理器是否是开机自启动
  MAIN_DIST,                   // 主进程编译目录（用于找 preload 脚本）
  RENDERER_DIST,               // 渲染进程编译目录（用于找 index.html）
  VITE_DEV_SERVER_URL,         // 开发服务器地址（开发时用）
  appRoot: String(process.env.APP_ROOT || ''),  // 项目根目录（用于找图标等资源）
  onReadyToShow: () => trayManager.onMainWindowReady(),  // 窗口准备好时的回调（通知托盘管理器）
})

// ============= 单实例锁（防止应用重复启动） =============

/**
 * 单实例锁
 *
 * 类似微信、QQ：用户只能打开一个应用实例
 * 如果用户双击第二次应用图标，会把已经打开的窗口显示出来
 * 而不是启动第二个应用实例
 */
const SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock()

if (!SINGLE_INSTANCE_LOCK) {
  /**
   * 如果已经有应用在运行，退出当前实例
   * 因为另一个实例已经获得了锁
   */
  app.quit()
} else {
  /**
   * 当用户尝试打开第二个实例时触发
   * 例如：用户双击两次桌面图标，第二次会触发这个事件
   * 此时应该显示已经存在的窗口
   */
  app.on('second-instance', () => {
    const win = windowManager.getWin()
    if (!win) return
    if (win.isMinimized()) win.restore()  // 如果窗口最小化了，恢复它
    win.show()                          // 显示窗口
    win.focus()                         // 聚焦窗口（让窗口获得输入焦点）
  })
}

// ============= 图标路径查找 =============

/**
 * 获取资源文件的可能路径列表
 *
 * 由于开发和生产环境的文件结构不同，需要查找多个可能的位置
 * 返回的路径列表按优先级排序
 *
 * @param filename 资源文件名（如 icon.ico）
 * @returns 可能的文件路径列表
 */
function getCandidateAssetPaths(filename: string) {
  const candidates: string[] = []
  const vitePublic = String(process.env.VITE_PUBLIC || '').trim()
  const appRoot = String(process.env.APP_ROOT || '').trim()

  // 开发环境：VITE_PUBLIC -> <root>/public
  // 生产环境：VITE_PUBLIC -> <root>/dist（Vite 会将 public 复制到 dist 目录）
  if (vitePublic) candidates.push(path.join(vitePublic, filename))

  // 备选路径：传统的 public 目录位置
  if (appRoot) candidates.push(path.join(appRoot, 'public', filename))

  // 去重并返回
  return Array.from(new Set(candidates))
}

/**
 * 获取应用图标文件的实际路径
 *
 * Windows 使用 .ico 格式，其他平台使用 .png 格式
 * 会在多个可能的位置查找文件，找到可用的就返回
 *
 * @returns 图标文件的完整路径
 */
export function getAppIconPathForWindow(): string {
  const isWin = process.platform === 'win32'
  const primary = isWin ? 'icon.ico' : 'lanhu_logo.ico'  // 首选图标
  const fallback = 'icon.ico'                      // 备选图标

  // 依次尝试查找主图标和备选图标
  for (const file of [primary, fallback]) {
    for (const p of getCandidateAssetPaths(file)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return p  // 找到可用的图标文件
    }
  }

  // 最后的备选方案：返回最可能的路径（即使文件不存在，也有助于调试）
  const root = String(process.env.VITE_PUBLIC || process.env.APP_ROOT || '')
  return root ? path.join(root, primary) : primary
}

/**
 * 获取应用图标（NativeImage 对象）
 *
 * 用于托盘图标、窗口图标等
 *
 * @returns Electron NativeImage 对象
 */
function getAppIcon() {
  const iconPath = getAppIconPathForWindow()
  const img = nativeImage.createFromPath(iconPath)
  if (!img.isEmpty()) return img

  // 如果主图标加载失败，尝试加载备选图标
  const fallbackPath = getCandidateAssetPaths('lanhu_logo.png')[0]
  return fallbackPath ? nativeImage.createFromPath(fallbackPath) : img
}

// ============= 窗口控制函数（简化版，方便调用） =============

/**
 * 显示主窗口
 * 调用 windowManager 的 showMainWindow 方法
 */
function showMainWindow() {
  windowManager.showMainWindow()
}

/**
 * 隐藏主窗口（最小化到托盘）
 * 调用 windowManager 的 hideMainWindow 方法
 */
function hideMainWindow() {
  windowManager.hideMainWindow()
}

/**
 * 切换主窗口的显示/隐藏状态
 * 如果窗口可见则隐藏，隐藏则显示
 */
function toggleMainWindow() {
  windowManager.toggleMainWindow()
}

/**
 * 从通知跳转到事件详情页
 *
 * 当用户点击通知弹窗时，会跳转到 /events 页面
 * 并高亮显示对应的通知消息
 *
 * @param payload 可选的通知载荷，包含 id
 */
function openEventsPageFromNotification(payload?: { id?: string }) {
  showMainWindow()  // 先显示主窗口

  try {
    // 通过 IPC 发送消息给渲染进程，让前端跳转到事件页
    windowManager.getWin()?.webContents.send('app/navigate', {
      path: '/events',
      alertId: payload?.id || '',
    })
  } catch {
    // ignore（窗口可能已经关闭）
  }
}

// ============= 创建托盘管理器 =============

/**
 * 创建系统托盘管理器
 *
 * 托盘就是电脑右下角的小图标（类似微信、QQ 的图标）
 * trayManager 负责管理：
 * - 托盘图标的显示
 * - 右键菜单的构建
 * - 鼠标悬停时的预览窗口
 * - 未读数显示（闪烁、徽章等）
 */
let trayManager = createTrayManager({
  getWin: () => windowManager.getWin(),              // 获取主窗口（托盘需要控制窗口显示/隐藏）
  getAppIcon: () => getAppIcon(),                    // 获取图标（用于托盘显示）
  toggleMainWindow,                                  // 点击托盘图标时切换窗口状态
  showMainWindow,                                    // 点击"显示主界面"菜单项时调用
  hideMainWindow,                                    // 点击"隐藏主界面"菜单项时调用
  onAlertClick: (alert) => openEventsPageFromNotification(alert),  // 点击通知时的回调（跳转到事件页）
  onQuitRequest: () => {                             // 用户点击"退出"时的处理
    windowManager.setQuitting(true)                  // 告诉窗口管理器：这次是真的要退出（不是隐藏）
    app.quit()                                       // 退出应用
  },
  onTestAlertsEnabled: (enabled) => testAlerts.setEnabled(enabled),  // 测试告警开关状态变化
})

/**
 * 创建系统托盘图标
 * 会在电脑右下角显示一个小图标，点击可以显示/隐藏主窗口
 */
function createTray() {
  trayManager.createTray()
}

/**
 * 检查主窗口是否隐藏
 * 用于判断是否应该显示托盘气泡通知
 */
function isMainWindowHidden() {
  return trayManager.isMainWindowHidden()
}

// ============= 未读数管理 =============

/**
 * 设置未读数量（导出供外部使用）
 *
 * @param count 未读消息数量
 * 会显示在任务栏、托盘图标上（Windows 任务栏会有红色数字）
 */
export function setUnreadCount(count: number) {
  trayManager.setUnreadCount(count)
}

// ============= 创建告警管理器 =============

/**
 * 创建告警管理器
 *
 * alertManager 负责右上角的弹窗通知（类似微信收到消息时弹出的提示）
 * 功能包括：
 * - 创建独立的通知窗口（无边框、置顶）
 * - 播放系统提示音（shell.beep）
 * - 主窗口可见时，只记录消息不弹窗
 * - 主窗口隐藏时，弹窗 + 托盘气泡
 */
const alertManager = createAlertManager({
  MAIN_DIST,                                  // 主进程编译目录（用于找 preload 脚本）
  getWin: () => windowManager.getWin(),      // 获取主窗口（用于判断是否需要弹窗）
  isNotificationsEnabled: () => notificationsEnabled,  // 检查通知是否启用
  onAppAlertToRenderer: (payload) => {       // 当有告警时，发送消息给渲染进程
    try {
      // 记录告警到托盘管理器（用于预览窗口显示）
      trayManager.recordAlert(payload)

      // 通过 IPC 发送消息给前端，前端可以在消息中心显示
      windowManager.getWin()?.webContents.send('app/alert', payload)
    } catch {
      // ignore（窗口可能已经关闭）
    }
  },
  // 当主窗口隐藏时，让托盘显示气泡通知
  onBalloonWhenHidden: (payload) => trayManager.maybeShowBalloonWhenHidden(payload),
  // 点击通知时的回调（跳转到事件详情页）
  onAlertClick: (payload) => openEventsPageFromNotification(payload),
})

// ============= 创建测试告警管理器 =============

/**
 * 创建测试告警管理器
 *
 * 用于开发测试，可以自动模拟告警消息（不需要真实后端）
 * 定时生成测试告警，方便调试通知功能
 */
const testAlerts = createTestAlertsRunner({
  isMainWindowHidden: () => isMainWindowHidden(),  // 判断窗口是否隐藏（只在隐藏时才测试告警）
  showAlert: (payload) => alertManager.showAlert(payload as any, BrowserWindow),  // 调用告警管理器显示弹窗
})

// ============= 告警函数（导出供外部使用） =============

/**
 * 显示告警弹窗（导出供外部使用）
 *
 * @param payload 告警内容，包含：
 *   - title: 告警标题
 *   - message: 告警消息
 *   - variant: 类型（'risk' 风险 | 'todo' 待办）
 *   - sound: 是否播放声音
 */
export function showAlert(payload?: any) {
  alertManager.showAlert(payload, BrowserWindow)
}

// ============= 创建主窗口（带窗口记忆功能） =============

/**
 * 创建主窗口
 *
 * 功能说明：
 * 1. 首次启动：使用默认大小（1200x800）和居中位置
 * 2. 再次启动：恢复上次的窗口位置和大小
 * 3. 每次窗口移动或调整大小：自动保存状态
 */
function createWindow() {
  // 创建窗口状态管理器
  // 这个插件会自动在用户数据目录下保存窗口的状态（位置、大小）
  const winState = windowStateKeeper({
    defaultWidth: 1200,    // 默认宽度
    defaultHeight: 800,   // 默认高度
  })

  // 打印窗口状态日志（帮助调试）
  console.log('========= 窗口记忆状态 =========')
  console.log('X坐标:', winState.x)
  console.log('Y坐标:', winState.y)
  console.log('宽度:', winState.width)
  console.log('高度:', winState.height)
  console.log('===============================')

  // 创建窗口，直接传入 winState（在 window-manager 内部会调用 winState.manage(win)）
  windowManager.createWindow(BrowserWindow, winState)
}

// ============= 应用生命周期事件监听 =============

/**
 * 所有窗口关闭时触发
 *
 * 注意：因为有托盘常驻，窗口关闭时应用不会退出（类似微信关闭窗口但程序还在运行）
 * 只会清除窗口的引用，应用继续在后台运行
 */
app.on('window-all-closed', () => {
  // 清除窗口引用，但不退出应用
  windowManager.onAllWindowsClosed()
})

/**
 * 应用激活事件（主要在 macOS 上使用）
 *
 * 在 macOS 上，点击 Dock 图标时，如果没有窗口打开，会触发此事件
 * 需要重新创建窗口
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()  // 没有窗口时，重新创建
  }
})

/**
 * 应用即将退出前触发
 *
 * 在此做一些清理工作：
 * - 停止告警蜂鸣声
 * - 停止测试告警
 * - 停止托盘图标闪烁
 */
app.on('before-quit', () => {
  windowManager.setQuitting(true)    // 告诉窗口管理器：这次是真的要退出
  alertManager.stopAlertBeep()       // 停止告警蜂鸣声
  testAlerts.stop()                  // 停止测试告警
  trayManager.stopTrayBlink()        // 停止托盘图标闪烁
})

// ============= 测试告警控制 =============

/**
 * 设置测试告警的开关
 * @param enabled 是否启用测试告警
 */
function setTestAlertsEnabled(enabled: boolean) {
  testAlerts.setEnabled(enabled)
}

// ============= 应用初始化 =============

/**
 * app.whenReady() 表示应用基础环境已经准备好
 * 在这里进行所有初始化工作
 */
app.whenReady().then(() => {
  // ============= Windows 平台设置 =============

  /**
   * 设置 Windows 应用的用户模型 ID（AppUserModelId）
   *
   * 这是 Windows 上应用的唯一标识符，用于：
   * - 任务栏图标（不同实例不会创建多个图标）
   * - 跳转列表（右键任务栏图标的历史记录）
   * - 桌面通知（通知会显示正确的应用名称和图标）
   */
  // if (process.platform === 'win32') {
  //   try {
  //     app.setAppUserModelId(APP_ID)
  //   } catch {
  //     // ignore（设置失败不影响运行）
  //   }
  // }

  // ============= 创建配置存储 =============

  /**
   * 创建配置存储
   *
   * configStore 负责保存和加载用户配置（如通知开关等）
   * 配置文件保存在系统的 userData 目录：
   * - Windows: C:\Users\用户名\AppData\Roaming\应用名\app-config.json
   * - macOS: ~/Library/Application Support/应用名/app-config.json
   * - Linux: ~/.config/应用名/app-config.json
   */
  let configStore: ReturnType<typeof createConfigStore> | null = null
  configStore = createConfigStore(path.join(app.getPath('userData'), 'app-config.json'))

  // ============= 忽略 HTTPS 证书错误 =============

  /**
   * 忽略 HTTPS 证书错误（仅用于内部自签名证书）
   * 注意：生产环境应使用正确的证书，不要使用此设置
   */
  session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))

  // ============= 创建系统托盘 =============

  /**
   * 创建系统托盘图标
   * 在电脑右下角显示应用图标，用户可以点击控制应用
   */
  createTray()

  // ============= 加载通知开关配置 =============

  /**
   * 从本地配置文件中读取用户是否启用了通知
   * 默认为启用（如果配置不存在或为空）
   */
  configStore.loadAppConfig().then((cfg) => {
    notificationsEnabled = cfg.notificationsEnabled !== false  // 默认启用
  })

  // ============= 注册 HTTP 请求 IPC 处理 =============

  /**
   * 注册 HTTP 请求的 IPC 处理程序
   *
   * 渲染进程（前端）可以通过 IPC 让主进程帮忙发送 HTTP 请求
   * 这样做的好处：
   * - 可以统一处理请求（添加 Token、拦截响应）
   * - 可以实现离线队列（断网时缓存请求，网络恢复后重试）
   * - 可以处理自签名证书（主进程可以忽略证书错误）
   */
  registerHttpRequestIpc(ipcMain, session.defaultSession)

  // ============= 注册应用级 IPC 处理程序 =============

  /**
   * 注册应用级的 IPC 处理程序
   *
   * 将各个管理器和函数注册到 IPC，让渲染进程可以调用它们
   *
   * 例如：
   * - 前端点击"显示/隐藏"按钮时，通过 IPC 调用 windowManager.showMainWindow()
   * - 前端修改通知开关时，通过 IPC 调用 setNotificationsEnabled()
   * - 前端点击测试通知时，通过 IPC 调用 showAlert()
   */
  registerAppIpcHandlers({
    ipcMain,                                          // Electron 的 IPC 主进程模块
    app,                                              // Electron 的 app 模块
    shell,                                            // 用于打开外部链接等
    windowManager,                                    // 窗口管理器
    trayManager,                                      // 托盘管理器
    alertManager,                                     // 告警管理器
    testAlerts,                                       // 测试告警管理器
    getNotificationsEnabled: () => notificationsEnabled,  // 获取通知开关状态
    setNotificationsEnabled: async (enabled) => {    // 设置通知开关状态
      notificationsEnabled = Boolean(enabled)
      // 保存到配置文件（异步操作）
      await configStore?.saveAppConfig({ notificationsEnabled })
      return notificationsEnabled
    },
  })

  // ============= 创建主窗口 =============

  /**
   * 创建主窗口
   * 此时应用已经准备好，可以显示用户界面了
   */
  createWindow()

  // ============= 测试模式：自动发送告警 =============

  /**
   * 测试模式：如果启动参数包含 --test-alerts，则每分钟自动发送一条测试告警
   * 用于验证托盘气泡、右上角弹窗、未读数等功能是否正常工作
   *
   * 启动方式：pnpm dev -- --test-alerts
   */
  if (process.argv.includes('--test-alerts')) {
    setTestAlertsEnabled(true)
  }
})
