import { defineStore } from 'pinia'

type SettingsState = {
  /**
   * API baseURL used by axios.
   * - Empty means use default '/api' (Vite dev proxy friendly)
   * - Absolute URL will be normalized to include '/api' suffix
   */
  apiBase: string
}

const STORAGE_KEY = 'apiBase'

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
    apiBase: localStorage.getItem(STORAGE_KEY) || '',
  }),
  actions: {
    setApiBase(value: string) {
      const normalized = normalizeApiBase(value)
      this.apiBase = normalized
      if (normalized) localStorage.setItem(STORAGE_KEY, normalized)
      else localStorage.removeItem(STORAGE_KEY)
    },
  },
})

