/**
 * 主进程模块导入
 * app: Electron 应用控制模块
 * BrowserWindow: 浏览器窗口类
 * ipcMain: 主进程 IPC 通信模块
 * Menu: 菜单模块
 * nativeImage: 原生图片模块
 * net: 网络请求模块
 * screen: 屏幕信息模块
 * session: 会话模块
 * shell: 系统外壳模块
 * Tray: 系统托盘模块
 */
import { app, BrowserWindow, ipcMain, Menu, nativeImage, net, screen, session, shell, Tray } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

// 获取当前文件目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 安全性: 接受无效TLS证书很危险
// 此功能启用是为了支持不能更改的内部/自签名后端
// 考虑按主机名/IP限制或仅作为开发功能
app.commandLine.appendSwitch('ignore-certificate-errors')

// 构建后的目录结构
process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] // Vite 开发服务器 URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron') // 主进程构建输出目录
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist') // 渲染进程构建输出目录

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// 全局变量声明
let win: BrowserWindow | null // 主窗口引用
let tray: Tray | null = null // 系统托盘引用
let isQuitting = false // 是否正在退出应用
let alertWin: BrowserWindow | null = null // 弹窗通知窗口引用
let alertBeepTimer: NodeJS.Timeout | null = null // 警报蜂鸣定时器引用
let lastUnreadCount = 0 // 最近一次未读数量
let pendingUnreadCount: number | null = null // 主窗口未就绪时暂存未读数量
let notificationsEnabled = true // 是否启用通知（弹窗/声音）
let configFilePath = '' // 配置文件路径（userData 下）

// 通过安装器写入开机自启时，会使用 `--autostart` 启动参数（用于启动时默认隐藏到托盘）
const startedFromAutoStart = process.argv.includes('--autostart')

type AppConfig = {
  notificationsEnabled?: boolean
}

async function loadAppConfig(): Promise<AppConfig> {
  if (!configFilePath) return {}
  try {
    const text = await fs.readFile(configFilePath, 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as AppConfig
  } catch {
    return {}
  }
}

async function saveAppConfig(config: AppConfig): Promise<void> {
  if (!configFilePath) return
  try {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true })
    await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf8')
  } catch {
    // ignore
  }
}

// 单实例锁，确保应用只运行一个实例
const SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock()
if (!SINGLE_INSTANCE_LOCK) {
  // 如果无法获取单实例锁，则退出应用
  app.quit()
} else {
  // 当尝试启动第二个实例时，显示主窗口
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

/**
 * 获取应用图标
 * 优先使用平台特定的图标格式 (Windows 使用 ico, 其他平台使用 png)
 * 如果首选图标为空，则使用 PNG 图标作为备选
 */
function getAppIcon() {
  const ico = path.join(process.env.APP_ROOT!, 'public', 'icon.ico')
  const png = path.join(process.env.APP_ROOT!, 'public', 'lanhu_logo.png')
  const iconPath = process.platform === 'win32' ? ico : png
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? nativeImage.createFromPath(png) : image
}

/**
 * 显示主窗口
 */
function showMainWindow() {
  if (!win) return
  win.show()
  win.focus()
}

/**
 * 隐藏主窗口
 */
function hideMainWindow() {
  if (!win) return
  win.hide()
}

/**
 * 切换主窗口可见性
 */
function toggleMainWindow() {
  if (!win) return
  if (win.isVisible()) hideMainWindow()
  else showMainWindow()
}

/**
 * 创建系统托盘
 * 包含显示/隐藏主界面、退出等功能的上下文菜单
 */
function createTray() {
  if (tray) return

  tray = new Tray(getAppIcon())
  tray.setToolTip('风险治理')
  tray.on('click', () => toggleMainWindow())

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showMainWindow() },
    { label: '隐藏主界面', click: () => hideMainWindow() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
}

/**
 * 设置未读数量（用于 Dock/任务栏提示，类似微信底部未读提醒）
 * @param count 未读数量
 */
function setUnreadCount(count: number) {
  const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  const prev = lastUnreadCount
  lastUnreadCount = next

  // macOS / Linux: badge（支持时显示在 Dock/启动器上）
  try {
    app.setBadgeCount(next)
  } catch {
    // ignore
  }

  // macOS: 从 0 -> >0 时，轻微跳动提示一次
  try {
    if (process.platform === 'darwin' && prev === 0 && next > 0) {
      app.dock?.bounce?.('informational')
    }
  } catch {
    // ignore
  }

  // Windows：任务栏 overlay + 闪烁
  if (process.platform === 'win32' && win) {
    if (next > 0) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#DC2626"/></svg>`
      const overlay = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      try {
        win.setOverlayIcon(overlay, `未读消息：${next}`)
      } catch {
        // ignore
      }
      try {
        win.flashFrame(true)
      } catch {
        // ignore
      }
    } else {
      try {
        win.setOverlayIcon(null, '')
      } catch {
        // ignore
      }
      try {
        win.flashFrame(false)
      } catch {
        // ignore
      }
    }
  } else if (process.platform === 'win32' && !win) {
    pendingUnreadCount = next
  }
}

/**
 * 停止警报蜂鸣声
 */
function stopAlertBeep() {
  if (alertBeepTimer) clearInterval(alertBeepTimer)
  alertBeepTimer = null
}

/**
 * 开始警报蜂鸣声
 * @param intervalMs 蜂鸣间隔时间（毫秒）
 */
function startAlertBeep(intervalMs = 1200) {
  stopAlertBeep()
  alertBeepTimer = setInterval(() => shell.beep(), intervalMs)
}

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 * @param text 待转义的文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 显示警报弹窗
 * 创建一个始终置顶的浏览器窗口，显示风险告警或待办提醒
 * @param payload 弹窗参数
 * @param payload.title 标题
 * @param payload.message 消息内容
 * @param payload.variant 类型 ('risk' 风险告警 | 'todo' 待办提醒)
 * @param payload.sound 是否播放声音
 */
function showAlert(payload?: { title?: string; message?: string; variant?: 'risk' | 'todo'; sound?: boolean; id?: string; ts?: number }) {
  const title = (payload?.title || (payload?.variant === 'todo' ? '待办提醒' : '风险告警')).trim()
  const message = (payload?.message || '').trim()
  const variant = payload?.variant || 'risk'
  const sound = payload?.sound !== false
  const id = payload?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const ts = payload?.ts || Date.now()

  // 主窗口已可见且聚焦时，优先走应用内提示，避免再弹一个置顶窗打断操作
  if (win && win.isVisible() && win.isFocused()) {
    // 发送消息到渲染进程用于应用内消息中心
    try {
      win?.webContents.send('app/alert', { id, ts, variant, title, message })
    } catch {
      // ignore
    }
    if (notificationsEnabled && sound) shell.beep()
    return
  }

  // 通知已关闭：仅记录/广播，不弹窗不响铃
  if (!notificationsEnabled) {
    // 发送消息到渲染进程用于应用内消息中心
    try {
      win?.webContents.send('app/alert', { id, ts, variant, title, message })
    } catch {
      // ignore
    }
    return
  }

  // 发送消息到渲染进程用于应用内消息中心
  try {
    win?.webContents.send('app/alert', { id, ts, variant, title, message })
  } catch {
    // ignore
  }

  // 计算弹窗位置，放在屏幕右上角
  const { workArea } = screen.getPrimaryDisplay()
  const width = 420
  const height = 220
  const x = Math.max(workArea.x, workArea.x + workArea.width - width - 20)
  const y = Math.max(workArea.y, workArea.y + 20)

  // 如果已有弹窗则先关闭
  if (alertWin) {
    alertWin.close()
    alertWin = null
  }
  stopAlertBeep()

  // 创建新的弹窗窗口
  alertWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    resizable: false,           // 不可调整大小
    minimizable: false,         // 不可最小化
    maximizable: false,         // 不可最大化
    fullscreenable: false,      // 不可全屏
    skipTaskbar: true,          // 不在任务栏显示
    alwaysOnTop: true,          // 始终置顶
    frame: false,               // 无边框
    transparent: false,         // 不透明
    show: false,                // 先隐藏，准备好后再显示
    backgroundColor: '#0b1220', // 背景颜色
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'), // 预加载脚本
    },
  })

  // 设置窗口属性
  alertWin.setAlwaysOnTop(true, 'screen-saver')
  alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 转义HTML内容，防止XSS攻击
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  // 根据类型设置主题颜色
  const theme = variant === 'todo' ? '#2563eb' : '#dc2626'

  // 构建弹窗HTML内容
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root{--bg:#0b1220;--fg:#e5e7eb;--muted:#9ca3af;--accent:${theme};--border:rgba(255,255,255,.12)}
      *{box-sizing:border-box}
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--fg)}
      .wrap{height:100%;padding:14px 14px 12px}
      .head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .badge{display:inline-flex;align-items:center;gap:8px}
      .dot{width:10px;height:10px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 4px rgba(255,255,255,.06)}
      .title{font-weight:700;letter-spacing:.2px}
      .close{appearance:none;border:1px solid var(--border);background:transparent;color:var(--fg);border-radius:10px;padding:4px 10px;cursor:pointer}
      .msg{margin-top:10px;border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.04);color:var(--fg);line-height:1.5;white-space:pre-wrap;max-height:120px;overflow:auto}
      .foot{margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .hint{font-size:12px;color:var(--muted)}
      .btn{appearance:none;border:none;background:var(--accent);color:white;border-radius:12px;padding:8px 12px;cursor:pointer;font-weight:600}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="head">
        <div class="badge">
          <span class="dot"></span>
          <div class="title">${safeTitle}</div>
        </div>
        <button class="close" id="x">关闭</button>
      </div>
      <div class="msg" id="m">${safeMessage || '请立即关注并处理。'}</div>
      <div class="foot">
        <div class="hint">此弹窗置顶显示（不易被浏览器遮挡）</div>
        <button class="btn" id="ok">我知道了</button>
      </div>
    </div>
    <script>
      const close = () => window.close();
      document.getElementById('x').addEventListener('click', close);
      document.getElementById('ok').addEventListener('click', close);
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    </script>
  </body>
</html>`

  // 加载弹窗内容
  alertWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  // 弹窗准备就绪后显示
  alertWin.once('ready-to-show', () => {
    alertWin?.show()
    alertWin?.focus()
    if (sound) shell.beep()
    if (sound) startAlertBeep() // 如果启用了声音，则开始周期性蜂鸣
  })

  // 监听弹窗关闭事件
  alertWin.on('closed', () => {
    stopAlertBeep()
    alertWin = null
  })

  // 监听弹窗关闭事件
  alertWin.on('close', () => stopAlertBeep())
}

function createWindow() {
  // 获取屏幕尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  // 计算窗口大小，默认为屏幕的 60%
  const windowWidth = Math.floor(screenWidth * 0.6)
  const windowHeight = Math.floor(screenHeight * 0.6)

  win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    center: true,
    resizable: true,
    autoHideMenuBar: true,
    show: !startedFromAutoStart,

    icon: path.join(process.env.APP_ROOT, 'public', 'lanhu_logo.png'),

    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    }
  })

  win.on('close', (event) => {
    if (isQuitting) return
    // 关闭主窗口时，改为托盘常驻（不退出）
    event.preventDefault()
    win?.hide()
  })

  // 主窗口就绪后，同步一次未读数量（Windows overlay 需要窗口存在）
  win.on('ready-to-show', () => {
    if (startedFromAutoStart) win?.hide()
    if (pendingUnreadCount !== null) {
      setUnreadCount(pendingUnreadCount)
      pendingUnreadCount = null
    }
  })

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // 开发环境下打开开发者工具
    win.webContents.openDevTools()
  } else {
    // 生产环境加载本地文件
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 监听键盘事件，F12 打开开发者工具
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      win?.webContents.toggleDevTools()
    }
  })
}

app.on('window-all-closed', () => {
  // 托盘常驻：窗口都关闭时也不退出
  win = null
})

// 监听应用激活事件
// 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，通常会重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 监听应用即将退出事件
app.on('before-quit', () => {
  isQuitting = true // 设置退出标志
  stopAlertBeep()   // 停止警报蜂鸣
})

// 应用准备就绪后的初始化
app.whenReady().then(() => {
  // 读取本地配置（userData 下）
  configFilePath = path.join(app.getPath('userData'), 'app-config.json')

  // 设置证书验证过程，忽略证书错误
  session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))

  // 创建系统托盘
  createTray()

  // 加载通知开关配置
  loadAppConfig().then((cfg) => {
    notificationsEnabled = cfg.notificationsEnabled !== false
  })

  ipcMain.handle('http-request', async (_event, options) => {
    const method = String(options?.method || 'GET').toUpperCase()
    const url = String(options?.url || '')
    const headers = (options?.headers && typeof options.headers === 'object') ? options.headers : {}
    const body = options?.body ?? null

    if (!url) throw new Error('Missing url')

    return await new Promise((resolve, reject) => {
      const request = net.request({ method, url, session: session.defaultSession })

      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined || value === null) continue
        request.setHeader(key, String(value))
      }

      request.on('response', (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: response.statusCode,
            headers: response.headers,
            data: text,
          })
        })
      })

      request.on('error', (error) => reject(error))

      if (body !== null && body !== undefined) request.write(String(body))
      request.end()
    })
  })

  // 注册应用相关的 IPC 处理程序，供渲染进程调用
  ipcMain.handle('app/show-main-window', () => showMainWindow())     // 显示主窗口 IPC 接口
  ipcMain.handle('app/hide-main-window', () => hideMainWindow())     // 隐藏主窗口 IPC 接口
  ipcMain.handle('app/toggle-main-window', () => toggleMainWindow()) // 切换主窗口可见性 IPC 接口
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
  ipcMain.handle('app/get-notifications-enabled', () => notificationsEnabled)
  ipcMain.handle('app/set-notifications-enabled', async (_event, enabled) => {
    notificationsEnabled = Boolean(enabled)
    await saveAppConfig({ notificationsEnabled })
    return notificationsEnabled
  })
  ipcMain.handle('app/quit', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.handle('app/show-alert', (_event, payload) => showAlert(payload))
  ipcMain.handle('app/set-unread-count', (_event, count) => setUnreadCount(Number(count || 0)))

  // 创建主窗口
  createWindow()
})