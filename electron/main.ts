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
import { Notification } from 'electron'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

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
let alertWins: BrowserWindow[] = [] // 弹窗通知窗口引用（右上角堆叠）
let alertBeepTimer: NodeJS.Timeout | null = null // 警报蜂鸣定时器引用
let lastUnreadCount = 0 // 最近一次未读数量
let pendingUnreadCount: number | null = null // 主窗口未就绪时暂存未读数量
let notificationsEnabled = true // 是否启用通知（弹窗/声音）
let configFilePath = '' // 配置文件路径（userData 下）
let lastAlertForTray: { title: string; message: string; ts: number } | null = null // 最近一次告警（用于托盘悬停提示）
let testAlertTimer: NodeJS.Timeout | null = null // 测试告警定时器（仅用于测试）
let trayBlinkTimer: NodeJS.Timeout | null = null // 托盘闪烁定时器（未读提示）
let trayBlinkOn = false
let trayIconNormal: Electron.NativeImage | null = null
let trayIconAlert: Electron.NativeImage | null = null
let trayPeekWin: BrowserWindow | null = null // 托盘悬停消息预览窗口（类似微信）
let trayPeekHideTimer: NodeJS.Timeout | null = null
const recentAlerts: Array<{ title: string; message: string; ts: number; variant: 'risk' | 'todo' }> = []
const APP_ID = 'com.risk.app'

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

  trayIconNormal = getAppIcon()
  trayIconAlert = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <circle cx="8" cy="8" r="7" fill="#DC2626"/>
        <circle cx="8" cy="8" r="5" fill="#EF4444"/>
      </svg>`
    )}`
  )

  tray = new Tray(trayIconNormal)
  tray.setToolTip('风险治理')
  tray.on('click', () => toggleMainWindow())
  tray.on('mouse-move', () => {
    if (trayPeekHideTimer) {
      clearTimeout(trayPeekHideTimer)
      trayPeekHideTimer = null
    }
    showTrayPeek()
  })
  tray.on('mouse-leave', () => scheduleHideTrayPeek())

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主界面', click: () => showMainWindow() },
    { label: '隐藏主界面', click: () => hideMainWindow() },
    { type: 'separator' },
    {
      label: '开始测试告警（每分钟）',
      click: () => setTestAlertsEnabled(true),
    },
    {
      label: '停止测试告警',
      click: () => setTestAlertsEnabled(false),
    },
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
  refreshTrayTip()
}

function formatTrayTip() {
  const unread = lastUnreadCount
  return unread > 0 ? `风险治理（未读 ${unread}）` : '风险治理'
}

function refreshTrayTip() {
  if (!tray) return
  try {
    tray.setToolTip(formatTrayTip())
  } catch {
    // ignore
  }
}

function isMainWindowHidden() {
  if (!win) return true
  try {
    return !win.isVisible() || win.isMinimized()
  } catch {
    return true
  }
}

function scheduleHideTrayPeek() {
  if (trayPeekHideTimer) clearTimeout(trayPeekHideTimer)
  trayPeekHideTimer = setTimeout(() => hideTrayPeek(), 350)
}

function ensureTrayPeekWindow() {
  if (trayPeekWin && !trayPeekWin.isDestroyed()) return trayPeekWin
  trayPeekWin = new BrowserWindow({
    width: 380,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  trayPeekWin.on('blur', () => scheduleHideTrayPeek())
  trayPeekWin.on('closed', () => {
    trayPeekWin = null
  })

  return trayPeekWin
}

function buildTrayPeekHtml(items: Array<{ title: string; message: string; ts: number; variant: 'risk' | 'todo' }>) {
  const safe = (s: string) => escapeHtml(String(s || ''))
  const rows = items
    .slice(0, 5)
    .map((it, idx) => {
      const theme = it.variant === 'todo' ? '#2563eb' : '#dc2626'
      const title = safe(it.title)
      return `
        <div class="row" data-idx="${idx}">
          <div class="icon" style="background:${theme}"></div>
          <div class="title">${title}</div>
        </div>
      `
    })
    .join('')

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>peek</title>
      <style>
        :root{--bg:rgba(255,255,255,.98);--fg:#111827;--muted:#6b7280;--border:rgba(0,0,0,.10)}
        *{box-sizing:border-box}
        body{margin:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif}
        .wrap{padding:10px}
        .card{background:var(--bg);border:1px solid var(--border);border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.22);overflow:hidden}
        .head{padding:10px 12px;border-bottom:1px solid var(--border);font-weight:800;color:var(--fg)}
        .row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border)}
        .row:last-child{border-bottom:none}
        .icon{width:22px;height:22px;border-radius:8px;flex:0 0 auto;box-shadow:0 10px 18px rgba(0,0,0,.12)}
        .title{min-width:0;flex:1;font-weight:800;color:var(--fg);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="head">风险治理（未读 ${lastUnreadCount}）</div>
          ${rows || `<div class="row"><div class="col"><div class="title">暂无未读</div><div class="msg">没有可展示的消息。</div></div></div>`}
        </div>
      </div>
    </body>
  </html>`
}

function showTrayPeek() {
  if (process.platform !== 'win32') return
  if (!tray) return
  if (!isMainWindowHidden()) return
  if (lastUnreadCount <= 0) {
    hideTrayPeek()
    return
  }

  // 生成显示内容
  const items = recentAlerts.slice(0, 5)
  if (items.length === 0) {
    items.push({
      title: `未读消息`,
      message: `你有 ${lastUnreadCount} 条未读消息`,
      ts: Date.now(),
      variant: 'risk',
    })
  }

  const w = ensureTrayPeekWindow()
  const bounds = tray.getBounds() // 获取托盘图标的边界位置
  const { workArea } = screen.getPrimaryDisplay() // 获取屏幕工作区域

  const height = 64 + items.length * 44 // 消息框高度（根据消息数量动态计算）
  const width = 360 // 消息框宽度
  const x = Math.min(workArea.x + workArea.width - width - 8, Math.max(workArea.x + 8, bounds.x + bounds.width - width))
  const y = Math.max(workArea.y + 8, bounds.y - height - 8)

  try { w.setBounds({ x, y, width, height }, false) } catch {}

  const html = buildTrayPeekHtml(items)
  w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  try { w.showInactive() } catch { try { w.show() } catch {} }
}

function hideTrayPeek() {
  if (trayPeekHideTimer) {
    clearTimeout(trayPeekHideTimer)
    trayPeekHideTimer = null
  }
  if (!trayPeekWin || trayPeekWin.isDestroyed()) return
  try {
    trayPeekWin.hide()
  } catch {
    // ignore
  }
}

function stopTrayBlink() {
  if (trayBlinkTimer) clearInterval(trayBlinkTimer)
  trayBlinkTimer = null
  trayBlinkOn = false
  if (tray && trayIconNormal) {
    try {
      tray.setImage(trayIconNormal)
    } catch {
      // ignore
    }
  }
}

function startTrayBlink() {
  if (!tray || trayBlinkTimer) return
  trayBlinkTimer = setInterval(() => {
    if (!tray) return
    trayBlinkOn = !trayBlinkOn
    const img = trayBlinkOn ? trayIconAlert : trayIconNormal
    if (!img) return
    try {
      tray.setImage(img)
    } catch {
      // ignore
    }
  }, 700)
}

function showSystemNotification(title: string, body: string, sound: boolean) {
  if (process.platform !== 'win32') return
  if (!Notification.isSupported()) return
  try {
    new Notification({
      title: title || '风险治理',
      body: body || '请立即关注并处理。',
      silent: !sound,
      icon: getAppIcon(),
    }).show()
  } catch {
    // ignore
  }
}

/**
 * 设置未读数量（用于 Dock/任务栏提示，类似微信底部未读提醒）
 * @param count 未读数量
 */
function setUnreadCount(count: number) {
  const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  const prev = lastUnreadCount
  lastUnreadCount = next
  refreshTrayTip()

  // -------------------------------
  // 保证 recentAlerts 与未读数同步（保留多条消息，而不是覆盖第一条）
  if (next > 0) {
    if (recentAlerts.length === 0) {
      // recentAlerts 为空，生成默认占位
      recentAlerts.unshift({
        title: `未读消息`,
        message: `你有 ${next} 条未读消息`,
        ts: Date.now(),
        variant: 'risk',
      })
    } else {
      // recentAlerts 非空，不覆盖已有消息
      // 可以同步更新第一条的数量提示，但不覆盖内容
      recentAlerts[0].message = recentAlerts[0].message.includes('你有')
        ? `你有 ${next} 条未读消息`
        : recentAlerts[0].message
    }
  } else {
    // 清空所有未读消息
    recentAlerts.length = 0
  }
  // -------------------------------

  if (process.platform === 'win32' && isMainWindowHidden()) {
    if (next > 0) startTrayBlink()
    else stopTrayBlink()
  } else if (next === 0) {
    stopTrayBlink()
  }

  try { app.setBadgeCount(next) } catch {}

  if (process.platform === 'darwin' && prev === 0 && next > 0) {
    try { app.dock?.bounce?.('informational') } catch {}
  }

  // Windows 任务栏 overlay
  if (process.platform === 'win32' && win) {
    if (next > 0) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#DC2626"/></svg>`
      const overlay = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      try { win.setOverlayIcon(overlay, `未读消息：${next}`) } catch {}
      try { win.flashFrame(true) } catch {}
    } else {
      try { win.setOverlayIcon(null, '') } catch {}
      try { win.flashFrame(false) } catch {}
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

function clearClosedAlertWins() {
  alertWins = alertWins.filter((w) => !w.isDestroyed())
}

function stopAlertBeepIfNoWindows() {
  clearClosedAlertWins()
  if (alertWins.length === 0) stopAlertBeep()
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

  // 记录最近一次告警，用于托盘悬停提示
  lastAlertForTray = { title, message: message || '请立即关注并处理。', ts }
  recentAlerts.unshift({ title, message: message || '请立即关注并处理。', ts, variant })
  recentAlerts.splice(10)
  refreshTrayTip()

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

  // 系统通知（Windows Toast）暂不默认启用：避免与自绘右上角弹窗重复

  // Windows：仅在主窗口隐藏时弹出系统托盘气泡提示
  if (process.platform === 'win32' && tray && isMainWindowHidden()) {
    try {
      const balloonTitle = title || (variant === 'todo' ? '待办提醒' : '风险告警')
      const balloonContent = (message || '请立即关注并处理。').slice(0, 300)
      ;(tray as any).displayBalloon?.({
        icon: getAppIcon(),
        title: balloonTitle,
        content: balloonContent,
      })
    } catch {
      // ignore
    }
  }

  // 计算弹窗位置，放在屏幕右上角（堆叠）
  const { workArea } = screen.getPrimaryDisplay()
  const width = 360
  const height = 92
  const x = Math.max(workArea.x, workArea.x + workArea.width - width - 20)

  clearClosedAlertWins()
  const maxStack = 3
  while (alertWins.length >= maxStack) {
    try {
      alertWins[0]?.close()
    } catch {
      // ignore
    }
    alertWins.shift()
  }

  const idx = alertWins.length
  const y = Math.max(workArea.y, workArea.y + 20 + idx * (height + 10))

  // 创建新的弹窗窗口
  const alertWin = new BrowserWindow({
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
  alertWins.push(alertWin)

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

<style>
html,body{
  margin:0;
  padding:0;
  overflow:hidden;
  background:transparent;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif;
}

/* 外层容器 */
.wrap{
  padding:10px;
}

/* 卡片 */
.notification{
  display:flex;
  align-items:flex-start;
  gap:12px;

  width:100%;
  box-sizing:border-box;

  padding:12px 14px;

  background:#fff;
  border-radius:10px;

  box-shadow:0 8px 24px rgba(0,0,0,0.15);

  transform:translateX(40px);
  opacity:0;

  transition:all .25s ease;
}

/* 出现动画 */
.show{
  transform:translateX(0);
  opacity:1;
}

/* icon */
.icon{
  width:32px;
  height:32px;
  border-radius:8px;
  background:${theme};
  flex-shrink:0;
}

/* 内容 */
.content{
  flex:1;
  min-width:0;
}

/* 标题 */
.title{
  font-size:14px;
  font-weight:600;
  color:#111;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* 内容 */
.message{
  font-size:13px;
  color:#666;
  margin-top:4px;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
</style>
</head>

<body>

<div class="wrap">
  <div class="notification" id="card">
    <div class="icon"></div>
    <div class="content">
      <div class="title">${safeTitle}</div>
      <div class="message">${safeMessage}</div>
    </div>
  </div>
</div>

<script>

const card = document.getElementById("card")

/* 滑入动画 */
setTimeout(()=>{
  card.classList.add("show")
},20)

let timer

function startClose(){
  timer=setTimeout(()=>{
    window.close()
  },8000)
}

function stopClose(){
  clearTimeout(timer)
}

card.addEventListener("mouseenter",stopClose)
card.addEventListener("mouseleave",startClose)

startClose()

</script>

</body>
</html>`

  // 加载弹窗内容
  alertWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  // 弹窗准备就绪后显示
  alertWin.once('ready-to-show', () => {
    alertWin?.show()
    alertWin?.focus()
    if (sound) {
      try {
        shell.beep()
      } catch {
        // ignore
      }
      if (!alertBeepTimer) startAlertBeep() // 如果启用了声音，则开始周期性蜂鸣
    }
  })

  // 自动关闭，避免一直占用右上角
  setTimeout(() => {
    try {
      if (!alertWin.isDestroyed()) alertWin.close()
    } catch {
      // ignore
    }
  }, 8_000)

  alertWin.on('closed', () => stopAlertBeepIfNoWindows())
  alertWin.on('close', () => stopAlertBeepIfNoWindows())
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
  if (testAlertTimer) clearInterval(testAlertTimer)
  testAlertTimer = null
  stopTrayBlink()
})

function setTestAlertsEnabled(enabled: boolean) {
  const on = Boolean(enabled)
  if (on) {
    if (testAlertTimer) return
    notificationsEnabled = true
    let tick = 0
    const sendOne = () => {
      if (!isMainWindowHidden()) return
      tick += 1
      const kind = tick % 2 === 1 ? 'vuln' : 'port'
      const now = new Date().toLocaleString()
      const alertTitle = kind === 'vuln' ? '新发现关键漏洞' : '新发现高危端口'
      const alertMessage =
        kind === 'vuln'
          ? `检测到关键漏洞需要立即处理。\n时间：${now}\n建议：尽快修复并验证。`
          : `检测到高危端口暴露风险。\n时间：${now}\n建议：立即核查端口来源并限制访问。`
      showAlert({ variant: 'risk', title: alertTitle, message: alertMessage, sound: false })
    }

    // 启用后先来一条，方便立刻验证
    setTimeout(sendOne, 1000)
    testAlertTimer = setInterval(sendOne, 60_000)
  } else {
    if (testAlertTimer) clearInterval(testAlertTimer)
    testAlertTimer = null
  }
}

// 应用准备就绪后的初始化
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    try {
      app.setAppUserModelId(APP_ID)
    } catch {
      // ignore
    }
  }

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
  ipcMain.handle('app/test-alerts/set-enabled', (_event, enabled) => {
    setTestAlertsEnabled(Boolean(enabled))
    return Boolean(testAlertTimer)
  })
  ipcMain.handle('app/quit', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.handle('app/show-alert', (_event, payload) => showAlert(payload))
  ipcMain.handle('app/set-unread-count', (_event, count) => setUnreadCount(Number(count || 0)))

  // 创建主窗口
  createWindow()

  // 测试：每分钟自动推送一条告警（仅当窗口隐藏时），用于验证托盘气泡/右上角弹窗/未读数联动
  if (process.argv.includes('--test-alerts')) {
    setTestAlertsEnabled(true)
  }
})
