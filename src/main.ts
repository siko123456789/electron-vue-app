import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { useSettingsStore } from './stores/settings'

// 样式引入顺序很重要
import 'element-plus/dist/index.css'
import './assets/styles/publicClass.css'

import ElementPlus from 'element-plus'

const app = createApp(App)
app.use(ElementPlus)
app.use(pinia)
app.use(router)
app.mount('#app').$nextTick(() => {
  // Electron ipc
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })

  // Sync user settings to main process
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
