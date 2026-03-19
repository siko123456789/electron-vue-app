import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { useSettingsStore } from './stores/settings'
import { useAlertsStore } from './stores/alerts'
import { watch } from 'vue'

// 样式引入顺序很重要
import 'element-plus/dist/index.css'
import './assets/styles/publicClass.css'
import '@/assets/iconfont/iconfont.css'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
app.use(ElementPlus)

// 全局注册 Element Plus 图标组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.mount('#app').$nextTick(() => {
  // Electron ipc
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })

  // 来自主进程的应用警报(即使顶部栏未挂载，仍保持运行)
  try {
    const alerts = useAlertsStore()

    const onAlertFromMain = (_event: any, payload: any) => {
      if (!payload || typeof payload !== 'object') return
      alerts.add({
        id: payload.id ? String(payload.id) : undefined,
        ts: payload.ts ? Number(payload.ts) : undefined,
        variant: payload.variant === 'todo' ? 'todo' : 'risk',
        title: String(payload.title || ''),
        message: payload.message ? String(payload.message) : '',
      })
    }

    const onNavigateFromMain = async (_event: any, payload: any) => {
      const path = typeof payload?.path === 'string' && payload.path ? payload.path : '/events'
      const alertId = payload?.alertId ? String(payload.alertId) : ''
      try {
        await router.push(path)
      } catch {
        // ignore duplicated navigation
      }
      if (alertId) {
        alerts.markRead(alertId)
      }
    }

    const onMarkAllReadFromMain = () => {
      alerts.markAllRead()
    }

    window.ipcRenderer.on('app/alert', onAlertFromMain)
    window.ipcRenderer.on('app/navigate', onNavigateFromMain)
    window.ipcRenderer.on('app/alerts/mark-all-read', onMarkAllReadFromMain)

    const syncUnreadCount = (count: number) => {
      const ipc = (window as any)?.ipcRenderer
      if (!ipc?.invoke) return
      void ipc.invoke('app/set-unread-count', count)
    }

    watch(() => alerts.unreadCount, (count) => syncUnreadCount(count), { immediate: true })
  } catch {
    // ignore
  }

  // 将用户设置同步到主进程
  try {
    const settings = useSettingsStore()
    if ((window as any)?.ipcRenderer?.invoke) {
      void window.ipcRenderer.invoke('app/set-notifications-enabled', settings.notificationsEnabled)
    }
  } catch {
    // ignore
  }

  const tryFlush = async () => {
    try {
      const mod = await import('@/utils/request')
      if (typeof mod.flushOfflineQueue === 'function') {
        const res = await mod.flushOfflineQueue()
        if (res.flushed) console.log('已自动同步离线操作:', res)
      }
    } catch {
      // ignore
    }
  }

  window.addEventListener('online', () => void tryFlush())
  if (navigator.onLine) void tryFlush()
})
