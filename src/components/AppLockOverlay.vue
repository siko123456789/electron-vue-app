<template>
  <transition name="app-lock-fade">
    <div v-if="visible" class="lock-screen">
      <!-- 动态氛围背景层 -->
      <div class="bg-glow-1"></div>
      <div class="bg-glow-2"></div>

      <!-- 增加 :class 绑定实现错误震动 -->
      <div class="lock-shell" :class="{ 'is-error-shake': shakeTrigger }">
        <div class="lock-emblem">
          <div class="icon-pulse"></div>
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

        <!-- 错误信息：增加过渡动画 -->
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

        <div class="lock-divider"></div>
        <div class="lock-tip">锁定期间页面内容已被安全隐藏</div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { Lock, Warning } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const shakeTrigger = ref(false) // 控制震动动画

const visible = computed(() => {
  return Boolean(settings.isLocked && auth.isLoggedIn && route.meta?.requiresAuth !== false)
})

watch(visible, (next) => {
  if (!next) {
    password.value = ''
    submitting.value = false
    errorMessage.value = ''
  }
})

function clearError() {
  errorMessage.value = ''
}

// 触发震动效果
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
      customClass: 'lock-message'
    })
  } catch (error: any) {
    errorMessage.value = error?.message || '解锁失败，请稍后再试'
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
        center: true
      }
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
  background-color: #f8fafc;
  overflow: hidden;
}

/* 动态背景光晕 */
.bg-glow-1 {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
  filter: blur(60px);
  animation: float 20s infinite alternate;
}

.bg-glow-2 {
  position: absolute;
  bottom: -10%;
  right: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
  filter: blur(60px);
  animation: float 25s infinite alternate-reverse;
}

@keyframes float {
  from { transform: translate(0, 0); }
  to { transform: translate(10%, 10%); }
}

.lock-shell {
  position: relative;
  width: min(100%, 400px);
  padding: 48px 36px;
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 20px 40px -12px rgba(168, 85, 247, 0.15),
    inset 0 0 20px rgba(255, 255, 255, 0.5);
  text-align: center;
  z-index: 10;
}

/* 震动动画 */
.is-error-shake {
  animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
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
  color: #fff;
  font-size: 38px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  box-shadow: 0 12px 24px rgba(124, 58, 237, 0.3);
  animation: hoverFloat 3s ease-in-out infinite;
}

@keyframes hoverFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.icon-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 30px;
  background: rgba(168, 85, 247, 0.2);
  z-index: -1;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.lock-title {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.lock-desc {
  margin-top: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: #64748b;
}

.lock-form {
  margin-top: 36px;
  display: grid;
  gap: 18px;
}

.unlock-btn {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, #a855f7, #7c3aed, #a855f7) !important;
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
  box-shadow: 0 8px 25px rgba(124, 58, 237, 0.4);
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
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  padding: 8px;
  border-radius: 8px;
}

.error-fade-enter-active, .error-fade-leave-active {
  transition: all 0.3s ease;
}
.error-fade-enter-from, .error-fade-leave-to {
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
  color: #94a3b8;
}

.forget-link {
  font-weight: 600;
  transition: all 0.2s;
}

.lock-divider {
  margin: 24px auto 16px;
  width: 40px;
  height: 3px;
  background: rgba(168, 85, 247, 0.1);
  border-radius: 2px;
}

.lock-tip {
  font-size: 12px;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 输入框深度定制 */
:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 14px;
  padding: 0 16px;
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.1) inset !important;
  transition: all 0.3s;
}

:deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 2px #a855f7 inset !important;
}

/* 页面切换动画 */
.app-lock-fade-enter-active,
.app-lock-fade-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.app-lock-fade-enter-from,
.app-lock-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
  transform: scale(1.1);
}

.mr-1 { margin-right: 4px; }
</style>