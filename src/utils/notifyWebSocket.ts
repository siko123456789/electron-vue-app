/**
 * 通知 WebSocket 客户端（应用级长连接）
 *
 * - 登录后连接，登出才断开；锁屏 / 切路由不关
 * - Electron：主进程带 Cookie/Token 建连（渲染进程跨域 WS 带不上鉴权）
 * - 浏览器预览：直接 WebSocket（可用 token query）
 */

import { useAuthStore } from '@/stores/auth'
import { useNotifyRealtimeStore } from '@/stores/notifyRealtime'
import type { NotifyRealtimeEvent } from '@/stores/notifyRealtime'
import type { NotifySummaryData } from '@/api/riskMonitor'
import { logger } from '@/utils/logger'
import { ElNotification } from 'element-plus'

const IPC_COOKIE_KEY = 'ipc_cookie_v1'
const SETTINGS_API_BASE_KEY = 'apiBase'

let browserWs: WebSocket | null = null
let browserReconnectTimer: ReturnType<typeof setTimeout> | null = null
let browserStopped = true
let ipcBound = false
let started = false

function getApiBase(): string {
  return (localStorage.getItem(SETTINGS_API_BASE_KEY) || '').trim().replace(/\/+$/, '')
}

/** 由 apiBase 拼出 /api/websocket/notify */
export function buildNotifyWsUrl(): string {
  const base = getApiBase()
  if (/^https?:\/\//i.test(base)) {
    const withApi = /\/api$/i.test(base) ? base : `${base}/api`
    const u = new URL(withApi)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `${u.pathname.replace(/\/+$/, '')}/websocket/notify`
    u.search = ''
    u.hash = ''
    return u.toString()
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = location.host || 'localhost:5173'
  const prefix = base && base.startsWith('/') ? base.replace(/\/+$/, '') : '/api'
  return `${proto}//${host}${prefix}/websocket/notify`
}

function getStoredCookie(): string {
  try {
    return String(localStorage.getItem(IPC_COOKIE_KEY) || '').trim()
  } catch {
    return ''
  }
}

function getToken(): string {
  try {
    return String(localStorage.getItem('token') || '').trim().replace(/^Bearer\s+/i, '')
  } catch {
    return ''
  }
}

function parsePayload(raw: unknown): { type?: string; data?: unknown } | null {
  let text = ''
  if (typeof raw === 'string') text = raw
  else if (raw == null) return null
  else text = String(raw)

  text = text.trim()
  if (!text || text === 'stop') return null

  try {
    const msg = JSON.parse(text)
    if (!msg || typeof msg !== 'object') return null
    return msg as { type?: string; data?: unknown }
  } catch {
    return null
  }
}

function handleMessage(raw: unknown) {
  const msg = parsePayload(raw)
  if (!msg?.type) return

  const store = useNotifyRealtimeStore()

  switch (msg.type) {
    case 'ping':
      // Electron 主进程已回 pong；浏览器路径在 onmessage 里处理
      void replyPong()
      break
    case 'summary':
      store.applySummary((msg.data || {}) as Partial<NotifySummaryData>)
      break
    case 'event':
      store.handleIncomingEvent((msg.data || {}) as NotifyRealtimeEvent)
      break
    case 'event_updated': {
      const data = (msg.data || {}) as NotifyRealtimeEvent
      store.bumpList(data.id ?? null)
      break
    }
    default:
      break
  }
}

async function replyPong() {
  // 浏览器兜底；Electron ping 不会转发到这里
  if (browserWs && browserWs.readyState === WebSocket.OPEN) {
    browserWs.send(JSON.stringify({ type: 'pong' }))
  }
}

function bindIpcListeners() {
  if (ipcBound || !window.ipcRenderer?.on) return
  ipcBound = true

  window.ipcRenderer.on('notify-ws/message', (_event, data) => {
    handleMessage(data)
  })
  window.ipcRenderer.on('notify-ws/status', (_event, status) => {
    const store = useNotifyRealtimeStore()
    store.applyConnectionStatus(status)
    console.log('[notify-ws]', status?.connected ? 'connected' : 'disconnected', status || {})

    if (status?.gaveUp && useAuthStore().isLoggedIn) {
      ElNotification({
        title: '通知连接已断开',
        message:
          status.msg ||
          `已连续重连 ${status.maxAttempts || 5} 次仍失败，实时告警可能中断。可重新登录或稍后重试。`,
        type: 'error',
        duration: 0,
        position: 'top-right',
      })
    }
  })
}

function clearBrowserReconnect() {
  if (!browserReconnectTimer) return
  clearTimeout(browserReconnectTimer)
  browserReconnectTimer = null
}

function connectBrowser() {
  if (browserStopped) return
  clearBrowserReconnect()

  const url = buildNotifyWsUrl()
  const token = getToken()
  const withAuth = token
    ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : url

  try {
    browserWs?.close()
  } catch {
    // ignore
  }

  try {
    browserWs = new WebSocket(withAuth)
  } catch (error) {
    logger.warn('notify ws connect failed', { error: String(error) })
    browserReconnectTimer = setTimeout(connectBrowser, 3000)
    return
  }

  const store = useNotifyRealtimeStore()

  browserWs.onopen = () => {
    store.setConnected(true)
    logger.info('notify ws connected')
  }

  browserWs.onmessage = (e) => {
    if (typeof e.data === 'string') {
      try {
        const msg = JSON.parse(e.data)
        if (msg?.type === 'ping' && browserWs?.readyState === WebSocket.OPEN) {
          browserWs.send(JSON.stringify({ type: 'pong' }))
          return
        }
      } catch {
        // fall through
      }
    }
    handleMessage(e.data)
  }

  browserWs.onclose = () => {
    store.setConnected(false)
    browserWs = null
    if (!browserStopped) {
      browserReconnectTimer = setTimeout(connectBrowser, 3000)
    }
  }

  browserWs.onerror = () => {
    // onclose 重连
  }
}

async function startElectron() {
  bindIpcListeners()
  const url = buildNotifyWsUrl()
  await window.ipcRenderer!.invoke('app/notify-ws/start', {
    url,
    cookie: getStoredCookie(),
    token: getToken(),
  })
}

async function stopElectron() {
  try {
    await window.ipcRenderer?.invoke('app/notify-ws/stop')
  } catch {
    // ignore
  }
  useNotifyRealtimeStore().setConnected(false)
}

function startBrowser() {
  browserStopped = false
  connectBrowser()
}

function stopBrowser() {
  browserStopped = true
  clearBrowserReconnect()
  try {
    if (browserWs && browserWs.readyState === WebSocket.OPEN) {
      browserWs.send('stop')
    }
  } catch {
    // ignore
  }
  try {
    browserWs?.close()
  } catch {
    // ignore
  }
  browserWs = null
  useNotifyRealtimeStore().setConnected(false)
}

/** 登录后调用；锁屏、自启、切页都不应 stop */
export async function startNotifyRealtime() {
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return

  if (window.ipcRenderer?.invoke) {
    bindIpcListeners()
    // 已启动时也走 start：主进程若已连接且参数不变会 skip，避免拆连接
    started = true
    await startElectron()
    return
  }

  if (started) return
  started = true
  startBrowser()
}

/** 仅登出时调用 */
export async function stopNotifyRealtime() {
  if (!started) {
    if (window.ipcRenderer?.invoke) await stopElectron()
    else stopBrowser()
    return
  }
  started = false
  if (window.ipcRenderer?.invoke) await stopElectron()
  else stopBrowser()
}

/** 重连耗尽后手动再试 */
export async function retryNotifyRealtime() {
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return
  started = true
  if (window.ipcRenderer?.invoke) {
    bindIpcListeners()
    await window.ipcRenderer.invoke('app/notify-ws/retry')
    return
  }
  browserStopped = false
  connectBrowser()
}
