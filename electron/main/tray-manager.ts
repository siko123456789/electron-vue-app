import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron'

export type AlertVariant = 'risk' | 'todo'

export type AlertRecord = {
  id?: string
  title: string
  message: string
  ts: number
  variant: AlertVariant
}

export type TrayManagerDeps = {
  getWin: () => BrowserWindow | null
  getAppIcon: () => Electron.NativeImage
  toggleMainWindow: () => void
  showMainWindow: () => void
  hideMainWindow: () => void
  onQuitRequest: () => void
  onTestAlertsEnabled: (enabled: boolean) => void
  onAlertClick?: (alert?: AlertRecord) => void
}

const TRAY_PEEK_VIEWPORT_ROWS = 8
const TRAY_PEEK_HIDE_DELAY = 800
const TRAY_PEEK_WIDTH = 360
const TRAY_PEEK_HEAD_H = 48
const TRAY_PEEK_FOOT_H = 44
const TRAY_PEEK_ROW_H = 74
const TRAY_PEEK_BORDER_H = 2
const TRAY_PEEK_ACTIVE_PADDING = 8
const NATIVE_TOOLTIP_APP_NAME = '风险治理'

function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createTrayManager(deps: TrayManagerDeps) {
  let tray: Tray | null = null
  let trayBlinkTimer: NodeJS.Timeout | null = null
  let trayBlinkOn = false
  let trayIconNormal: Electron.NativeImage | null = null
  let trayIconAlert: Electron.NativeImage | null = null

  let trayPeekWin: BrowserWindow | null = null
  let trayPeekHideTimer: NodeJS.Timeout | null = null
  let trayPeekGuardTimer: NodeJS.Timeout | null = null
  let lastTrayPeekSignature = ''

  let lastUnreadCount = 0
  let pendingUnreadCount: number | null = null

  const recentAlerts: AlertRecord[] = []

  function isMainWindowHidden() {
    const win = deps.getWin()
    if (!win) return true
    try {
      return !win.isVisible() || win.isMinimized()
    } catch {
      return true
    }
  }

  function refreshTrayTip() {
    if (!tray) return
    try {
      if (lastUnreadCount > 0) tray.setToolTip('')
      else tray.setToolTip(NATIVE_TOOLTIP_APP_NAME)
    } catch {
      // ignore
    }
  }

  function clearHideTrayPeekTimer() {
    if (!trayPeekHideTimer) return
    clearTimeout(trayPeekHideTimer)
    trayPeekHideTimer = null
  }

  function stopTrayPeekGuard() {
    if (!trayPeekGuardTimer) return
    clearInterval(trayPeekGuardTimer)
    trayPeekGuardTimer = null
  }

  function scheduleHideTrayPeek() {
    clearHideTrayPeekTimer()
    trayPeekHideTimer = setTimeout(() => hideTrayPeek(), TRAY_PEEK_HIDE_DELAY)
  }

  function findAlertById(id?: string) {
    if (!id) return undefined
    return recentAlerts.find((item) => item.id === id)
  }

  function ensureTrayPeekWindow() {
    if (trayPeekWin && !trayPeekWin.isDestroyed()) return trayPeekWin

    trayPeekWin = new BrowserWindow({
      width: TRAY_PEEK_WIDTH,
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

    try { trayPeekWin.setFocusable(false) } catch {}
    try { trayPeekWin.setAlwaysOnTop(true, 'pop-up-menu') } catch {
      try { trayPeekWin.setAlwaysOnTop(true, 'screen-saver') } catch {}
    }
    try { trayPeekWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }) } catch {}

    trayPeekWin.on('blur', () => scheduleHideTrayPeek())
    trayPeekWin.webContents.on('console-message', (_event, _level, message) => {
      if (!message.startsWith('__tray_peek_click__:')) return
      try {
        const payload = JSON.parse(message.slice('__tray_peek_click__:'.length)) as { id?: string; action?: string }
        const action = String(payload.action || 'open')
        if (action === 'ignore-all') {
          try { deps.getWin()?.webContents?.send?.('app/alerts/mark-all-read') } catch {}
        } else {
          deps.onAlertClick?.(findAlertById(payload.id))
        }
      } catch {
        deps.onAlertClick?.()
      }
      hideTrayPeek()
    })
    trayPeekWin.on('closed', () => {
      trayPeekWin = null
      lastTrayPeekSignature = ''
      stopTrayPeekGuard()
    })

    return trayPeekWin
  }

  function buildTrayPeekHtml(items: AlertRecord[]) {
    const shouldScroll = items.length > TRAY_PEEK_VIEWPORT_ROWS
    const rows = items
      .map((it, idx) => {
        const theme = it.variant === 'todo' ? '#2563eb' : '#dc2626'
        const title = escapeHtml(it.title)
        const message = escapeHtml(it.message || '请立即关注并处理。')
        const alertId = escapeHtml(it.id || '')
        return `
          <button class="row" data-idx="${idx}" data-id="${alertId}" type="button">
            <div class="icon" style="background:${theme}"></div>
            <div class="content">
              <div class="title">${title}</div>
              <div class="message">${message}</div>
            </div>
          </button>
        `
      })
      .join('')

    return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>peek</title>
        <style>
          :root{--bg:#ffffff;--fg:#111827;--muted:#6b7280;--border:rgba(0,0,0,.10)}
          *{box-sizing:border-box}
          html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif}
          .card{height:100%;background:var(--bg);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.14);overflow:hidden;display:flex;flex-direction:column}
          .head{height:${TRAY_PEEK_HEAD_H - 1}px;padding:0 12px;border-bottom:1px solid var(--border);font-weight:800;color:var(--fg);display:flex;align-items:center}
          .list{flex:1;min-height:0;overflow-y:${shouldScroll ? 'auto' : 'hidden'};overflow-x:hidden}
          .row{width:100%;height:${TRAY_PEEK_ROW_H - 1}px;display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:none;border-bottom:1px solid var(--border);background:transparent;overflow:hidden;text-align:left;cursor:pointer}
          .row:last-child{border-bottom:none}
          .row:hover{background:#f8fafc}
          .icon{width:22px;height:22px;border-radius:8px;flex:0 0 auto;box-shadow:0 8px 14px rgba(0,0,0,.10);margin-top:2px}
          .content{min-width:0;flex:1;height:100%;display:flex;flex-direction:column}
          .title{font-weight:800;color:var(--fg);font-size:14px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .message{margin-top:2px;color:var(--muted);font-size:12px;line-height:16px;height:32px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .list::-webkit-scrollbar{width:6px}
          .list::-webkit-scrollbar-thumb{background:rgba(0,0,0,.25);border-radius:3px}
          .list::-webkit-scrollbar-track{background:rgba(0,0,0,.05);border-radius:3px}
          .foot{height:${TRAY_PEEK_FOOT_H - 1}px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:flex-end;padding:0 10px;gap:8px}
          .btn{height:28px;padding:0 10px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111827;font-weight:700;cursor:pointer}
          .btn:hover{background:#f8fafc}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">风险治理（未读 ${lastUnreadCount}）</div>
          <div class="list">
            ${rows || `<div class="row"><div class="content"><div class="title">暂无未读</div></div></div>`}
          </div>
          <div class="foot">
            <button class="btn" id="ignoreAll" type="button">忽略全部</button>
          </div>
        </div>
        <script>
          document.querySelectorAll('.row[data-id]').forEach((node) => {
            node.addEventListener('click', () => {
              const id = node.getAttribute('data-id') || ''
              console.log('__tray_peek_click__:' + JSON.stringify({ id, action: 'open' }))
            })
          })
          const ignore = document.getElementById('ignoreAll')
          if (ignore) {
            ignore.addEventListener('click', (ev) => {
              ev.preventDefault()
              ev.stopPropagation()
              console.log('__tray_peek_click__:' + JSON.stringify({ action: 'ignore-all' }))
            })
          }
        </script>
      </body>
    </html>`
  }

  function getPeekItems() {
    const items = recentAlerts.slice(0, 20)
    if (items.length > 0) return items
    return [{
      title: '未读消息',
      message: `你有 ${lastUnreadCount} 条未读消息`,
      ts: Date.now(),
      variant: 'risk' as const,
    }]
  }

  function isPointInBounds(point: { x: number; y: number }, bounds: Electron.Rectangle) {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
  }

  function isCursorOverTrayOrPeek() {
    const point = screen.getCursorScreenPoint()

    if (tray) {
      const trayBounds = tray.getBounds()
      const expandedBounds = {
        x: trayBounds.x - TRAY_PEEK_ACTIVE_PADDING,
        y: trayBounds.y - TRAY_PEEK_ACTIVE_PADDING,
        width: trayBounds.width + TRAY_PEEK_ACTIVE_PADDING * 2,
        height: trayBounds.height + TRAY_PEEK_ACTIVE_PADDING * 2,
      }
      if (isPointInBounds(point, expandedBounds)) return true
    }

    if (trayPeekWin && !trayPeekWin.isDestroyed() && trayPeekWin.isVisible()) {
      try {
        if (isPointInBounds(point, trayPeekWin.getBounds())) return true
      } catch {
        // ignore
      }
    }

    return false
  }

  function startTrayPeekGuard() {
    if (trayPeekGuardTimer) return
    trayPeekGuardTimer = setInterval(() => {
      if (!trayPeekWin || trayPeekWin.isDestroyed() || !trayPeekWin.isVisible()) {
        stopTrayPeekGuard()
        return
      }

      if (isCursorOverTrayOrPeek()) {
        clearHideTrayPeekTimer()
      } else if (!trayPeekHideTimer) {
        scheduleHideTrayPeek()
      }
    }, 120)
  }

  function showTrayPeek() {
    if (process.platform !== 'win32') return
    if (!tray) return
    if (!isMainWindowHidden()) return
    if (lastUnreadCount <= 0) {
      hideTrayPeek()
      return
    }

    const items = getPeekItems()
    const w = ensureTrayPeekWindow()
    const bounds = tray.getBounds()
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { workArea } = display

    const viewportRows = Math.min(TRAY_PEEK_VIEWPORT_ROWS, Math.max(1, items.length))
    const desiredHeight = TRAY_PEEK_BORDER_H + TRAY_PEEK_HEAD_H + viewportRows * TRAY_PEEK_ROW_H + TRAY_PEEK_FOOT_H
    const maxHeight = Math.max(220, workArea.height - 16)
    const height = Math.min(desiredHeight, maxHeight)
    const x = Math.min(workArea.x + workArea.width - TRAY_PEEK_WIDTH - 8, Math.max(workArea.x + 8, bounds.x + bounds.width - TRAY_PEEK_WIDTH))
    const y = Math.max(workArea.y + 8, bounds.y - height - 8)
    const signature = JSON.stringify({
      unread: lastUnreadCount,
      items: items.map((it) => [it.id || '', it.title, it.message, it.ts, it.variant]),
    })

    try {
      w.setBounds({ x, y, width: TRAY_PEEK_WIDTH, height }, false)
    } catch {
      // ignore
    }

    if (signature !== lastTrayPeekSignature) {
      lastTrayPeekSignature = signature
      w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildTrayPeekHtml(items))}`)
    }

    try {
      w.showInactive()
    } catch {
      try { w.show() } catch {}
    }

    startTrayPeekGuard()
  }

  function hideTrayPeek() {
    clearHideTrayPeekTimer()
    stopTrayPeekGuard()
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

  function syncSummaryAlert() {
    if (lastUnreadCount <= 0) {
      recentAlerts.length = 0
      lastTrayPeekSignature = ''
      return
    }

    const summaryMessage = `你有 ${lastUnreadCount} 条未读消息`
    const first = recentAlerts[0]
    if (first && first.title === '未读消息') {
      first.message = summaryMessage
      first.ts = Date.now()
      return
    }

    if (recentAlerts.length === 0) {
      recentAlerts.unshift({
        title: '未读消息',
        message: summaryMessage,
        ts: Date.now(),
        variant: 'risk',
      })
    }
  }

  function setUnreadCount(count: number) {
    const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    const prev = lastUnreadCount
    lastUnreadCount = next
    syncSummaryAlert()
    refreshTrayTip()

    if (process.platform === 'win32' && isMainWindowHidden()) {
      if (next > 0) startTrayBlink()
      else {
        stopTrayBlink()
        hideTrayPeek()
      }
    } else if (next === 0) {
      stopTrayBlink()
      hideTrayPeek()
    }

    try {
      app.setBadgeCount(next)
    } catch {
      // ignore
    }

    const win = deps.getWin()
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

    if (process.platform === 'darwin' && prev === 0 && next > 0) {
      try { app.dock?.bounce?.('informational') } catch {}
    }
  }

  function onMainWindowReady() {
    if (pendingUnreadCount !== null) {
      setUnreadCount(pendingUnreadCount)
      pendingUnreadCount = null
    }
  }

  function recordAlert(alert: AlertRecord) {
    const normalized: AlertRecord = {
      id: alert.id,
      title: alert.title || (alert.variant === 'todo' ? '待办提醒' : '风险告警'),
      message: alert.message || '请立即关注并处理。',
      ts: alert.ts || Date.now(),
      variant: alert.variant || 'risk',
    }

    recentAlerts.unshift(normalized)
    recentAlerts.splice(0, recentAlerts.length, ...recentAlerts.slice(0, 10))
    lastTrayPeekSignature = ''
    refreshTrayTip()
  }

  function maybeShowBalloonWhenHidden(payload: { title: string; message: string; variant: AlertVariant }) {
    if (process.platform !== 'win32') return
    if (!tray) return
    if (!isMainWindowHidden()) return
    try {
      const balloonTitle = payload.title || (payload.variant === 'todo' ? '待办提醒' : '风险告警')
      const balloonContent = (payload.message || '请立即关注并处理。').slice(0, 300)
      ;(tray as any).displayBalloon?.({
        icon: deps.getAppIcon(),
        title: balloonTitle,
        content: balloonContent,
      })
    } catch {
      // ignore
    }
  }

  function createTray() {
    if (tray) return

    trayIconNormal = deps.getAppIcon()
    trayIconAlert = nativeImage.createFromDataURL(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
          <circle cx="8" cy="8" r="7" fill="#DC2626"/>
          <circle cx="8" cy="8" r="5" fill="#EF4444"/>
        </svg>`
      )}`
    )

    tray = new Tray(trayIconNormal)
    refreshTrayTip()

    tray.on('click', () => deps.toggleMainWindow())
    tray.on('mouse-enter', () => {
      clearHideTrayPeekTimer()
      showTrayPeek()
    })
    tray.on('mouse-move', () => {
      clearHideTrayPeekTimer()
      showTrayPeek()
    })
    tray.on('mouse-leave', () => scheduleHideTrayPeek())
    tray.on('right-click', () => {
      const win = deps.getWin()
      const isHidden = !win || !win.isVisible() || win.isMinimized()
      const contextMenu = Menu.buildFromTemplate([
        { label: isHidden ? '显示主界面' : '隐藏主界面', click: () => (isHidden ? deps.showMainWindow() : deps.hideMainWindow()) },
        { label: '忽略全部未读', enabled: lastUnreadCount > 0, click: () => {
          try { win?.webContents?.send?.('app/alerts/mark-all-read') } catch {}
        } },
        { type: 'separator' },
        { label: '退出', click: () => deps.onQuitRequest() },
      ])
      tray?.popUpContextMenu(contextMenu)
    })

    refreshTrayTip()
  }

  return {
    createTray,
    stopTrayBlink,
    setUnreadCount,
    onMainWindowReady,
    recordAlert,
    maybeShowBalloonWhenHidden,
    isMainWindowHidden,
    getUnreadCount: () => lastUnreadCount,
  }
}
