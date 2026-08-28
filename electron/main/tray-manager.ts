import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron'

export type AlertVariant = 'risk' | 'todo'

export type AlertRecord = {
  id?: string
  title: string
  message: string
  ts: number
  variant: AlertVariant
  /** 0=P0 1=P1 2=P2；托盘预览只展示 P0 */
  priority?: number
}

export type SetUnreadOptions = {
  /** 是否任务栏/托盘闪烁（严格跟「P0 任务栏红色闪烁」） */
  flash?: boolean
}

export type TrayManagerDeps = {
  getWin: () => BrowserWindow | null
  getAppIcon: () => Electron.NativeImage
  toggleMainWindow: () => void
  showMainWindow: () => void
  hideMainWindow: () => void
  onLockRequest: () => void
  onQuitRequest: () => void
  onTestAlertsEnabled: (enabled: boolean) => void
  onAlertClick?: (alert?: AlertRecord) => void
}

const TRAY_PEEK_VIEWPORT_ROWS = 6
const TRAY_PEEK_HIDE_DELAY = 800
const TRAY_PEEK_WIDTH = 380
const TRAY_PEEK_HEAD_H = 52
const TRAY_PEEK_FOOT_H = 48
const TRAY_PEEK_ROW_H = 68
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

  /** 仅统计 P0 未处理（驱动托盘角标/闪烁） */
  let lastUnreadCount = 0
  let flashEnabled = false
  let pendingUnreadCount: number | null = null
  let pendingFlash: boolean | null = null

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
      if (lastUnreadCount > 0) tray.setToolTip(`风险治理 · P0 未处理 ${lastUnreadCount}`)
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

  function clearAlerts() {
    recentAlerts.length = 0
    lastTrayPeekSignature = ''
    hideTrayPeek()
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
        const payload = JSON.parse(message.slice('__tray_peek_click__:'.length)) as {
          id?: string
          action?: string
        }
        const action = String(payload.action || 'open')
        if (action === 'ignore-all') {
          clearAlerts()
          setUnreadCount(0, { flash: false })
          try { deps.getWin()?.webContents?.send?.('app/alerts/mark-all-read') } catch {}
        } else if (action === 'close') {
          hideTrayPeek()
          return
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

  function getPeekItems(): AlertRecord[] {
    // 托盘预览只展示 P0 紧急项；P1 走限时弹窗，不堆在这里
    return recentAlerts
      .filter((it) => it.priority === undefined || Number(it.priority) === 0)
      .slice(0, 20)
  }

  function buildTrayPeekHtml(items: AlertRecord[]) {
    const shouldScroll = items.length > TRAY_PEEK_VIEWPORT_ROWS
    const rows = items
      .map((it, idx) => {
        const title = escapeHtml(it.title)
        const message = escapeHtml(it.message || '请立即关注并处理。')
        const alertId = escapeHtml(it.id || '')
        return `
          <button class="row" data-idx="${idx}" data-id="${alertId}" type="button">
            <div class="icon">P0</div>
            <div class="content">
              <div class="title">${title}</div>
              <div class="message">${message}</div>
            </div>
          </button>
        `
      })
      .join('')

    const empty = `
      <div class="empty">
        <div class="empty-title">暂无 P0 紧急告警</div>
        <div class="empty-desc">P1 告警仅短暂弹窗，不会驻留托盘</div>
      </div>
    `

    return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>peek</title>
        <style>
          :root{
            --bg:#14181f;
            --bg-row:#1a212b;
            --bg-hover:#222b38;
            --fg:#e8eef7;
            --muted:#8b9bb0;
            --border:rgba(255,255,255,.08);
            --danger:#ea580c;
            --danger-bg:rgba(234,88,12,.18);
          }
          *{box-sizing:border-box}
          html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;
            font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
          .card{height:100%;background:var(--bg);border:1px solid var(--border);border-radius:14px;
            box-shadow:0 16px 40px rgba(0,0,0,.45);overflow:hidden;display:flex;flex-direction:column}
          .head{height:${TRAY_PEEK_HEAD_H - 1}px;padding:0 12px 0 14px;border-bottom:1px solid var(--border);
            display:flex;align-items:center;justify-content:space-between;gap:8px}
          .head-title{color:var(--fg);font-weight:700;font-size:13px;letter-spacing:.02em}
          .head-badge{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;
            background:var(--danger-bg);color:#fdba74;font-size:11px;font-weight:700}
          .head-close{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--muted);
            cursor:pointer;font-size:16px;line-height:1}
          .head-close:hover{background:rgba(255,255,255,.06);color:var(--fg)}
          .list{flex:1;min-height:0;overflow-y:${shouldScroll ? 'auto' : 'hidden'};overflow-x:hidden;padding:6px}
          .row{width:100%;min-height:${TRAY_PEEK_ROW_H - 6}px;display:flex;align-items:flex-start;gap:10px;
            padding:10px 10px;margin-bottom:4px;border:1px solid transparent;border-radius:10px;
            background:var(--bg-row);overflow:hidden;text-align:left;cursor:pointer}
          .row:hover{background:var(--bg-hover);border-color:rgba(239,68,68,.25)}
          .icon{width:28px;height:28px;border-radius:8px;flex:0 0 auto;margin-top:1px;
            background: linear-gradient(145deg, #fb923c, #ea580c); color: #fff; font-size: 10px; font-weight: 800;
            display: flex; align-items: center; justify-content: center; letter-spacing: .04em;
          }
          .content{min-width:0;flex:1}
          .title{font-weight:650;color:var(--fg);font-size:13px;line-height:18px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .message{margin-top:4px;color:var(--muted);font-size:12px;line-height:16px;
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .empty{height:100%;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--muted)}
          .empty-title{color:var(--fg);font-size:13px;font-weight:650}
          .empty-desc{font-size:12px}
          .list::-webkit-scrollbar{width:6px}
          .list::-webkit-scrollbar-thumb{background:rgba(234,88,12,.35);border-radius:3px}
          .foot{height:${TRAY_PEEK_FOOT_H - 1}px;border-top:1px solid var(--border);
            display:flex;align-items:center;justify-content:flex-end;padding:0 10px;gap:8px}
          .btn{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--border);
            background:rgba(255,255,255,.04);color:var(--fg);font-weight:650;font-size:12px;cursor:pointer}
          .btn:hover{background:rgba(255,255,255,.08)}
          .btn-danger{border-color:rgba(234,88,12,.45);background:rgba(234,88,12,.18);color:#fdba74}
          .btn-danger:hover{filter:brightness(1.08)}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              <div class="head-title">P0 紧急告警</div>
              <div class="head-badge">未处理 ${lastUnreadCount}</div>
            </div>
            <button class="head-close" id="closePeek" type="button" title="关闭">×</button>
          </div>
          <div class="list">
            ${rows || empty}
          </div>
          <div class="foot">
            <button class="btn" id="openApp" type="button">打开应用</button>
            <button class="btn btn-danger" id="ignoreAll" type="button">忽略全部</button>
          </div>
        </div>
        <script>
          document.getElementById('closePeek')?.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            console.log('__tray_peek_click__:' + JSON.stringify({ action: 'close' }))
          })
          document.getElementById('openApp')?.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            console.log('__tray_peek_click__:' + JSON.stringify({ action: 'open' }))
          })
          document.querySelectorAll('.row[data-id]').forEach((node) => {
            node.addEventListener('click', () => {
              const id = node.getAttribute('data-id') || ''
              console.log('__tray_peek_click__:' + JSON.stringify({ id, action: 'open' }))
            })
          })
          document.getElementById('ignoreAll')?.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            console.log('__tray_peek_click__:' + JSON.stringify({ action: 'ignore-all' }))
          })
        </script>
      </body>
    </html>`
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
    // 仅有 P0 未处理时才弹出托盘预览（避免 P1 堆在这里）
    if (lastUnreadCount <= 0) {
      hideTrayPeek()
      return
    }

    const items = getPeekItems()
    const w = ensureTrayPeekWindow()
    const bounds = tray.getBounds()
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { workArea } = display

    const rowCount = Math.max(1, Math.min(TRAY_PEEK_VIEWPORT_ROWS, items.length || 1))
    const desiredHeight =
      TRAY_PEEK_BORDER_H + TRAY_PEEK_HEAD_H + rowCount * TRAY_PEEK_ROW_H + TRAY_PEEK_FOOT_H
    const maxHeight = Math.max(220, workArea.height - 16)
    const height = Math.min(desiredHeight, maxHeight)
    const x = Math.min(
      workArea.x + workArea.width - TRAY_PEEK_WIDTH - 8,
      Math.max(workArea.x + 8, bounds.x + bounds.width - TRAY_PEEK_WIDTH),
    )
    const y = Math.max(workArea.y + 8, bounds.y - height - 8)
    const signature = JSON.stringify({
      unread: lastUnreadCount,
      items: items.map((it) => [it.id || '', it.title, it.message, it.ts, it.priority]),
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

  function applyFlashVisuals() {
    const shouldFlash = flashEnabled && lastUnreadCount > 0 && isMainWindowHidden()

    if (shouldFlash) startTrayBlink()
    else stopTrayBlink()

    const win = deps.getWin()
    if (process.platform === 'win32' && win) {
      if (lastUnreadCount > 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#DC2626"/></svg>`
        const overlay = nativeImage.createFromDataURL(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        )
        try { win.setOverlayIcon(overlay, `P0 未处理：${lastUnreadCount}`) } catch {}
      } else {
        try { win.setOverlayIcon(null, '') } catch {}
      }
      // 仅最小化/隐藏时闪任务栏；窗口在前台时不 flashFrame（否则关不掉）
      try { win.flashFrame(shouldFlash) } catch {}
    }
  }

  function setUnreadCount(count: number, opts?: SetUnreadOptions) {
    const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    lastUnreadCount = next
    flashEnabled = opts?.flash !== undefined ? Boolean(opts.flash) : next > 0

    if (next <= 0) {
      clearAlerts()
    }

    refreshTrayTip()
    applyFlashVisuals()

    if (next <= 0) hideTrayPeek()

    try {
      app.setBadgeCount(next)
    } catch {
      // ignore
    }

    if (process.platform === 'win32' && !deps.getWin()) {
      pendingUnreadCount = next
      pendingFlash = flashEnabled
    }
  }

  function onMainWindowReady() {
    if (pendingUnreadCount !== null) {
      setUnreadCount(pendingUnreadCount, { flash: Boolean(pendingFlash) })
      pendingUnreadCount = null
      pendingFlash = null
    }
  }

  function recordAlert(alert: AlertRecord) {
    const priority = alert.priority === undefined ? 0 : Number(alert.priority)
    // 托盘只堆积 P0；P1/P2 不进入悬停列表
    if (priority !== 0) return

    const normalized: AlertRecord = {
      id: alert.id,
      title: alert.title || 'P0 风险告警',
      message: alert.message || '请立即关注并处理。',
      ts: alert.ts || Date.now(),
      variant: alert.variant || 'risk',
      priority: 0,
    }

    recentAlerts.unshift(normalized)
    recentAlerts.splice(0, recentAlerts.length, ...recentAlerts.slice(0, 10))
    lastTrayPeekSignature = ''
    refreshTrayTip()
  }

  function removeAlert(id?: string) {
    const target = String(id || '').trim()
    if (!target) return
    const before = recentAlerts.length
    const next = recentAlerts.filter((it) => String(it.id || '') !== target)
    recentAlerts.length = 0
    recentAlerts.push(...next)
    if (recentAlerts.length !== before) {
      lastTrayPeekSignature = ''
      if (trayPeekWin && !trayPeekWin.isDestroyed() && trayPeekWin.isVisible()) {
        showTrayPeek()
      }
    }
  }

  function maybeShowBalloonWhenHidden(payload: {
    title: string
    message: string
    variant: AlertVariant
    priority?: number
  }) {
    if (process.platform !== 'win32') return
    if (!tray) return
    if (!isMainWindowHidden()) return
    // 气泡仅 P0；P1 用右上角限时窗
    if (payload.priority !== undefined && Number(payload.priority) !== 0) return
    try {
      const balloonTitle = payload.title || 'P0 风险告警'
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
        </svg>`,
      )}`,
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
        {
          label: isHidden ? '显示主界面' : '隐藏主界面',
          click: () => (isHidden ? deps.showMainWindow() : deps.hideMainWindow()),
        },
        { label: '锁定应用', click: () => deps.onLockRequest() },
        {
          label: '忽略全部 P0',
          enabled: lastUnreadCount > 0,
          click: () => {
            clearAlerts()
            setUnreadCount(0, { flash: false })
            try { win?.webContents?.send?.('app/alerts/mark-all-read') } catch {}
          },
        },
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
    removeAlert,
    clearAlerts,
    maybeShowBalloonWhenHidden,
    isMainWindowHidden,
    getUnreadCount: () => lastUnreadCount,
    /** 主窗口显示时停闪烁 */
    onMainWindowShown: () => {
      applyFlashVisuals()
      hideTrayPeek()
    },
  }
}
