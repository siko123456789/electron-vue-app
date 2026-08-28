import type { BrowserWindow } from 'electron'

export type NotifyWsConnectOpts = {
  url: string
  cookie?: string
  token?: string
}

type NotifyWsManagerDeps = {
  getWin: () => BrowserWindow | null
  writeLog?: (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) => void
  showAlert?: (payload: {
    title: string
    message: string
    sound?: boolean
    variant?: 'risk' | 'todo'
  }) => void
}

/** 服务端约 60s 发一次 ping；超过该时间无下行视为假死 */
const HEARTBEAT_TIMEOUT_MS = 75_000
const RECONNECT_DELAY_MS = 3_000
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * 通知长连接（主进程）
 * - ping → 立刻 pong
 * - 75s 无下行 → 主动断开并重连
 * - 意外断线最多重连 5 次，失败后桌面强提示
 * - 用「当前 socket 引用」忽略被替换的旧连接 close，避免重连死循环
 */
export function createNotifyWsManager(deps: NotifyWsManagerDeps) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = true
  let lastOpts: NotifyWsConnectOpts | null = null
  let failAttempts = 0
  let gaveUp = false
  /** 主动 stop / 替换连接时置位，仅作用于当前要丢掉的那次 close */
  let ignoreNextClose = false

  function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
    deps.writeLog?.(level, message, meta)
  }

  function clearReconnect() {
    if (!reconnectTimer) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function clearHeartbeat() {
    if (!heartbeatTimer) return
    clearTimeout(heartbeatTimer)
    heartbeatTimer = null
  }

  function broadcast(channel: string, payload?: unknown) {
    const win = deps.getWin()
    if (!win || win.isDestroyed()) return
    try {
      win.webContents.send(channel, payload)
    } catch {
      // ignore
    }
  }

  function buildHeaders(opts: NotifyWsConnectOpts): Record<string, string> {
    const headers: Record<string, string> = {}
    const cookie = String(opts.cookie || '').trim()
    const token = String(opts.token || '').trim().replace(/^Bearer\s+/i, '')
    if (cookie) headers.Cookie = cookie
    if (token) {
      headers.Authorization = `Bearer ${token}`
      headers.token = token
    }
    return headers
  }

  function sameOpts(a: NotifyWsConnectOpts, b: NotifyWsConnectOpts) {
    return (
      a.url === b.url &&
      (a.cookie || '') === (b.cookie || '') &&
      (a.token || '') === (b.token || '')
    )
  }

  function touchHeartbeat() {
    clearHeartbeat()
    if (stopped || gaveUp) return
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null
      if (stopped || gaveUp) return
      const sock = ws
      if (!sock) return
      console.warn('[notify-ws] heartbeat timeout (~75s no message), force reconnect')
      ignoreNextClose = false
      try {
        sock.close()
      } catch {
        // ignore
      }
    }, HEARTBEAT_TIMEOUT_MS)
  }

  function notifyGaveUp() {
    gaveUp = true
    clearReconnect()
    clearHeartbeat()
    const payload = {
      connected: false,
      gaveUp: true,
      attempts: failAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      msg: '通知长连接已断开，请检查网络后手动重连',
    }
    console.error('[notify-ws] gave up after', failAttempts, 'attempts')
    writeLog('ERROR', '通知 WebSocket 重连失败并停止重试', {
      attempts: failAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
    })
    broadcast('notify-ws/status', payload)
    try {
      deps.showAlert?.({
        title: '通知连接已断开',
        message: `已连续重连 ${MAX_RECONNECT_ATTEMPTS} 次仍失败，实时告警可能中断。请检查网络或重新登录后再试。`,
        sound: true,
        variant: 'risk',
      })
    } catch {
      // ignore
    }
  }

  function scheduleReconnect(reason: string) {
    if (stopped || gaveUp) return
    clearReconnect()

    failAttempts += 1
    if (failAttempts > MAX_RECONNECT_ATTEMPTS) {
      notifyGaveUp()
      return
    }

    console.log('[notify-ws] reconnect scheduled', {
      reason,
      attempt: failAttempts,
      max: MAX_RECONNECT_ATTEMPTS,
      delayMs: RECONNECT_DELAY_MS,
    })
    writeLog('WARN', '通知 WebSocket 安排重连', {
      reason,
      attempt: failAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      delayMs: RECONNECT_DELAY_MS,
    })
    broadcast('notify-ws/status', {
      connected: false,
      reconnecting: true,
      attempt: failAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      reason,
    })

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, RECONNECT_DELAY_MS)
  }

  function disposeSocket(sock: WebSocket | null, { silent }: { silent: boolean }) {
    if (!sock) return
    if (silent) ignoreNextClose = true
    try {
      if (sock.readyState === WebSocket.OPEN) sock.send('stop')
    } catch {
      // ignore
    }
    try {
      sock.close()
    } catch {
      // ignore
    }
  }

  function connect() {
    if (stopped || !lastOpts?.url || gaveUp) return
    clearReconnect()
    clearHeartbeat()

    const prev = ws
    ws = null
    // 旧连接的 close 一律忽略，避免「替换连接」被当成意外断线再 scheduleReconnect
    disposeSocket(prev, { silent: true })

    const headers = buildHeaders(lastOpts)
    const myWs = (() => {
      try {
        console.log('[notify-ws] connecting =>', lastOpts!.url, {
          attempt: failAttempts || 0,
        })
        writeLog('INFO', '通知 WebSocket 开始连接', {
          url: lastOpts!.url,
          attempt: failAttempts || 0,
        })
        return new WebSocket(lastOpts!.url, { headers } as any)
      } catch (error) {
        console.warn('[notify-ws] connect throw =>', error)
        writeLog('ERROR', '通知 WebSocket 创建连接失败', {
          url: lastOpts!.url,
          error: String(error),
        })
        broadcast('notify-ws/status', { connected: false, error: String(error) })
        scheduleReconnect('connect_throw')
        return null
      }
    })()

    if (!myWs) return
    ws = myWs

    myWs.addEventListener('open', () => {
      if (ws !== myWs) return
      failAttempts = 0
      gaveUp = false
      console.log('[notify-ws] connected')
      writeLog('INFO', '通知 WebSocket 连接成功', { url: lastOpts?.url || '' })
      touchHeartbeat()
      broadcast('notify-ws/status', {
        connected: true,
        attempt: 0,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
      })
    })

    myWs.addEventListener('message', (event) => {
      if (ws !== myWs) return
      touchHeartbeat()
      const raw = event.data
      try {
        const text = typeof raw === 'string' ? raw : String(raw ?? '')
        const msg = JSON.parse(text)
        if (msg?.type === 'ping' && myWs.readyState === WebSocket.OPEN) {
          myWs.send(JSON.stringify({ type: 'pong' }))
          // 心跳较频繁，改用 debug 级别减少刷屏
          console.log('[notify-ws] heartbeat: ping -> pong')
          return
        }
        if (msg?.type === 'summary') {
          // summary 连推很常见，不逐条刷屏
          return void broadcast('notify-ws/message', raw)
        }
        console.log('[notify-ws] message =>', msg?.type || text.slice(0, 80))
      } catch {
        // 非 JSON 继续转发
      }
      broadcast('notify-ws/message', raw)
    })

    myWs.addEventListener('error', (event) => {
      if (ws !== myWs) return
      console.warn('[notify-ws] error (will reconnect on close)')
      writeLog('ERROR', '通知 WebSocket 连接错误', {
        url: lastOpts?.url || '',
        error: String(event || 'WebSocket error'),
      })
    })

    myWs.addEventListener('close', (ev) => {
      clearHeartbeat()
      const stale = ws !== myWs
      const silent = ignoreNextClose
      if (silent) ignoreNextClose = false

      if (stale || silent) {
        console.log('[notify-ws] closed (ignored)', {
          code: ev.code,
          stale,
          silent,
        })
        return
      }

      console.log('[notify-ws] closed', {
        code: ev.code,
        reason: ev.reason,
      })
      writeLog('WARN', '通知 WebSocket 已关闭', {
        url: lastOpts?.url || '',
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
      })
      ws = null
      if (stopped || gaveUp) {
        broadcast('notify-ws/status', {
          connected: false,
          stopped,
          gaveUp,
        })
        return
      }
      scheduleReconnect(ev.reason || `close_${ev.code}`)
    })
  }

  function start(opts: NotifyWsConnectOpts) {
    const url = String(opts?.url || '').trim()
    if (!url) return { ok: false as const, msg: 'missing url' }

    const next: NotifyWsConnectOpts = {
      url,
      cookie: String(opts.cookie || '').trim() || undefined,
      token: String(opts.token || '').trim() || undefined,
    }

    // 已连接且参数未变：不要拆掉重连（HMR / 重复 start 会走到这里）
    if (
      !stopped &&
      !gaveUp &&
      lastOpts &&
      sameOpts(lastOpts, next) &&
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {
      console.log('[notify-ws] start skipped (already connected)')
      return { ok: true as const, skipped: true as const }
    }

    stopped = false
    gaveUp = false
    failAttempts = 0
    lastOpts = next
    console.log('[notify-ws] start', {
      url,
      hasCookie: Boolean(lastOpts.cookie),
      hasToken: Boolean(lastOpts.token),
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
    })
    connect()
    return { ok: true as const }
  }

  function retry() {
    if (!lastOpts?.url) return { ok: false as const, msg: 'missing url' }
    stopped = false
    gaveUp = false
    failAttempts = 0
    console.log('[notify-ws] manual retry')
    connect()
    return { ok: true as const }
  }

  function stop() {
    stopped = true
    gaveUp = false
    failAttempts = 0
    clearReconnect()
    clearHeartbeat()
    const sock = ws
    ws = null
    disposeSocket(sock, { silent: true })
    broadcast('notify-ws/status', { connected: false, stopped: true })
    return { ok: true as const }
  }

  function isConnected() {
    return Boolean(ws && ws.readyState === WebSocket.OPEN)
  }

  function send(data: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return { ok: false as const }
    try {
      ws.send(data)
      return { ok: true as const }
    } catch {
      return { ok: false as const }
    }
  }

  return {
    start,
    stop,
    retry,
    send,
    isConnected,
  }
}
