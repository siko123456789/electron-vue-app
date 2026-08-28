<template>
  <header class="topbar" @dblclick="handleDoubleClick">
    <div class="brand" role="link" tabindex="0" @click="goHome" @keydown.enter="goHome">
      <img :src="logoSrc" alt="风险治理系统" @error="handleLogoError" />
      <div>
        <strong>风险治理系统</strong>
        <span>Sentinel</span>
      </div>
    </div>

    <div class="topbar-center">
      <div
        v-if="showNotifyReconnect"
        class="notify-conn"
        :class="{ 'is-gave-up': notifyRealtime.gaveUp, 'is-retrying': isNotifyRetrying }"
        role="status"
      >
        <span class="notify-conn__dot" aria-hidden="true" />
        <span class="notify-conn__text">{{ notifyStatusText }}</span>
        <button
          class="notify-conn__btn"
          type="button"
          :disabled="retryLoading"
          @click="handleRetryNotify"
        >
          {{ retryLoading ? '连接中…' : '重新连接' }}
        </button>
      </div>
    </div>

    <div class="topbar-actions">
      <div class="topbar-tools" role="toolbar" aria-label="快捷操作">
        <button
          class="tool-btn"
          type="button"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="settingsStore.toggleColorTheme()"
        >
          <el-icon>
            <Moon v-if="settingsStore.colorTheme === 'dark'" />
            <Sunny v-else />
          </el-icon>
        </button>

        <button
          class="tool-btn"
          type="button"
          aria-label="锁定应用"
          title="锁定应用"
          :disabled="!settingsStore.hasLockPassword"
          @click="lockApp"
        >
          <el-icon><Lock /></el-icon>
        </button>

        <button
          class="tool-btn"
          type="button"
          :class="{ 'is-active': isSettingsPage }"
          :aria-label="isSettingsPage ? '返回风险监测' : '设置'"
          :title="isSettingsPage ? '返回风险监测' : '设置'"
          @click="toggleSettings"
        >
          <el-icon><Setting /></el-icon>
        </button>

        <button
          class="tool-btn tool-btn--danger"
          type="button"
          aria-label="退出登录"
          title="退出登录"
          :disabled="logoutLoading"
          @click="handleLogout"
        >
          <el-icon><SwitchButton /></el-icon>
        </button>
      </div>

      <span v-if="framelessWindow" class="topbar-divider" aria-hidden="true" />
      <WindowControls v-if="framelessWindow" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, Moon, Setting, Sunny, SwitchButton } from '@element-plus/icons-vue'
import { logout } from '@/api/login'
import { useAuthStore } from '@/stores/auth'
import { useNotifyRealtimeStore } from '@/stores/notifyRealtime'
import { useSettingsStore } from '@/stores/settings'
import { HOME_PATH } from '@/router'
import { clearApiCache, clearOfflineQueue } from '@/utils/request'
import { retryNotifyRealtime } from '@/utils/notifyWebSocket'
import WindowControls from '@/components/WindowControls.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const notifyRealtime = useNotifyRealtimeStore()
const logoSrc = `${import.meta.env.BASE_URL}lanhu_logo.ico`
const framelessWindow = ref(Boolean(window.ipcRenderer?.invoke))
const logoutLoading = ref(false)
const retryLoading = ref(false)

const isSettingsPage = computed(() => route.path === '/settings')
const themeLabel = computed(() =>
  settingsStore.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式',
)

/** 放弃重连，或正在自动重试时：顶栏露出手动重连 */
const showNotifyReconnect = computed(() => {
  if (!authStore.isLoggedIn) return false
  if (notifyRealtime.gaveUp) return true
  if (!notifyRealtime.connected && notifyRealtime.reconnectAttempt > 0) return true
  return false
})

const isNotifyRetrying = computed(
  () =>
    !notifyRealtime.connected &&
    !notifyRealtime.gaveUp &&
    notifyRealtime.reconnectAttempt > 0,
)

const notifyStatusText = computed(() => {
  if (notifyRealtime.gaveUp) {
    return notifyRealtime.lastStatusMsg || '实时通知已断开'
  }
  const cur = notifyRealtime.reconnectAttempt
  const max = notifyRealtime.maxReconnectAttempts || 5
  return `实时通知重连中 ${cur}/${max}`
})

async function handleRetryNotify() {
  if (retryLoading.value) return
  retryLoading.value = true
  try {
    await retryNotifyRealtime()
    ElMessage.success('正在重新连接通知服务…')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新连接失败')
  } finally {
    window.setTimeout(() => {
      retryLoading.value = false
    }, 800)
  }
}

function handleLogoError(event: Event) {
  const target = event.target as HTMLImageElement
  target.style.visibility = 'hidden'
}

function goHome() {
  if (route.path !== HOME_PATH) {
    void router.push(HOME_PATH)
  }
}

/** 设置按钮切换：设置页 ↔ 风险监测 */
function toggleSettings() {
  if (route.path === '/settings') {
    void router.push(HOME_PATH)
    return
  }
  void router.push('/settings')
}

function lockApp() {
  if (!settingsStore.hasLockPassword) {
    ElMessage.warning('当前未设置应用锁密码')
    return
  }
  settingsStore.lockApp()
  ElMessage.success('应用已锁定')
}

async function handleLogout() {
  if (logoutLoading.value) return
  logoutLoading.value = true
  try {
    try {
      await logout()
    } catch {
      // 接口失败也继续本地退出，方便联调登录
    }
    authStore.clearAuth()
    settingsStore.unlockApp()
    clearApiCache()
    clearOfflineQueue()
    try {
      localStorage.removeItem('ipc_cookie_v1')
    } catch {
      // ignore
    }
    ElMessage.success('已退出登录')
    await router.replace('/login')
  } finally {
    logoutLoading.value = false
  }
}

function handleDoubleClick(event: MouseEvent) {
  if (!framelessWindow.value) return
  const target = event.target
  if (
    !(target instanceof HTMLElement) ||
    target.closest('button, .window-controls, .brand, .notify-conn')
  ) {
    return
  }
  void window.ipcRenderer?.invoke('window/maximize-toggle')
}

onMounted(async () => {
  if (!window.ipcRenderer?.invoke) {
    framelessWindow.value = false
    return
  }

  try {
    framelessWindow.value = Boolean(
      await window.ipcRenderer.invoke('app/use-frameless-window'),
    )
  } catch {
    framelessWindow.value = false
  }
})
</script>

<style scoped lang="scss">
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 56px;
  padding: 0 16px 0 20px;
  color: var(--c-text);
  background: var(--shell-bg);
  border-bottom: 1px solid var(--c-border);
  -webkit-app-region: drag;
}

.brand,
.topbar-actions,
.topbar-center,
.tool-btn,
.notify-conn {
  -webkit-app-region: no-drag;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 8px;
  outline: none;
}

.brand:hover strong {
  color: var(--c-primary);
}

.brand img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.brand div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand strong {
  font-size: 15px;
  letter-spacing: 0.02em;
  transition: color 0.15s ease;
}

.brand span {
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.topbar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.notify-conn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--c-warn) 45%, var(--c-border));
  background: color-mix(in srgb, var(--c-warn-bg, #fff7e6) 92%, transparent);
  color: var(--c-warn);
}

.notify-conn.is-gave-up {
  border-color: color-mix(in srgb, var(--c-danger, #e81123) 40%, var(--c-border));
  background: color-mix(in srgb, var(--c-danger-bg, rgba(232, 17, 35, 0.08)) 92%, transparent);
  color: var(--c-danger, #e81123);
}

.notify-conn__dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}

.notify-conn.is-retrying .notify-conn__dot {
  animation: notify-pulse 1.2s ease-in-out infinite;
}

@keyframes notify-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.notify-conn__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.notify-conn__btn {
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--c-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.notify-conn.is-gave-up .notify-conn__btn {
  background: var(--c-danger, #e81123);
}

.notify-conn__btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.notify-conn__btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  flex-shrink: 0;
}

.topbar-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--c-bg-input) 88%, transparent);
  border: 1px solid var(--c-border-light);
}

.tool-btn {
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
  transition: color 0.15s ease, background 0.15s ease;
}

.tool-btn :deep(.el-icon) {
  font-size: 16px;
}

.tool-btn:hover:not(:disabled) {
  color: var(--c-text);
  background: var(--c-bg-hover);
}

.tool-btn.is-active {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

.tool-btn--danger:hover:not(:disabled) {
  color: #e81123;
  background: rgba(232, 17, 35, 0.08);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.topbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--c-border);
}
</style>
