import { defineStore } from 'pinia'
import type { NotifySettingData } from '@/api/setting'
import type { NotifySummaryData } from '@/api/riskMonitor'
import { useSettingsStore } from '@/stores/settings'

export type NotifyEventHints = {
  sound?: boolean
  popup?: boolean
  auto_dismiss_seconds?: number
}

export type NotifyRealtimeEvent = {
  id?: number | string
  title?: string
  summary?: string
  message?: string
  priority?: number
  event_type?: string
  event_type_name?: string
  status?: number
  hints?: NotifyEventHints
  [key: string]: unknown
}

export type NotifyPrefsCache = Pick<
  NotifySettingData,
  | 'p0_sound_enabled'
  | 'p0_do_not_disturb_start'
  | 'p0_do_not_disturb_end'
  | 'p0_taskbar_flash_enabled'
  | 'p1_popup_enabled'
  | 'p1_auto_dismiss_seconds'
  | 'p1_popup_when_locked'
  | 'p2_workbench_enabled'
>

type NotifyRealtimeState = {
  connected: boolean
  /** 连续重连已放弃 */
  gaveUp: boolean
  reconnectAttempt: number
  maxReconnectAttempts: number
  lastStatusMsg: string
  summary: NotifySummaryData
  summaryRevision: number
  listRevision: number
  lastEventId: string | number | null
  /** 桌面/托盘点击后要定位的告警 id */
  focusAlertId: string | null
  focusRevision: number
  prefs: NotifyPrefsCache
}

function emptySummary(): NotifySummaryData {
  return { all: 0, p0: 0, p1: 0, p2: 0, pending: 0, handled: 0, total: 0 }
}

function parseHmToMinutes(value: string | undefined): number | null {
  const text = String(value || '').trim()
  const m = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return h * 60 + min
}

/** 判断当前是否落在 P0 勿扰时段（支持跨午夜） */
function isInDoNotDisturb(start?: string, end?: string): boolean {
  const s = parseHmToMinutes(start)
  const e = parseHmToMinutes(end)
  if (s === null || e === null) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  if (s === e) return true
  if (s < e) return cur >= s && cur < e
  return cur >= s || cur < e
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

export const useNotifyRealtimeStore = defineStore('notifyRealtime', {
  state: (): NotifyRealtimeState => ({
    connected: false,
    gaveUp: false,
    reconnectAttempt: 0,
    maxReconnectAttempts: 5,
    lastStatusMsg: '',
    summary: emptySummary(),
    summaryRevision: 0,
    listRevision: 0,
    lastEventId: null,
    focusAlertId: null,
    focusRevision: 0,
    prefs: {
      p0_sound_enabled: 1,
      p0_do_not_disturb_start: '',
      p0_do_not_disturb_end: '',
      p0_taskbar_flash_enabled: 1,
      p1_popup_enabled: 1,
      p1_auto_dismiss_seconds: 5,
      p1_popup_when_locked: 0,
      p2_workbench_enabled: 1,
    },
  }),
  actions: {
    setConnected(value: boolean) {
      this.connected = Boolean(value)
      if (value) {
        this.gaveUp = false
        this.reconnectAttempt = 0
        this.lastStatusMsg = ''
      }
    },
    applyConnectionStatus(status: {
      connected?: boolean
      gaveUp?: boolean
      reconnecting?: boolean
      attempt?: number
      attempts?: number
      maxAttempts?: number
      msg?: string
      stopped?: boolean
    } | null | undefined) {
      if (!status || typeof status !== 'object') return
      if (status.connected !== undefined) this.connected = Boolean(status.connected)
      if (status.gaveUp !== undefined) this.gaveUp = Boolean(status.gaveUp)
      if (status.maxAttempts !== undefined) {
        this.maxReconnectAttempts = Number(status.maxAttempts) || 5
      }
      const attempt = status.attempt ?? status.attempts
      if (attempt !== undefined) this.reconnectAttempt = Number(attempt) || 0
      if (status.msg) this.lastStatusMsg = String(status.msg)
      if (status.connected) {
        this.gaveUp = false
        this.reconnectAttempt = 0
        this.lastStatusMsg = ''
      }
    },
    cachePrefsFromSetting(data: Partial<NotifySettingData> | null | undefined) {
      if (!data || typeof data !== 'object') return
      const next: NotifyPrefsCache = { ...this.prefs }
      if (data.p0_sound_enabled !== undefined) next.p0_sound_enabled = Number(data.p0_sound_enabled) ? 1 : 0
      if (data.p0_do_not_disturb_start !== undefined) {
        next.p0_do_not_disturb_start = String(data.p0_do_not_disturb_start || '')
      }
      if (data.p0_do_not_disturb_end !== undefined) {
        next.p0_do_not_disturb_end = String(data.p0_do_not_disturb_end || '')
      }
      if (data.p0_taskbar_flash_enabled !== undefined) {
        next.p0_taskbar_flash_enabled = Number(data.p0_taskbar_flash_enabled) ? 1 : 0
      }
      if (data.p1_popup_enabled !== undefined) next.p1_popup_enabled = Number(data.p1_popup_enabled) ? 1 : 0
      if (data.p1_auto_dismiss_seconds !== undefined) {
        next.p1_auto_dismiss_seconds = Math.max(1, Number(data.p1_auto_dismiss_seconds) || 5)
      }
      if (data.p1_popup_when_locked !== undefined) {
        next.p1_popup_when_locked = Number(data.p1_popup_when_locked) ? 1 : 0
      }
      if (data.p2_workbench_enabled !== undefined) {
        next.p2_workbench_enabled = Number(data.p2_workbench_enabled) ? 1 : 0
      }
      this.prefs = next
    },
    applySummary(raw: Partial<NotifySummaryData> | null | undefined) {
      if (!raw || typeof raw !== 'object') return
      this.summary = {
        all: Number(raw.all) || 0,
        p0: Number(raw.p0) || 0,
        p1: Number(raw.p1) || 0,
        p2: Number(raw.p2) || 0,
        pending: Number(raw.pending) || 0,
        handled: Number(raw.handled) || 0,
        total: Number(raw.total) || Number(raw.all) || 0,
      }
      this.summaryRevision += 1

      // 严格按通知配置：任务栏闪烁 / 托盘角标只跟「未处理 P0」走
      const p0 = this.summary.p0
      const flash = this.prefs.p0_taskbar_flash_enabled !== 0 && p0 > 0
      void window.ipcRenderer?.invoke('app/set-unread-count', { count: p0, flash })
    },
    bumpList(eventId?: string | number | null) {
      if (eventId !== undefined && eventId !== null) this.lastEventId = eventId
      this.listRevision += 1
    },
    requestFocusAlert(alertId: string) {
      const id = String(alertId || '').trim()
      if (!id) return
      this.focusAlertId = id
      this.focusRevision += 1
    },
    consumeFocusAlert() {
      const id = this.focusAlertId
      this.focusAlertId = null
      return id
    },
    /**
     * 处理服务端 event：hints + 本地通知偏好 + 锁屏策略 → 桌面弹窗/响铃
     */
    handleIncomingEvent(raw: NotifyRealtimeEvent | null | undefined) {
      if (!raw || typeof raw !== 'object') return

      const settings = useSettingsStore()
      const priority = Number(raw.priority)
      const hints = raw.hints && typeof raw.hints === 'object' ? raw.hints : {}

      let sound = false
      let popup = false
      let autoDismissSeconds = 5

      if (priority === 0) {
        // P0：强提醒弹窗驻留；声音受开关 + 勿扰控制
        popup = true
        sound = this.prefs.p0_sound_enabled !== 0
        if (isInDoNotDisturb(this.prefs.p0_do_not_disturb_start, this.prefs.p0_do_not_disturb_end)) {
          sound = false
        }
        autoDismissSeconds = 0 // 驻留到点击
        if (hints.sound !== undefined) sound = asBool(hints.sound, sound)
      } else if (priority === 1) {
        // P1：仅限时弹窗，不进托盘闪烁列表
        popup = this.prefs.p1_popup_enabled !== 0
        sound = false
        autoDismissSeconds = Math.max(1, Number(this.prefs.p1_auto_dismiss_seconds) || 5)
        if (hints.popup !== undefined) popup = asBool(hints.popup, popup)
        if (hints.auto_dismiss_seconds != null) {
          autoDismissSeconds = Math.max(1, Number(hints.auto_dismiss_seconds) || autoDismissSeconds)
        }
      } else {
        // P2：默认不弹窗，进列表（列表过滤由监测页处理）
        popup = asBool(hints.popup, false)
        sound = asBool(hints.sound, false)
        autoDismissSeconds = 3
      }

      if (settings.isLocked) {
        if (priority === 0) {
          if (!settings.p0NotifyWhenLocked) {
            sound = false
            popup = false
          }
        } else if (priority === 1) {
          if (this.prefs.p1_popup_when_locked !== 1) {
            popup = false
            sound = false
          }
        } else {
          popup = false
          sound = false
        }
      }

      if (!settings.notificationsEnabled) {
        sound = false
        popup = false
      }

      this.bumpList(raw.id ?? null)

      if (!popup || !window.ipcRenderer?.invoke) return

      const title =
        String(raw.title || raw.event_type_name || '风险告警').trim() || '风险告警'
      const message =
        String(raw.summary || raw.message || '').trim() || '收到新的风险告警，请及时处理'

      void window.ipcRenderer.invoke('app/show-alert', {
        id: raw.id != null ? String(raw.id) : undefined,
        title,
        message,
        variant: 'risk',
        sound: Boolean(sound),
        priority,
        autoDismissSeconds,
      })
    },
  },
})
