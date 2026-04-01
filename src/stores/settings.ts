import { defineStore } from 'pinia'

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
}

const STORAGE_KEYS = {
  apiBase: 'apiBase',
  notificationsEnabled: 'notificationsEnabled',
  lockEnabled: 'lockEnabled',
  lockPasswordHash: 'lockPasswordHash',
  lockPasswordSalt: 'lockPasswordSalt',
} as const

function readBool(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return fallback
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
  }),
  getters: {
    hasLockPassword: (state) => Boolean(state.lockEnabled && state.lockPasswordHash && state.lockPasswordSalt),
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

      localStorage.setItem(STORAGE_KEYS.lockEnabled, '0')
      localStorage.removeItem(STORAGE_KEYS.lockPasswordHash)
      localStorage.removeItem(STORAGE_KEYS.lockPasswordSalt)
    },
  },
})
