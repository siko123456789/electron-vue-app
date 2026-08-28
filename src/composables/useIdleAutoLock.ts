import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'wheel',
  'touchstart',
  'pointerdown',
] as const

/** 鼠标移动节流，避免高频重置 */
const MOVE_THROTTLE_MS = 800

/**
 * 空闲自动锁定：
 * - 本机有锁屏密码且 autoLockMinutes > 0 时监听
 * - 用户操作重置计时；连续空闲达到分钟数 → lockApp()
 * - 已锁定 / 登录页 时暂停
 */
export function useIdleAutoLock() {
  const route = useRoute()
  const auth = useAuthStore()
  const settings = useSettingsStore()
  const { isLocked, autoLockMinutes } = storeToRefs(settings)

  let timerId: ReturnType<typeof setTimeout> | null = null
  let lastMoveAt = 0
  let listening = false

  function clearTimer() {
    if (timerId != null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  function canWatch() {
    return (
      auth.isLoggedIn &&
      settings.shouldAutoLock &&
      !settings.isLocked &&
      route.path !== '/login' &&
      route.meta?.requiresAuth !== false
    )
  }

  function armTimer() {
    clearTimer()
    if (!canWatch()) return
    const ms = Math.max(1, settings.autoLockMinutes) * 60 * 1000
    timerId = setTimeout(() => {
      if (!canWatch()) return
      settings.lockApp()
    }, ms)
  }

  function onActivity(event: Event) {
    if (!canWatch()) return
    if (event.type === 'mousemove') {
      const now = Date.now()
      if (now - lastMoveAt < MOVE_THROTTLE_MS) return
      lastMoveAt = now
    }
    armTimer()
  }

  function startListening() {
    if (listening) return
    listening = true
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { passive: true, capture: true })
    }
  }

  function stopListening() {
    if (!listening) return
    listening = false
    for (const type of ACTIVITY_EVENTS) {
      window.removeEventListener(type, onActivity, true)
    }
    clearTimer()
  }

  function syncWatcher() {
    if (canWatch()) {
      startListening()
      armTimer()
    } else {
      clearTimer()
      // 仍保持监听挂载状态，便于解锁后立刻重新计时；未登录则彻底停
      if (!auth.isLoggedIn || route.path === '/login') {
        stopListening()
      }
    }
  }

  onMounted(() => {
    syncWatcher()
  })

  onUnmounted(() => {
    stopListening()
  })

  watch(
    () => [
      auth.isLoggedIn,
      settings.shouldAutoLock,
      isLocked.value,
      autoLockMinutes.value,
      route.path,
      route.meta?.requiresAuth,
    ],
    () => {
      syncWatcher()
    },
  )
}
