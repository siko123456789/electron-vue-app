import { BrowserWindow } from 'electron'
import { screen, shell } from 'electron'
import * as path from 'node:path'

import type { AlertVariant } from './tray-manager'

export type AlertPayload = {
  title?: string
  message?: string
  variant?: AlertVariant
  sound?: boolean
  id?: string
  ts?: number
}

export type AlertManagerDeps = {
  MAIN_DIST: string
  getWin: () => BrowserWindow | null
  isNotificationsEnabled: () => boolean
  onAppAlertToRenderer: (payload: { id: string; ts: number; variant: AlertVariant; title: string; message: string }) => void
  onBalloonWhenHidden: (payload: { title: string; message: string; variant: AlertVariant }) => void
  onAlertClick?: (payload: { id: string; ts: number; variant: AlertVariant; title: string; message: string }) => void
}

/**
 * 告警弹窗管理（右上角堆叠的小窗）
 *
 * 规则：
 * - 主窗口可见且聚焦：不弹右上角窗，只做应用内消息中心 + 可选 beep
 * - 主窗口隐藏：弹右上角窗；Windows 额外显示托盘气泡
 */
export function createAlertManager(deps: AlertManagerDeps) {
  let alertWins: BrowserWindow[] = []
  let alertBeepTimer: NodeJS.Timeout | null = null

  function escapeHtml(text: string) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function stopAlertBeep() {
    if (alertBeepTimer) clearInterval(alertBeepTimer)
    alertBeepTimer = null
  }

  function clearClosedAlertWins() {
    alertWins = alertWins.filter((w) => !w.isDestroyed())
  }

  function stopAlertBeepIfNoWindows() {
    clearClosedAlertWins()
    if (alertWins.length === 0) stopAlertBeep()
  }

  function showAlert(payload?: AlertPayload, BrowserWindowCtor?: typeof BrowserWindow) {
    const variant: AlertVariant = payload?.variant || 'risk'
    const title = (payload?.title || (variant === 'todo' ? '待办提醒' : '风险告警')).trim()
    const message = (payload?.message || '').trim()
    const sound = payload?.sound !== false
    const id = payload?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const ts = payload?.ts || Date.now()

    // 主窗口已可见且聚焦：优先应用内提示，避免打断操作
    const win = deps.getWin()
    if (win && win.isVisible() && win.isFocused()) {
      deps.onAppAlertToRenderer({ id, ts, variant, title, message })
      if (deps.isNotificationsEnabled() && sound) shell.beep()
      return
    }

    // 通知已关闭：仅记录/广播
    if (!deps.isNotificationsEnabled()) {
      deps.onAppAlertToRenderer({ id, ts, variant, title, message })
      return
    }

    // 发送到渲染进程（消息中心）
    deps.onAppAlertToRenderer({ id, ts, variant, title, message })

    // Windows：仅在主窗口隐藏时弹出托盘气泡提示
    deps.onBalloonWhenHidden({ title, message: message || '请立即关注并处理。', variant })

    const BrowserWindowImpl = BrowserWindowCtor || (BrowserWindow as any as typeof BrowserWindow)

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

    const alertWin = new BrowserWindowImpl({
      width,
      height,
      x,
      y,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      frame: false,
      show: false,
      backgroundColor: '#00000000',
      hasShadow: false,   
      transparent: true,
      webPreferences: {
        preload: path.join(deps.MAIN_DIST, 'preload.mjs'),
      },
    })
    alertWins.push(alertWin)

    alertWin.setAlwaysOnTop(true, 'screen-saver')
    alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    const safeTitle = escapeHtml(title)
    const safeMessage = escapeHtml(message)
    const theme = variant === 'todo' ? '#2563eb' : '#dc2626'
    const clickPayload = JSON.stringify({ id, ts, variant, title, message }).replace(/</g, '\\u003c')

    const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
html,body{
  margin:0;
  padding:0;
  background:transparent;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif;
}

/* 整体容器 */
.container{
  padding:0;
}

/* 卡片 */
.card{
  display:flex;
  gap:12px;
  padding:12px 14px;
  background:#fff;
  border-radius:12px;
  box-shadow:none;
  cursor:pointer;
  margin:12px;
  transform:translateX(60px);
  opacity:0;
  transition:all .3s cubic-bezier(.4,0,.2,1);
}

.card.show{
  transform:translateX(0);
  opacity:1;
}

/* 左侧图标 */
.icon{
  width:36px;
  height:36px;
  border-radius:10px;
  background:${theme};
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  font-size:16px;
  flex-shrink:0;
}

/* 内容区 */
.content{
  flex:1;
  min-width:0;
}

/* 标题行 */
.header{
  display:flex;
  justify-content:space-between;
  align-items:center;
}

/* 标题 */
.title{
  font-size:14px;
  font-weight:600;
  color:#111;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

/* 时间 */
.time{
  font-size:12px;
  color:#999;
  margin-left:8px;
  flex-shrink:0;
}

/* 内容 */
.message{
  font-size:13px;
  color:#666;
  margin-top:4px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

/* hover 效果（微信类似） */
.card:hover{
  box-shadow:none;
}
</style>
</head>

<body>
  <div class="container">
    <div class="card" id="card">
      <div class="icon">!</div>

      <div class="content">
        <div class="header">
          <div class="title">${safeTitle}</div>
          <div class="time">${new Date().toLocaleTimeString().slice(0,5)}</div>
        </div>
        <div class="message">${safeMessage}</div>
      </div>
    </div>
  </div>

<script>
const card = document.getElementById("card")

setTimeout(()=> card.classList.add("show"), 20)

let timer

function startClose(){
  timer = setTimeout(()=> window.close(), 5000) // 微信大概 5s
}

function stopClose(){
  clearTimeout(timer)
}

card.addEventListener("mouseenter", stopClose)
card.addEventListener("mouseleave", startClose)

card.addEventListener("click", ()=>{
  console.log('__alert_click__:' + ${JSON.stringify(clickPayload)})
})

startClose()
</script>

</body>
</html>`

    alertWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    alertWin.webContents.on('console-message', (_event, _level, consoleMessage) => {
      if (!consoleMessage.startsWith('__alert_click__:')) return
      deps.onAlertClick?.({ id, ts, variant, title, message })
      try {
        if (!alertWin.isDestroyed()) alertWin.close()
      } catch {
        // ignore
      }
    })

    alertWin.once('ready-to-show', () => {
      alertWin?.show()
      alertWin?.focus()
      if (sound) {
        try {
          shell.beep() // 只响一声
        } catch {
          // ignore
        }
      }
    })

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

  return {
    showAlert,
    stopAlertBeep,
  }
}
