import { defineStore } from 'pinia'

export type AppAlertVariant = 'risk' | 'todo'

export type AppAlert = {
  id: string
  ts: number
  variant: AppAlertVariant
  title: string
  message: string
  read: boolean
}

type AlertsState = {
  items: AppAlert[]
}

const STORAGE_KEY = 'app_alerts_v1'
const MAX_ITEMS = 200

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function loadInitialItems(): AppAlert[] {
  const parsed = safeParseJson(localStorage.getItem(STORAGE_KEY))
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((x) => x && typeof x === 'object')
    .map((x: any) => ({
      id: String(x.id || ''),
      ts: Number(x.ts || Date.now()),
      variant: (x.variant === 'todo' ? 'todo' : 'risk') as AppAlertVariant,
      title: String(x.title || ''),
      message: String(x.message || ''),
      read: Boolean(x.read),
    }))
    .filter((x) => x.id && x.title)
    .slice(0, MAX_ITEMS)
}

function persist(items: AppAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

export const useAlertsStore = defineStore('alerts', {
  state: (): AlertsState => ({
    items: loadInitialItems(),
  }),
  getters: {
    unreadCount: (state) => state.items.filter((x) => !x.read).length,
  },
  actions: {
    add(payload: { variant?: AppAlertVariant; title: string; message?: string; ts?: number; id?: string }) {
      const id = payload.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`
      const ts = payload.ts || Date.now()
      const variant = payload.variant === 'todo' ? 'todo' : 'risk'
      const title = (payload.title || '').trim()
      const message = (payload.message || '').trim()
      if (!title) return

      const alert: AppAlert = { id, ts, variant, title, message, read: false }
      this.items = [alert, ...this.items].slice(0, MAX_ITEMS)
      persist(this.items)
    },
    markRead(id: string) {
      const found = this.items.find((x) => x.id === id)
      if (!found) return
      if (!found.read) {
        found.read = true
        persist(this.items)
      }
    },
    markAllRead() {
      let changed = false
      this.items.forEach((x) => {
        if (!x.read) {
          x.read = true
          changed = true
        }
      })
      if (changed) persist(this.items)
    },
    clearAll() {
      this.items = []
      persist(this.items)
    },
  },
})
