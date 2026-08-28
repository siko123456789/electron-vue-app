import { useAuthStore } from '@/stores/auth'
import { useNotifyRealtimeStore } from '@/stores/notifyRealtime'
import { fetchOemRecord, refreshNotifySession } from '@/api/notify'
import { logger } from '@/utils/logger'

const DEFAULT_HEARTBEAT_MINUTES = 2
const MIN_HEARTBEAT_MS = DEFAULT_HEARTBEAT_MINUTES * 60 * 1000

let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let inFlight: Promise<boolean> | null = null
let startPromise: Promise<boolean> | null = null
let heartbeatMs = MIN_HEARTBEAT_MS

function clearTimer() {
  if (!timer) return
  clearTimeout(timer)
  timer = null
}

function isAuthExpiredError(error: unknown) {
  const value = error as { code?: unknown; responseData?: { code?: unknown } } | null
  return Number(value?.code) === 1004 || Number(value?.responseData?.code) === 1004
}

function resolveHeartbeatMs(duration: unknown) {
  const minutes = Number(duration)
  if (!Number.isFinite(minutes) || minutes <= 0) return MIN_HEARTBEAT_MS
  return Math.max(DEFAULT_HEARTBEAT_MINUTES, Math.floor(minutes / 2)) * 60 * 1000
}

async function refreshNowInternal() {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const result = await refreshNotifySession()
      const store = useNotifyRealtimeStore()
      if (result?.data && typeof result.data === 'object') {
        store.applySummary(result.data)
      }
      return true
    } catch (error) {
      if (isAuthExpiredError(error)) {
        running = false
        clearTimer()
      } else {
        logger.warn('登录态保活请求失败，将在下个周期重试', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      return false
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

function scheduleNext() {
  clearTimer()
  if (!running) return
  timer = setTimeout(async () => {
    timer = null
    if (!running) return
    await refreshNowInternal()
    scheduleNext()
  }, heartbeatMs)
}

async function startInternal() {
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return false

  running = true
  clearTimer()

  try {
    const oem = await fetchOemRecord()
    heartbeatMs = resolveHeartbeatMs(oem?.data?.duration)
    logger.info('登录态保活已配置', {
      durationMinutes: Number(oem?.data?.duration) || DEFAULT_HEARTBEAT_MINUTES,
      heartbeatMinutes: heartbeatMs / 60_000,
    })
  } catch (error) {
    if (isAuthExpiredError(error)) {
      running = false
      return false
    }
    // OEM 配置暂时不可用时仍按最小安全周期保活。
    heartbeatMs = MIN_HEARTBEAT_MS
    logger.warn('读取 OEM 登录超时配置失败，使用默认保活周期', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const alive = await refreshNowInternal()
  if (!alive) {
    running = false
    clearTimer()
    return false
  }
  scheduleNext()
  return true
}

/** 启动登录态保活；重复调用会复用同一次启动。 */
export function startSessionKeepAlive() {
  if (running) return Promise.resolve(true)
  if (!startPromise) {
    startPromise = startInternal().finally(() => {
      startPromise = null
    })
  }
  return startPromise
}

/** 停止登录态保活。 */
export function stopSessionKeepAlive() {
  running = false
  clearTimer()
}

/** 睡眠恢复或手动恢复时立即试活。 */
export async function refreshSessionNow() {
  if (!running || !useAuthStore().isLoggedIn) return false
  const alive = await refreshNowInternal()
  if (alive) scheduleNext()
  return alive
}

export function isSessionKeepAliveRunning() {
  return running
}
