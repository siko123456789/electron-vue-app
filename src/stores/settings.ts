import { defineStore } from 'pinia'
import { applyColorTheme, getStoredColorTheme, type ColorTheme } from '@/utils/theme'

type SettingsState = {
  /**
   * API baseURL used by axios.
   * - Empty means use default '/api' (Vite dev proxy friendly)
   * - Absolute URL will be normalized to include '/api' suffix
   */
  apiBase: string

  /** Whether to enable app notifications (sound/popup). */
  notificationsEnabled: boolean

  /** Whether app lock is enabled. */
  lockEnabled: boolean

  /** Salted password hash for app lock. */
  lockPasswordHash: string

  /** Salt used for password hashing. */
  lockPasswordSalt: string

  /** Runtime-only lock flag. */
  isLocked: boolean

  /** 锁定期间是否仍接收 P0 紧急通知（本机） */
  p0NotifyWhenLocked: boolean

  /**
   * 服务端同步的空闲自动锁定分钟数。
   * 0 = 关闭自动锁定（仍可手动锁）；>0 且本机有密码时启用空闲监听
   */
  autoLockMinutes: number

  /** 是否记住登录状态（持久化 token/userInfo） */
  rememberLogin: boolean

  /** 颜色模式：light | dark */
  colorTheme: ColorTheme
}

const STORAGE_KEYS = {
  apiBase: 'apiBase',
  notificationsEnabled: 'notificationsEnabled',
  lockEnabled: 'lockEnabled',
  lockPasswordHash: 'lockPasswordHash',
  lockPasswordSalt: 'lockPasswordSalt',
  p0NotifyWhenLocked: 'p0NotifyWhenLocked',
  autoLockMinutes: 'autoLockMinutes',
  rememberLogin: 'rememberLogin',
} as const

function readBool(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return fallback
}

function readNonNegInt(key: string, fallback: number) {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const num = Number(raw)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.round(num)
}

function normalizeApiBase(input: string): string {
  const raw = (input || '').trim()
  if (!raw) return ''

  const noTrailingSlash = raw.replace(/\/+$/, '')

  if (/^https?:\/\//i.test(noTrailingSlash)) {
    try {
      const url = new URL(noTrailingSlash)
      const pathname = url.pathname.replace(/\/+$/, '')
      if (!pathname || pathname === '') {
        url.pathname = '/api'
        return url.toString().replace(/\/+$/, '')
      }
      if (pathname === '/api') return url.toString().replace(/\/+$/, '')
      url.pathname = `${pathname}/api`.replace(/\/{2,}/g, '/')
      return url.toString().replace(/\/+$/, '')
    } catch {
      return noTrailingSlash
    }
  }

  // Relative path like '/api' or '/backend'
  return noTrailingSlash
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

async function sha256(text: string) {
  const encoded = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return bytesToHex(new Uint8Array(digest))
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || '',
    notificationsEnabled: readBool(STORAGE_KEYS.notificationsEnabled, true),
    lockEnabled: readBool(STORAGE_KEYS.lockEnabled, false),
    lockPasswordHash: localStorage.getItem(STORAGE_KEYS.lockPasswordHash) || '',
    lockPasswordSalt: localStorage.getItem(STORAGE_KEYS.lockPasswordSalt) || '',
    isLocked: false,
    p0NotifyWhenLocked: (() => {
      const key = STORAGE_KEYS.p0NotifyWhenLocked
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, '1')
        return true
      }
      return readBool(key, true)
    })(),
    autoLockMinutes: readNonNegInt(STORAGE_KEYS.autoLockMinutes, 0),
    rememberLogin: readBool(STORAGE_KEYS.rememberLogin, true),
    colorTheme: getStoredColorTheme(),
  }),
  getters: {
    // 有本机锁屏密码即可手动锁定；自动锁定由 auto_lock_minutes 单独控制
    hasLockPassword: (state) => Boolean(state.lockPasswordHash && state.lockPasswordSalt),
    /** 是否应启用空闲自动锁定监听 */
    shouldAutoLock: (state) =>
      Boolean(state.lockPasswordHash && state.lockPasswordSalt && state.autoLockMinutes > 0),
  },
  actions: {
    setApiBase(value: string) {
      const normalized = normalizeApiBase(value)
      this.apiBase = normalized
      if (normalized) localStorage.setItem(STORAGE_KEYS.apiBase, normalized)
      else localStorage.removeItem(STORAGE_KEYS.apiBase)
    },
    setNotificationsEnabled(value: boolean) {
      this.notificationsEnabled = Boolean(value)
      localStorage.setItem(STORAGE_KEYS.notificationsEnabled, this.notificationsEnabled ? '1' : '0')
    },
    setP0NotifyWhenLocked(value: boolean) {
      this.p0NotifyWhenLocked = Boolean(value)
      localStorage.setItem(STORAGE_KEYS.p0NotifyWhenLocked, this.p0NotifyWhenLocked ? '1' : '0')
    },
    setLockEnabledFlag(value: boolean) {
      this.lockEnabled = Boolean(value)
      localStorage.setItem(STORAGE_KEYS.lockEnabled, this.lockEnabled ? '1' : '0')
      if (!this.lockEnabled) {
        this.isLocked = false
      }
    },
    setAutoLockMinutes(minutes: number) {
      const next = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0
      this.autoLockMinutes = next
      localStorage.setItem(STORAGE_KEYS.autoLockMinutes, String(next))
    },
    setRememberLogin(value: boolean) {
      this.rememberLogin = Boolean(value)
      localStorage.setItem(STORAGE_KEYS.rememberLogin, this.rememberLogin ? '1' : '0')
    },
    /**
     * 从 GET /notify/setting 同步应用锁相关字段。
     * auto_lock_minutes > 0 视为开启空闲自动锁定；否则仅手动锁定。
     */
    syncAppLockFromRemote(payload: {
      app_lock_enabled?: number
      auto_lock_minutes?: number
    }) {
      const minutesRaw = Number(payload.auto_lock_minutes)
      const minutes =
        Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.round(minutesRaw) : 0
      this.setAutoLockMinutes(minutes)

      const apiEnabled = Number(payload.app_lock_enabled) === 1
      // 有本机密码时以本机为准；接口标记用于对齐 lockEnabled 开关
      if (this.hasLockPassword) {
        this.setLockEnabledFlag(true)
      } else if (!apiEnabled) {
        this.setLockEnabledFlag(false)
      }
    },
    async setLockPassword(password: string) {
      const normalized = String(password || '').trim()
      if (normalized.length < 4) {
        throw new Error('锁屏密码至少需要 4 位')
      }

      const salt = createSalt()
      const hash = await sha256(`${salt}:${normalized}`)

      this.lockEnabled = true
      this.lockPasswordSalt = salt
      this.lockPasswordHash = hash

      localStorage.setItem(STORAGE_KEYS.lockEnabled, '1')
      localStorage.setItem(STORAGE_KEYS.lockPasswordSalt, salt)
      localStorage.setItem(STORAGE_KEYS.lockPasswordHash, hash)
    },
    async verifyLockPassword(password: string) {
      if (!this.hasLockPassword) return true
      const normalized = String(password || '')
      const hash = await sha256(`${this.lockPasswordSalt}:${normalized}`)
      return hash === this.lockPasswordHash
    },
    lockApp() {
      if (!this.hasLockPassword) return
      this.isLocked = true
    },
    unlockApp() {
      this.isLocked = false
    },
    disableLock() {
      this.lockEnabled = false
      this.lockPasswordHash = ''
      this.lockPasswordSalt = ''
      this.isLocked = false
      this.setAutoLockMinutes(0)

      localStorage.setItem(STORAGE_KEYS.lockEnabled, '0')
      localStorage.removeItem(STORAGE_KEYS.lockPasswordHash)
      localStorage.removeItem(STORAGE_KEYS.lockPasswordSalt)
    },
    setColorTheme(theme: ColorTheme) {
      this.colorTheme = theme
      applyColorTheme(theme)
    },
    toggleColorTheme() {
      this.setColorTheme(this.colorTheme === 'light' ? 'dark' : 'light')
    },
  },
})
