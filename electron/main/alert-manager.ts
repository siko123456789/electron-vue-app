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
  priority?: number
  /** 自动关闭秒数；0 = 驻留（P0） */
  autoDismissSeconds?: number
  /** 测试用：无视主窗口聚焦，强制弹出桌面窗 */
  forceDesktop?: boolean
}

type AlertItem = {
  id: string
  ts: number
  variant: AlertVariant
  title: string
  message: string
  priority: number
}

export type AlertManagerDeps = {
  MAIN_DIST: string
  getWin: () => BrowserWindow | null
  isNotificationsEnabled: () => boolean
  onAppAlertToRenderer: (payload: AlertItem) => void
  onBalloonWhenHidden: (payload: {
    title: string
    message: string
    variant: AlertVariant
    priority?: number
  }) => void
  onAlertClick?: (payload: AlertItem) => void
}

/** 与监测页浅色主题对齐 */
const COLOR = {
  p0: '#ea580c',
  p0Soft: 'rgba(234, 88, 12, 0.12)',
  p0Border: 'rgba(234, 88, 12, 0.35)',
  p1: '#ca8a04',
  p1Soft: 'rgba(202, 138, 4, 0.14)',
  p1Border: 'rgba(202, 138, 4, 0.38)',
  card: '#ffffff',
  text: '#1f2937',
  muted: '#6b7280',
  line: 'rgba(15, 23, 42, 0.08)',
}

const P0_WIDTH = 392
const P0_COLLAPSED_H = 86
const P0_ROW_H = 64
const P0_HEAD_H = 48
const P0_MAX_ROWS = 5
/** P1 与 P0 折叠卡同宽同高，保证视觉一致 */
const P1_WIDTH = P0_WIDTH
const P1_HEIGHT = P0_COLLAPSED_H
const MARGIN = 16

/**
 * 桌面告警：
 * - P0：右下角折叠栈，无 ×，常驻；展开后点条目进列表，绑定后再消
 * - P1：右下角限时条，可 ×，不进 P0 栈
 */
export function createAlertManager(deps: AlertManagerDeps) {
  let p0Win: BrowserWindow | null = null
  let p0Expanded = false
  const p0Items: AlertItem[] = []

  const p1Wins: BrowserWindow[] = []
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

  function workArea() {
    return screen.getPrimaryDisplay().workArea
  }

  function bottomRight(width: number, height: number, stackIndex = 0) {
    const area = workArea()
    const x = Math.max(area.x + 8, area.x + area.width - width - MARGIN)
    const y = Math.max(
      area.y + 8,
      area.y + area.height - height - MARGIN - stackIndex * (height + 10),
    )
    return { x, y }
  }

  function p0WindowHeight() {
    if (!p0Expanded || p0Items.length <= 1) return P0_COLLAPSED_H
    const rows = Math.min(P0_MAX_ROWS, p0Items.length)
    return P0_HEAD_H + rows * P0_ROW_H + 14
  }

  function placeP0Window() {
    if (!p0Win || p0Win.isDestroyed()) return
    const height = p0WindowHeight()
    const { x, y } = bottomRight(P0_WIDTH, height, 0)
    try {
      p0Win.setBounds({ x, y, width: P0_WIDTH, height }, false)
    } catch {
      // ignore
    }
  }

  function buildP0Html() {
    const count = p0Items.length
    // 仅 1 条时不需要展开态
    if (count <= 1) p0Expanded = false
    const canExpand = count > 1
    const latest = p0Items[0]
    const latestId = escapeHtml(latest?.id || '')
    const latestTitle = escapeHtml(latest?.title || 'P0 紧急告警')
    const latestMsg = escapeHtml(latest?.message || '请立即处理')
    const rows = p0Items
      .map((it) => {
        const title = escapeHtml(it.title)
        const message = escapeHtml(it.message || '')
        const id = escapeHtml(it.id)
        return `<button class="row" type="button" data-id="${id}">
          <span class="row-badge">P0</span>
          <span class="row-body">
            <span class="row-title">${title}</span>
            <span class="row-msg">${message}</span>
          </span>
          <span class="row-go">查看</span>
        </button>`
      })
      .join('')

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;
    font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
  .shell{height:100%;padding:8px}
  .card{
    height:calc(100% - 0px);background:${COLOR.card};border:1px solid ${COLOR.p0Border};
    border-radius:16px;box-shadow:0 18px 40px rgba(234,88,12,.18),0 8px 18px rgba(15,23,42,.12);
    overflow:hidden;display:flex;flex-direction:column;
    transform:translateY(12px);opacity:0;transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .28s ease;
  }
  .card.show{transform:translateY(0);opacity:1}
  .collapsed{
    display:flex;align-items:center;gap:12px;height:100%;padding:12px 14px;cursor:pointer;
    background:linear-gradient(135deg, ${COLOR.p0Soft}, #fff 55%);
  }
  .badge{
    width:42px;height:42px;border-radius:12px;flex:0 0 auto;
    background:linear-gradient(145deg,#fb923c,${COLOR.p0});color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;
    box-shadow:0 8px 16px rgba(234,88,12,.28);letter-spacing:.04em;
  }
  .main{min-width:0;flex:1}
  .kicker{display:flex;align-items:center;gap:8px;margin-bottom:2px}
  .kicker-text{font-size:12px;font-weight:700;color:${COLOR.p0}}
  .count{
    height:20px;padding:0 8px;border-radius:999px;background:${COLOR.p0Soft};color:${COLOR.p0};
    font-size:11px;font-weight:700;display:inline-flex;align-items:center;
  }
  .title{font-size:14px;font-weight:700;color:${COLOR.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{margin-top:2px;font-size:12px;color:${COLOR.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chev{
    width:28px;height:28px;border-radius:8px;border:1px solid ${COLOR.line};background:#fff;
    color:${COLOR.p0};display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto;
  }
  .go-one{
    flex:0 0 auto;font-size:12px;font-weight:700;color:${COLOR.p0};padding:6px 8px;
  }
  .head{
    height:${P0_HEAD_H}px;padding:0 12px 0 14px;border-bottom:1px solid ${COLOR.line};
    display:flex;align-items:center;justify-content:space-between;gap:8px;
    background:linear-gradient(90deg, ${COLOR.p0Soft}, transparent 70%);
  }
  .head-left{display:flex;align-items:center;gap:8px;min-width:0}
  .head-title{font-size:13px;font-weight:750;color:${COLOR.text}}
  .fold{
    height:28px;padding:0 10px;border-radius:8px;border:1px solid ${COLOR.line};
    background:#fff;color:${COLOR.muted};font-size:12px;font-weight:650;cursor:pointer;
  }
  .fold:hover{color:${COLOR.p0};border-color:${COLOR.p0Border}}
  .list{flex:1;min-height:0;overflow:auto;padding:8px}
  .row{
    width:100%;display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;
    border:1px solid ${COLOR.line};border-radius:12px;background:#fff;cursor:pointer;text-align:left;
  }
  .row:hover{border-color:${COLOR.p0Border};background:${COLOR.p0Soft}}
  .row-badge{
    width:34px;height:34px;border-radius:10px;background:${COLOR.p0};color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:0 0 auto;
  }
  .row-body{min-width:0;flex:1}
  .row-title{display:block;font-size:13px;font-weight:700;color:${COLOR.text};
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row-msg{display:block;margin-top:2px;font-size:12px;color:${COLOR.muted};
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row-go{flex:0 0 auto;font-size:12px;font-weight:700;color:${COLOR.p0}}
  .list::-webkit-scrollbar{width:6px}
  .list::-webkit-scrollbar-thumb{background:rgba(234,88,12,.28);border-radius:3px}
  .collapsed-only{display:${p0Expanded ? 'none' : 'flex'}}
  .expanded-only{display:${p0Expanded && canExpand ? 'flex' : 'none'};flex-direction:column;height:100%}
</style>
</head>
<body>
  <div class="shell">
    <div class="card" id="card">
      <div class="collapsed collapsed-only" id="collapsed" data-mode="${canExpand ? 'expand' : 'open'}" data-id="${latestId}">
        <div class="badge">P0</div>
        <div class="main">
          <div class="kicker">
            <span class="kicker-text">紧急告警</span>
            <span class="count">${count} 条</span>
          </div>
          <div class="title">${latestTitle}</div>
          <div class="sub">${canExpand ? `还有 ${count - 1} 条已折叠，点击展开` : latestMsg}</div>
        </div>
        ${canExpand ? `<div class="chev">▾</div>` : `<div class="go-one">查看</div>`}
      </div>
      <div class="expanded-only">
        <div class="head">
          <div class="head-left">
            <div class="badge" style="width:32px;height:32px;font-size:11px;border-radius:10px">P0</div>
            <div class="head-title">P0 紧急 · ${count}</div>
          </div>
          <button class="fold" id="foldBtn" type="button">收起</button>
        </div>
        <div class="list">${rows}</div>
      </div>
    </div>
  </div>
<script>
  setTimeout(()=>document.getElementById('card')?.classList.add('show'), 20)
  document.getElementById('collapsed')?.addEventListener('click', ()=>{
    const node = document.getElementById('collapsed')
    const mode = node?.getAttribute('data-mode') || 'open'
    if (mode === 'expand') {
      console.log('__p0_toggle__:expand')
      return
    }
    const id = node?.getAttribute('data-id') || ''
    console.log('__p0_item__:' + JSON.stringify({ id }))
  })
  document.getElementById('foldBtn')?.addEventListener('click', (ev)=>{
    ev.stopPropagation()
    console.log('__p0_toggle__:collapse')
  })
  document.querySelectorAll('.row[data-id]').forEach((node)=>{
    node.addEventListener('click', (ev)=>{
      ev.stopPropagation()
      const id = node.getAttribute('data-id') || ''
      console.log('__p0_item__:' + JSON.stringify({ id }))
    })
  })
</script>
</body>
</html>`
  }

  function ensureP0Window(BrowserWindowCtor?: typeof BrowserWindow) {
    if (p0Win && !p0Win.isDestroyed()) return p0Win
    const BrowserWindowImpl = BrowserWindowCtor || BrowserWindow
    const height = p0WindowHeight()
    const { x, y } = bottomRight(P0_WIDTH, height, 0)
    p0Win = new BrowserWindowImpl({
      width: P0_WIDTH,
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
      focusable: true,
      webPreferences: {
        preload: path.join(deps.MAIN_DIST, 'preload.mjs'),
      },
    })
    p0Win.setAlwaysOnTop(true, 'screen-saver')
    p0Win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    p0Win.webContents.on('console-message', (_e, _l, msg) => {
      if (msg.startsWith('__p0_toggle__:')) {
        p0Expanded = msg.endsWith('expand')
        refreshP0Window()
        return
      }
      if (!msg.startsWith('__p0_item__:')) return
      try {
        const payload = JSON.parse(msg.slice('__p0_item__:'.length)) as { id?: string }
        const item = p0Items.find((it) => it.id === payload.id)
        if (item) deps.onAlertClick?.(item)
      } catch {
        // ignore
      }
    })

    p0Win.on('closed', () => {
      p0Win = null
    })
    return p0Win
  }

  function refreshP0Window(BrowserWindowCtor?: typeof BrowserWindow) {
    if (p0Items.length === 0) {
      p0Expanded = false
      if (p0Win && !p0Win.isDestroyed()) {
        try { p0Win.close() } catch { /* ignore */ }
      }
      p0Win = null
      return
    }
    const win = ensureP0Window(BrowserWindowCtor)
    placeP0Window()
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildP0Html())}`)
    win.once('ready-to-show', () => {
      placeP0Window()
      try { win.showInactive() } catch {
        try { win.show() } catch { /* ignore */ }
      }
    })
    if (win.isVisible()) {
      // reload already triggered; bounds updated
    } else {
      try { win.showInactive() } catch {
        try { win.show() } catch { /* ignore */ }
      }
    }
  }

  function upsertP0(item: AlertItem, BrowserWindowCtor?: typeof BrowserWindow) {
    const idx = p0Items.findIndex((it) => it.id === item.id)
    if (idx >= 0) p0Items.splice(idx, 1)
    p0Items.unshift(item)
    // 新告警回到折叠，避免突然撑满
    p0Expanded = false
    refreshP0Window(BrowserWindowCtor)
  }

  function dismissAlert(id: string) {
    const before = p0Items.length
    const next = p0Items.filter((it) => it.id !== id)
    p0Items.length = 0
    p0Items.push(...next)
    if (p0Items.length !== before) refreshP0Window()
    return { ok: true, remaining: p0Items.length }
  }

  function clearP0Alerts() {
    p0Items.length = 0
    p0Expanded = false
    refreshP0Window()
  }

  function clearClosedP1() {
    for (let i = p1Wins.length - 1; i >= 0; i -= 1) {
      if (p1Wins[i]?.isDestroyed()) p1Wins.splice(i, 1)
    }
  }

  function relocateP1Stack() {
    clearClosedP1()
    p1Wins.forEach((w, idx) => {
      if (w.isDestroyed()) return
      const { x, y } = bottomRight(P1_WIDTH, P1_HEIGHT, idx + (p0Items.length > 0 ? 1 : 0))
      try { w.setBounds({ x, y, width: P1_WIDTH, height: P1_HEIGHT }, false) } catch { /* ignore */ }
    })
  }

  function showP1Toast(item: AlertItem, dismissMs: number, sound: boolean, BrowserWindowCtor?: typeof BrowserWindow) {
    const BrowserWindowImpl = BrowserWindowCtor || BrowserWindow
    clearClosedP1()
    while (p1Wins.length >= 3) {
      try { p1Wins[0]?.close() } catch { /* ignore */ }
      p1Wins.shift()
    }
    const stackIndex = p1Wins.length + (p0Items.length > 0 ? 1 : 0)
    const { x, y } = bottomRight(P1_WIDTH, P1_HEIGHT, stackIndex)
    const win = new BrowserWindowImpl({
      width: P1_WIDTH,
      height: P1_HEIGHT,
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
    p1Wins.push(win)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    const safeTitle = escapeHtml(item.title)
    const safeMessage = escapeHtml(item.message)
    const clickPayload = JSON.stringify(item).replace(/</g, '\\u003c')
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;
  font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.shell{height:100%;padding:8px}
.card{
  height:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;
  background:${COLOR.card};border:1px solid ${COLOR.p1Border};border-radius:16px;
  box-shadow:0 18px 40px rgba(202,138,4,.18),0 8px 18px rgba(15,23,42,.12);
  cursor:pointer;transform:translateY(12px);opacity:0;
  transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .28s ease;
  background-image:linear-gradient(135deg, ${COLOR.p1Soft}, #fff 55%);
}
.card.show{transform:translateY(0);opacity:1}
.badge{
  width:42px;height:42px;border-radius:12px;flex:0 0 auto;
  background:linear-gradient(145deg,#fbbf24,${COLOR.p1});color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;
  box-shadow:0 8px 16px rgba(202,138,4,.28);letter-spacing:.04em;
}
.main{min-width:0;flex:1}
.kicker{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.kicker-text{font-size:12px;font-weight:700;color:${COLOR.p1}}
.count{
  height:20px;padding:0 8px;border-radius:999px;background:${COLOR.p1Soft};color:${COLOR.p1};
  font-size:11px;font-weight:700;display:inline-flex;align-items:center;
}
.title{font-size:14px;font-weight:700;color:${COLOR.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{margin-top:2px;font-size:12px;color:${COLOR.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.close{
  width:28px;height:28px;border:1px solid ${COLOR.line};border-radius:8px;background:#fff;
  color:${COLOR.muted};cursor:pointer;font-size:16px;line-height:1;flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;
}
.close:hover{color:${COLOR.text};border-color:rgba(15,23,42,.18);background:#f8fafc}
</style></head>
<body>
<div class="shell"><div class="card" id="card">
  <div class="badge">P1</div>
  <div class="main">
    <div class="kicker">
      <span class="kicker-text">高优告警</span>
      <span class="count">P1</span>
    </div>
    <div class="title">${safeTitle}</div>
    <div class="sub">${safeMessage}</div>
  </div>
  <button class="close" id="closeBtn" type="button" title="关闭">×</button>
</div></div>
<script>
const card=document.getElementById('card')
const dismissMs=${Math.max(1000, dismissMs)}
setTimeout(()=>card.classList.add('show'),20)
let timer=setTimeout(()=>window.close(), dismissMs)
card.addEventListener('mouseenter',()=>clearTimeout(timer))
card.addEventListener('mouseleave',()=>{timer=setTimeout(()=>window.close(), dismissMs)})
card.addEventListener('click',()=>{console.log('__p1_click__:'+${JSON.stringify(clickPayload)})})
document.getElementById('closeBtn')?.addEventListener('click',(ev)=>{ev.stopPropagation();window.close()})
</script>
</body></html>`

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    win.webContents.on('console-message', (_e, _l, msg) => {
      if (!msg.startsWith('__p1_click__:')) return
      try {
        const payload = JSON.parse(msg.slice('__p1_click__:'.length)) as AlertItem
        deps.onAlertClick?.(payload)
      } catch {
        deps.onAlertClick?.(item)
      }
      try { if (!win.isDestroyed()) win.close() } catch { /* ignore */ }
    })
    win.once('ready-to-show', () => {
      relocateP1Stack()
      try { win.showInactive() } catch {
        try { win.show() } catch { /* ignore */ }
      }
      if (sound) {
        try { shell.beep() } catch { /* ignore */ }
      }
    })
    win.on('closed', () => {
      clearClosedP1()
      relocateP1Stack()
    })
  }

  function showAlert(payload?: AlertPayload, BrowserWindowCtor?: typeof BrowserWindow) {
    const variant: AlertVariant = payload?.variant || 'risk'
    const title = (payload?.title || (variant === 'todo' ? '待办提醒' : '风险告警')).trim()
    const message = (payload?.message || '').trim()
    const sound = payload?.sound !== false
    const id = payload?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const ts = payload?.ts || Date.now()
    const priority =
      payload?.priority === undefined || Number.isNaN(Number(payload.priority))
        ? 0
        : Number(payload.priority)

    let autoDismissSeconds = payload?.autoDismissSeconds
    if (autoDismissSeconds === undefined) {
      autoDismissSeconds = priority === 0 ? 0 : 5
    }
    autoDismissSeconds = Math.max(0, Math.floor(Number(autoDismissSeconds) || 0))
    const dismissMs = autoDismissSeconds > 0 ? autoDismissSeconds * 1000 : 0

    const item: AlertItem = { id, ts, variant, title, message, priority }

    deps.onAppAlertToRenderer(item)

    if (!deps.isNotificationsEnabled()) return

    const main = deps.getWin()
    const focused = Boolean(main && main.isVisible() && main.isFocused())
    const forceDesktop = Boolean(payload?.forceDesktop)

    // P0：始终维护右下角折叠栈（常驻）；聚焦时也保留，方便绑定后消失
    if (priority === 0) {
      deps.onBalloonWhenHidden({
        title,
        message: message || '请立即关注并处理。',
        variant,
        priority,
      })
      upsertP0(item, BrowserWindowCtor)
      if (sound) {
        try { shell.beep() } catch { /* ignore */ }
      }
      relocateP1Stack()
      return
    }

    // P1：主窗口聚焦时不弹桌面，避免打断；隐藏/失焦时右下角限时条
    if (priority === 1) {
      if (focused && !forceDesktop) {
        if (sound) {
          try { shell.beep() } catch { /* ignore */ }
        }
        return
      }
      showP1Toast(item, dismissMs || 5000, sound, BrowserWindowCtor)
      return
    }

    // 其它等级：聚焦则跳过桌面窗（测试 forceDesktop 除外）
    if (focused && !forceDesktop) return
    showP1Toast(item, dismissMs || 3000, sound, BrowserWindowCtor)
  }

  return {
    showAlert,
    stopAlertBeep,
    dismissAlert,
    clearP0Alerts,
  }
}
