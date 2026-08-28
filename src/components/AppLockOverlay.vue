<template>
  <transition name="app-lock-fade">
    <div v-if="visible" class="lock-screen">
      <!-- 与登录页一致：可拖拽区 + 主题切换 + 窗口控件 -->
      <div
        v-if="framelessWindow"
        class="lock-drag"
        aria-hidden="true"
        @dblclick="toggleMaximize"
      />
      <div v-if="framelessWindow" class="lock-chrome">
        <button
          class="lock-theme-toggle"
          type="button"
          :aria-label="themeToggleLabel"
          :title="themeToggleLabel"
          @click="settings.toggleColorTheme()"
        >
          <el-icon>
            <Moon v-if="settings.colorTheme === 'dark'" />
            <Sunny v-else />
          </el-icon>
        </button>
        <WindowControls />
      </div>
      <button
        v-else
        class="lock-theme-toggle lock-theme-toggle--solo"
        type="button"
        :aria-label="themeToggleLabel"
        :title="themeToggleLabel"
        @click="settings.toggleColorTheme()"
      >
        <el-icon>
          <Moon v-if="settings.colorTheme === 'dark'" />
          <Sunny v-else />
        </el-icon>
      </button>

      <div class="bg-glow-1" />
      <div class="bg-glow-2" />

      <div class="lock-shell" :class="{ 'is-error-shake': shakeTrigger }">
        <div class="lock-emblem">
          <div class="icon-pulse" />
          <el-icon>
            <Lock />
          </el-icon>
        </div>

        <div class="lock-title">应用已锁定</div>
        <div class="lock-desc">为了您的数据安全，请输入锁屏密码</div>

        <el-form class="lock-form" @submit.prevent>
          <el-input
            v-model="password"
            type="password"
            show-password
            placeholder="请输入锁屏密码"
            size="large"
            @input="clearError"
            @keyup.enter="unlock"
          />
          <el-button
            type="primary"
            size="large"
            class="unlock-btn"
            :loading="submitting"
            @click="unlock"
          >
            <span>解锁并进入</span>
          </el-button>
        </el-form>

        <transition name="error-fade">
          <div v-if="errorMessage" class="lock-error">
            <el-icon class="mr-1"><Warning /></el-icon>
            {{ errorMessage }}
          </div>
        </transition>

        <div class="lock-forget">
          <span class="forget-text">忘记密码？</span>
          <el-button link type="primary" size="small" class="forget-link" @click="handleForgetPassword">
            退出登录重新设置
          </el-button>
        </div>

        <div class="lock-divider" />
        <div class="lock-tip">锁定期间页面内容已被安全隐藏</div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock, Moon, Sunny, Warning } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import WindowControls from '@/components/WindowControls.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const shakeTrigger = ref(false)
const framelessWindow = ref(Boolean(window.ipcRenderer?.invoke))

const visible = computed(() => {
  return Boolean(settings.isLocked && auth.isLoggedIn && route.meta?.requiresAuth !== false)
})

const themeToggleLabel = computed(() =>
  settings.colorTheme === 'dark' ? '切换浅色模式' : '切换深色模式',
)

function toggleMaximize() {
  void window.ipcRenderer?.invoke('window/maximize-toggle')
}

watch(visible, (next) => {
  if (!next) {
    password.value = ''
    submitting.value = false
    errorMessage.value = ''
  }
})

onMounted(async () => {
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

function clearError() {
  errorMessage.value = ''
}

function triggerShake() {
  shakeTrigger.value = true
  setTimeout(() => {
    shakeTrigger.value = false
  }, 500)
}

async function unlock() {
  if (submitting.value) return

  if (!password.value) {
    errorMessage.value = '请输入锁屏密码'
    triggerShake()
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const passed = await settings.verifyLockPassword(password.value)
    if (!passed) {
      errorMessage.value = '密码不正确，请重试'
      triggerShake()
      return
    }

    settings.unlockApp()
    password.value = ''
    ElMessage({
      message: '解锁成功',
      type: 'success',
      zIndex: 20000,
      customClass: 'lock-message',
    })
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '解锁失败，请稍后再试'
    triggerShake()
  } finally {
    submitting.value = false
  }
}

async function handleForgetPassword() {
  await nextTick()
  try {
    await ElMessageBox.confirm(
      '忘记密码将退出登录，登录后可重新设置锁屏密码。确定要退出吗？',
      '安全提示',
      {
        confirmButtonText: '确定退出',
        cancelButtonText: '取消',
        type: 'warning',
        zIndex: 99999,
        center: true,
      },
    )
    settings.disableLock()
    auth.clearAuth()
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--c-bg);
  overflow: hidden;
}

.lock-drag {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1020;
  height: 48px;
  -webkit-app-region: drag;
}

.lock-chrome {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1030;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  -webkit-app-region: no-drag;
}

.lock-theme-toggle {
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

.lock-theme-toggle:hover {
  color: var(--c-primary-light);
  background: var(--c-bg-hover);
}

.lock-theme-toggle--solo {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1030;
}

/* 动态背景光晕（跟主题主色） */
.bg-glow-1 {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--c-primary) 22%, transparent) 0%,
    transparent 70%
  );
  filter: blur(60px);
  animation: float 20s infinite alternate;
  pointer-events: none;
}

.bg-glow-2 {
  position: absolute;
  bottom: -10%;
  right: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--c-info) 16%, transparent) 0%,
    transparent 70%
  );
  filter: blur(60px);
  animation: float 25s infinite alternate-reverse;
  pointer-events: none;
}

@keyframes float {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(10%, 10%);
  }
}

.lock-shell {
  position: relative;
  width: min(100%, 400px);
  padding: 48px 36px;
  border-radius: 32px;
  border: 1px solid color-mix(in srgb, var(--c-border) 80%, transparent);
  background: color-mix(in srgb, var(--c-bg-card) 78%, transparent);
  backdrop-filter: blur(24px) saturate(160%);
  box-shadow:
    0 4px 6px -1px color-mix(in srgb, #000 8%, transparent),
    0 20px 40px -12px color-mix(in srgb, var(--c-primary) 22%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
  text-align: center;
  z-index: 10;
}

.is-error-shake {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

.lock-emblem {
  position: relative;
  width: 84px;
  height: 84px;
  margin: 0 auto 28px;
  border-radius: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-on-primary);
  font-size: 38px;
  background: linear-gradient(135deg, var(--c-primary-light), var(--c-primary));
  box-shadow: 0 12px 24px color-mix(in srgb, var(--c-primary) 35%, transparent);
  animation: hoverFloat 3s ease-in-out infinite;
}

@keyframes hoverFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.icon-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 30px;
  background: color-mix(in srgb, var(--c-primary) 22%, transparent);
  z-index: -1;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}

.lock-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--c-text);
  letter-spacing: -0.02em;
}

.lock-desc {
  margin-top: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--c-text-muted);
}

.lock-form {
  margin-top: 36px;
  display: grid;
  gap: 18px;
}

.unlock-btn {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    var(--c-primary-light),
    var(--c-primary),
    var(--c-primary-light)
  ) !important;
  background-size: 200% auto !important;
  border: none !important;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  border-radius: 14px;
  transition: all 0.3s ease;
}

.unlock-btn:hover {
  background-position: right center !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px color-mix(in srgb, var(--c-primary) 42%, transparent);
}

.unlock-btn:active {
  transform: translateY(0);
}

.lock-error {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-danger);
  background: var(--c-danger-bg);
  padding: 8px;
  border-radius: 8px;
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition: all 0.3s ease;
}
.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.lock-forget {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
}

.forget-text {
  color: var(--c-text-muted);
}

.forget-link {
  font-weight: 600;
  transition: all 0.2s;
}

.lock-divider {
  margin: 24px auto 16px;
  width: 40px;
  height: 3px;
  background: color-mix(in srgb, var(--c-primary) 16%, transparent);
  border-radius: 2px;
}

.lock-tip {
  font-size: 12px;
  color: var(--c-text-muted);
  letter-spacing: 0.05em;
  opacity: 0.75;
}

:deep(.el-input__wrapper) {
  background: color-mix(in srgb, var(--c-bg-input) 70%, transparent);
  border-radius: 14px;
  padding: 0 16px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-primary) 16%, transparent) inset !important;
  transition: all 0.3s;
}

:deep(.el-input__wrapper.is-focus) {
  background: var(--c-bg-input);
  box-shadow: 0 0 0 2px var(--c-primary) inset !important;
}

:deep(.el-input__inner) {
  color: var(--c-text);
}

.app-lock-fade-enter-active,
.app-lock-fade-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.app-lock-fade-enter-from,
.app-lock-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
  transform: scale(1.1);
}

.mr-1 {
  margin-right: 4px;
}
</style>
