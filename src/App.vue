<template>
  <div class="app-layout" :class="{ 'is-login': isLoginPage }">
    <Topbar v-if="!isLoginPage" />
    <template v-else-if="framelessWindow">
      <div class="login-drag" aria-hidden="true" @dblclick="toggleMaximize" />
      <div class="login-chrome">
        <button
          class="login-theme-toggle"
          type="button"
          :aria-label="
            settingsStore.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式'
          "
          :title="
            settingsStore.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式'
          "
          @click="settingsStore.toggleColorTheme()"
        >
          <el-icon>
            <Moon v-if="settingsStore.colorTheme === 'dark'" />
            <Sunny v-else />
          </el-icon>
        </button>
        <WindowControls />
      </div>
    </template>
    <button
      v-else-if="isLoginPage"
      class="login-theme-toggle login-theme-toggle--solo"
      type="button"
      :aria-label="
        settingsStore.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式'
      "
      :title="
        settingsStore.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式'
      "
      @click="settingsStore.toggleColorTheme()"
    >
      <el-icon>
        <Moon v-if="settingsStore.colorTheme === 'dark'" />
        <Sunny v-else />
      </el-icon>
    </button>
    <main class="app-content">
      <router-view />
    </main>
    <AppLockOverlay />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Moon, Sunny } from '@element-plus/icons-vue'
import { fetchNotifySetting } from '@/api/setting'
import { useIdleAutoLock } from '@/composables/useIdleAutoLock'
import {
  cacheStorageCleanupPrefs,
  runStorageAutoCleanup,
} from '@/utils/storageCleanup'
import { startNotifyRealtime, stopNotifyRealtime } from '@/utils/notifyWebSocket'
import {
  refreshSessionNow,
  startSessionKeepAlive,
  stopSessionKeepAlive,
} from '@/utils/sessionKeepAlive'
import { resetAuthExpiredEvent } from '@/utils/request'
import { useAuthStore } from './stores/auth'
import { useNotifyRealtimeStore } from './stores/notifyRealtime'
import { useSettingsStore } from './stores/settings'
import Topbar from './components/Topbar.vue'
import WindowControls from './components/WindowControls.vue'
import AppLockOverlay from './components/AppLockOverlay.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const notifyRealtime = useNotifyRealtimeStore()
const framelessWindow = ref(Boolean(window.ipcRenderer?.invoke))
const isLoginPage = computed(() => route.path === '/login')

useIdleAutoLock()

function toggleMaximize() {
  void window.ipcRenderer?.invoke('window/maximize-toggle')
}

/** 登录后拉取服务端应用锁配置，驱动空闲自动锁定 */
async function syncRemoteAppLock() {
  if (!authStore.isLoggedIn || route.path === '/login') return
  try {
    const res = await fetchNotifySetting()
    if (res?.code !== 0 || !res.data) return
    settingsStore.syncAppLockFromRemote({
      app_lock_enabled: res.data.app_lock_enabled,
      auto_lock_minutes: res.data.auto_lock_minutes,
    })
    notifyRealtime.cachePrefsFromSetting(res.data)
    cacheStorageCleanupPrefs({
      auto_cleanup_enabled: Number(res.data.auto_cleanup_enabled) === 1 ? 1 : 0,
      cleanup_interval_days: Math.max(1, Number(res.data.cleanup_interval_days) || 7),
      data_retention_days: Math.max(1, Number(res.data.data_retention_days) || 30),
    })
    void runStorageAutoCleanup()
  } catch {
    // 接口失败时沿用本地缓存的 autoLockMinutes / 清理偏好
  }
}

onMounted(async () => {
  void syncRemoteAppLock()
  if (authStore.isLoggedIn) void startSessionServices()

  const handleAuthExpired = () => {
    stopSessionKeepAlive()
    void stopNotifyRealtime()
    void window.ipcRenderer?.invoke('app/auth-expired')
  }
  window.addEventListener('app-auth-expired', handleAuthExpired)

  if (window.ipcRenderer?.on) {
    window.ipcRenderer.on('app/navigate', (_event, payload: { path?: string; alertId?: string }) => {
      const path = String(payload?.path || '').trim() || '/risk-monitor'
      const alertId = String(payload?.alertId || '').trim()
      if (alertId) {
        void router.push({ path, query: { alertId } })
      } else if (path) {
        void router.push(path)
      }
    })
    window.ipcRenderer.on('app/alerts/mark-all-read', () => {
      notifyRealtime.summary = {
        ...notifyRealtime.summary,
        p0: 0,
      }
      void window.ipcRenderer?.invoke('app/set-unread-count', { count: 0, flash: false })
      void window.ipcRenderer?.invoke('app/alert-clear-p0')
    })
    window.ipcRenderer.on('app/system-resume', () => {
      void refreshSessionNow().then((alive) => {
        if (alive && authStore.isLoggedIn) void startNotifyRealtime()
      })
    })
  }

  if (!window.ipcRenderer?.invoke) {
    framelessWindow.value = false
    return
  }
  try {
    framelessWindow.value = Boolean(await window.ipcRenderer.invoke('app/use-frameless-window'))
  } catch {
    framelessWindow.value = false
  }
})

async function startSessionServices() {
  resetAuthExpiredEvent()
  void window.ipcRenderer?.invoke('app/auth-expired-clear')
  const alive = await startSessionKeepAlive()
  if (alive && authStore.isLoggedIn) await startNotifyRealtime()
}

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      void syncRemoteAppLock()
      void startSessionServices()
    } else {
      stopSessionKeepAlive()
      void stopNotifyRealtime()
    }
  },
)
</script>

<style scoped>
.app-layout {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
}

.app-layout.is-login {
  background: var(--c-bg);
}

.app-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-content > * {
  flex: 1;
  min-height: 0;
}

.login-drag {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 15;
  height: 48px;
  -webkit-app-region: drag;
}

.login-chrome {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  -webkit-app-region: no-drag;
}

.login-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--c-text-muted);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.login-theme-toggle:hover {
  color: var(--c-primary-light);
  background: var(--c-bg-hover);
}

.login-theme-toggle--solo {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 20;
}
</style>
