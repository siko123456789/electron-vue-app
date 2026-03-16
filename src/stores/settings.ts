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
}

const STORAGE_KEYS = {
  apiBase: 'apiBase',
  notificationsEnabled: 'notificationsEnabled',
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

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || '',
    notificationsEnabled: readBool(STORAGE_KEYS.notificationsEnabled, true),
  }),
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
  },
})
