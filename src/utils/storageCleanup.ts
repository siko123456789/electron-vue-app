const LAST_CLEANUP_KEY = 'storage.lastAutoCleanupAt'
const SETTINGS_CACHE_KEY = 'storage.cleanupPrefs'

export type StorageCleanupPrefs = {
  auto_cleanup_enabled: number
  cleanup_interval_days: number
  /** 日志保留天数；引擎缓存清理时整清 */
  data_retention_days: number
}

export type CleanupLogsResult = {
  removed: number
  kept: number
  freedBytes: number
  retentionDays: number
}

export type ClearEngineCacheResult = {
  ok: boolean
  message?: string
}

/** 缓存清理偏好到本机，便于启动时判断是否到期 */
export function cacheStorageCleanupPrefs(prefs: StorageCleanupPrefs) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export function readCachedStorageCleanupPrefs(): StorageCleanupPrefs | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StorageCleanupPrefs
    return {
      auto_cleanup_enabled: Number(parsed.auto_cleanup_enabled) === 1 ? 1 : 0,
      cleanup_interval_days: Math.max(1, Number(parsed.cleanup_interval_days) || 7),
      data_retention_days: Math.max(1, Number(parsed.data_retention_days) || 30),
    }
  } catch {
    return null
  }
}

function markCleanupRan() {
  localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()))
}

function isCleanupDue(intervalDays: number) {
  const intervalMs = Math.max(1, intervalDays) * 24 * 60 * 60 * 1000
  const lastRaw = localStorage.getItem(LAST_CLEANUP_KEY)
  const lastAt = lastRaw ? Number(lastRaw) : 0
  return !Number.isFinite(lastAt) || lastAt <= 0 || Date.now() - lastAt >= intervalMs
}

/** 清理过期应用日志（主进程） */
export async function cleanupAppLogs(retentionDays: number): Promise<CleanupLogsResult> {
  if (!window.ipcRenderer?.invoke) {
    return { removed: 0, kept: 0, freedBytes: 0, retentionDays }
  }
  const res = (await window.ipcRenderer.invoke(
    'app/cleanup-logs',
    retentionDays,
  )) as CleanupLogsResult
  return {
    removed: Number(res?.removed) || 0,
    kept: Number(res?.kept) || 0,
    freedBytes: Number(res?.freedBytes) || 0,
    retentionDays: Number(res?.retentionDays) || retentionDays,
  }
}

/** 清理 Chromium 引擎缓存（主进程） */
export async function clearEngineCache(): Promise<ClearEngineCacheResult> {
  if (!window.ipcRenderer?.invoke) {
    return { ok: false, message: '当前非桌面环境，无法清理引擎缓存' }
  }
  const res = (await window.ipcRenderer.invoke('app/clear-engine-cache')) as ClearEngineCacheResult
  return {
    ok: Boolean(res?.ok),
    message: res?.message,
  }
}

/**
 * 自动清理：到期后清过期日志 + 引擎缓存
 * - cleanup_interval_days：隔多少天跑一次
 * - data_retention_days：日志保留多久
 */
export async function runStorageAutoCleanup(prefs?: StorageCleanupPrefs | null) {
  const conf = prefs || readCachedStorageCleanupPrefs()
  if (!conf || conf.auto_cleanup_enabled !== 1) {
    return { ran: false, logsRemoved: 0, engineOk: false as boolean | null }
  }
  if (!isCleanupDue(conf.cleanup_interval_days)) {
    return { ran: false, logsRemoved: 0, engineOk: false as boolean | null }
  }

  const logs = await cleanupAppLogs(conf.data_retention_days)
  const engine = await clearEngineCache()
  markCleanupRan()

  return {
    ran: true,
    logsRemoved: logs.removed,
    freedBytes: logs.freedBytes,
    engineOk: engine.ok,
  }
}

/** 手动一键：过期日志 + 引擎缓存 */
export async function runManualStorageCleanup(options?: {
  retentionDays?: number
  cleanLogs?: boolean
  cleanEngine?: boolean
}) {
  const cleanLogs = options?.cleanLogs !== false
  const cleanEngine = options?.cleanEngine !== false
  const retentionDays = Math.max(1, options?.retentionDays ?? 30)

  let logsRemoved = 0
  let freedBytes = 0
  let engineOk: boolean | null = null

  if (cleanLogs) {
    const logs = await cleanupAppLogs(retentionDays)
    logsRemoved = logs.removed
    freedBytes = logs.freedBytes
  }
  if (cleanEngine) {
    const engine = await clearEngineCache()
    engineOk = engine.ok
  }

  markCleanupRan()
  return { logsRemoved, freedBytes, engineOk }
}
