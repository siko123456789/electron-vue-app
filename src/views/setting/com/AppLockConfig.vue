<template>
  <div v-loading="loading" class="app-lock-config">
    <div class="app-lock-config__toolbar">
      <div>
        <h3 class="app-lock-config__title">应用锁</h3>
        <p class="app-lock-config__hint">
          设置本机锁屏密码后可手动锁定；是否空闲自动锁定可单独开关，密码仅保存在本机
        </p>
      </div>
    </div>

    <div class="app-lock-config__list">
      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">锁屏密码</div>
          <p class="setting-card__desc">
            {{
              hasPassword
                ? '已设置本机锁屏密码，可通过顶栏或下方按钮手动锁定'
                : '尚未设置密码，设置后即可手动锁定，并可按需开启自动锁定'
            }}
          </p>
          <div class="setting-card__extra app-lock-config__password">
            <el-input
              v-model="password"
              type="password"
              show-password
              placeholder="输入新密码（至少 4 位）"
              class="app-lock-config__input"
            />
            <el-input
              v-model="passwordConfirm"
              type="password"
              show-password
              placeholder="再次确认密码"
              class="app-lock-config__input"
              @keyup.enter="handleSavePassword"
            />
            <el-button type="primary" plain :loading="passwordSaving" @click="handleSavePassword">
              {{ hasPassword ? '修改密码' : '设置密码' }}
            </el-button>
            <el-button :disabled="!hasPassword" @click="handleLockNow">立即锁定</el-button>
            <el-button :disabled="!hasPassword" type="danger" plain @click="handleClearPassword">
              清除密码
            </el-button>
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__head">
            <div>
              <div class="setting-card__title">启用自动锁定</div>
              <p class="setting-card__desc">
                开启后，空闲达到设定时长将自动进入锁屏；关闭则仅支持手动锁定
              </p>
            </div>
            <el-checkbox
              v-model="form.auto_lock_enabled"
              :true-value="1"
              :false-value="0"
              :disabled="!hasPassword"
              @change="handleAutoLockChange"
            />
          </div>
          <div v-if="form.auto_lock_enabled === 1" class="setting-card__extra">
            <span class="setting-card__extra-label">自动锁定时长:</span>
            <el-select v-model="form.auto_lock_minutes" class="app-lock-config__select">
              <el-option
                v-for="opt in autoLockOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">锁定期间接收 P0 紧急通知</div>
          <p class="setting-card__desc">
            关闭后锁屏状态下将抑制 P0 声音与桌面强提醒，解锁后再统一查看
          </p>
        </div>
        <el-checkbox
          v-model="form.p0_notify_when_locked"
          :true-value="1"
          :false-value="0"
        />
      </section>
    </div>

    <div class="app-lock-config__footer">
      <el-button :disabled="saving" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchNotifySetting, updateNotifySetting } from '@/api/setting'
import { useSettingsStore } from '@/stores/settings'

type AppLockForm = {
  /** 是否启用空闲自动锁定 */
  auto_lock_enabled: number
  /** 自动锁定分钟数（启用时生效） */
  auto_lock_minutes: number
  p0_notify_when_locked: number
}

const autoLockOptions = [
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '60 分钟' },
]

const settings = useSettingsStore()
const loading = ref(false)
const saving = ref(false)
const passwordSaving = ref(false)
const password = ref('')
const passwordConfirm = ref('')
const form = reactive<AppLockForm>(createDefaultForm())
const savedSnapshot = ref<AppLockForm>(createDefaultForm())

const hasPassword = computed(() => Boolean(settings.lockPasswordHash && settings.lockPasswordSalt))

function createDefaultForm(): AppLockForm {
  return {
    auto_lock_enabled: 0,
    auto_lock_minutes: 10,
    p0_notify_when_locked: 1,
  }
}

/** 本机 P0 偏好：未设置或异常时默认开启 */
function readP0NotifyWhenLocked(): boolean {
  const fromStore = settings.p0NotifyWhenLocked
  if (typeof fromStore === 'boolean') return fromStore

  const raw = localStorage.getItem('p0NotifyWhenLocked')
  if (raw === null || raw === '') return true
  if (raw === '0' || raw === 'false') return false
  if (raw === '1' || raw === 'true') return true
  return true
}

function ensureP0NotifyDefaultOn() {
  // 纠正早期热更新/误保存导致的关闭；产品默认开启
  if (typeof settings.p0NotifyWhenLocked !== 'boolean' || localStorage.getItem('p0NotifyWhenLocked') === null) {
    if (typeof settings.setP0NotifyWhenLocked === 'function') {
      settings.setP0NotifyWhenLocked(true)
    } else {
      settings.$patch({ p0NotifyWhenLocked: true })
      localStorage.setItem('p0NotifyWhenLocked', '1')
    }
    return
  }
  // 若曾因 undefined→0 被误写成关闭，且用户未再明确操作，恢复默认开启
  if (localStorage.getItem('p0NotifyWhenLocked') === '0' && !localStorage.getItem('p0NotifyWhenLocked.userSet')) {
    if (typeof settings.setP0NotifyWhenLocked === 'function') {
      settings.setP0NotifyWhenLocked(true)
    } else {
      settings.$patch({ p0NotifyWhenLocked: true })
      localStorage.setItem('p0NotifyWhenLocked', '1')
    }
  }
}

function toMinutes(value: unknown, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.round(num)
}

function applyForm(next: AppLockForm) {
  Object.assign(form, next)
  savedSnapshot.value = { ...next }
}

function handleAutoLockChange(val: string | number | boolean) {
  if (Number(val) === 1 && !hasPassword.value) {
    form.auto_lock_enabled = 0
    ElMessage.warning('请先设置锁屏密码，再启用自动锁定')
    return
  }
  if (Number(val) === 1 && form.auto_lock_minutes <= 0) {
    form.auto_lock_minutes = 10
  }
}

/** 同步本机「应用锁可用」标记（不依赖可能未热更新的 store action） */
function syncLocalLockEnabled(enabled: boolean) {
  const on = Boolean(enabled)
  if (typeof settings.setLockEnabledFlag === 'function') {
    settings.setLockEnabledFlag(on)
    return
  }
  settings.$patch({ lockEnabled: on, isLocked: on ? settings.isLocked : false })
  localStorage.setItem('lockEnabled', on ? '1' : '0')
}

async function handleSavePassword() {
  if (password.value.trim().length < 4) {
    ElMessage.warning('锁屏密码至少需要 4 位')
    return
  }
  if (password.value !== passwordConfirm.value) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  passwordSaving.value = true
  try {
    await settings.setLockPassword(password.value)
    password.value = ''
    passwordConfirm.value = ''
    ElMessage.success('锁屏密码已保存到本机')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '密码保存失败')
  } finally {
    passwordSaving.value = false
  }
}

function handleLockNow() {
  if (!settings.hasLockPassword) {
    ElMessage.warning('请先设置锁屏密码')
    return
  }
  settings.lockApp()
}

async function handleClearPassword() {
  try {
    await ElMessageBox.confirm(
      '清除密码后将无法手动/自动锁定，确定继续吗？',
      '清除锁屏密码',
      { type: 'warning', confirmButtonText: '确定清除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  settings.disableLock()
  form.auto_lock_enabled = 0
  try {
    await updateNotifySetting({
      app_lock_enabled: 0,
      auto_lock_minutes: 0,
    })
    settings.syncAppLockFromRemote({
      app_lock_enabled: 0,
      auto_lock_minutes: 0,
    })
    applyForm({
      ...form,
      auto_lock_enabled: 0,
    })
  } catch {
    // 本机已清除；服务端同步失败时仍提示成功，保存时可再对齐
  }
  ElMessage.success('已清除本机锁屏密码')
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await fetchNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '读取应用锁配置失败')
    }
    ensureP0NotifyDefaultOn()
    const minutes = toMinutes(res.data?.auto_lock_minutes, 0)
    settings.syncAppLockFromRemote({
      app_lock_enabled: res.data?.app_lock_enabled,
      auto_lock_minutes: minutes,
    })
    applyForm({
      auto_lock_enabled: minutes > 0 ? 1 : 0,
      auto_lock_minutes: minutes > 0 ? minutes : 10,
      p0_notify_when_locked: readP0NotifyWhenLocked() ? 1 : 0,
    })
  } catch (error) {
    ensureP0NotifyDefaultOn()
    applyForm({
      ...createDefaultForm(),
      p0_notify_when_locked: readP0NotifyWhenLocked() ? 1 : 0,
    })
    ElMessage.error(error instanceof Error ? error.message : '读取应用锁配置失败')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  Object.assign(form, savedSnapshot.value)
  password.value = ''
  passwordConfirm.value = ''
}

async function handleSave() {
  if (form.auto_lock_enabled === 1 && !hasPassword.value) {
    ElMessage.warning('启用自动锁定前请先设置锁屏密码')
    return
  }

  saving.value = true
  try {
    // 有密码即可手动锁定；同步本机 lockEnabled，自动锁定由接口分钟数控制
    syncLocalLockEnabled(hasPassword.value)
    if (!hasPassword.value) {
      form.auto_lock_enabled = 0
    }

    const p0On = form.p0_notify_when_locked === 1
    if (typeof settings.setP0NotifyWhenLocked === 'function') {
      settings.setP0NotifyWhenLocked(p0On)
    } else {
      settings.$patch({ p0NotifyWhenLocked: p0On })
      localStorage.setItem('p0NotifyWhenLocked', p0On ? '1' : '0')
    }
    localStorage.setItem('p0NotifyWhenLocked.userSet', '1')

    const autoMinutes =
      form.auto_lock_enabled === 1 && hasPassword.value
        ? Math.max(1, form.auto_lock_minutes)
        : 0

    const res = await updateNotifySetting({
      app_lock_enabled: hasPassword.value ? 1 : 0,
      auto_lock_minutes: autoMinutes,
    })
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }

    const savedMinutes = toMinutes(res.data?.auto_lock_minutes, autoMinutes)
    settings.syncAppLockFromRemote({
      app_lock_enabled: hasPassword.value ? 1 : 0,
      auto_lock_minutes: savedMinutes,
    })
    applyForm({
      auto_lock_enabled: savedMinutes > 0 ? 1 : 0,
      auto_lock_minutes: savedMinutes > 0 ? savedMinutes : form.auto_lock_minutes || 10,
      p0_notify_when_locked: form.p0_notify_when_locked,
    })
    ElMessage.success('应用锁配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadConfig()
})
</script>

<style scoped lang="scss">
.app-lock-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.app-lock-config__toolbar {
  flex-shrink: 0;
}

.app-lock-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.app-lock-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.app-lock-config__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.app-lock-config__password {
  align-items: center;
}

.app-lock-config__input {
  width: 200px;
}

.app-lock-config__select {
  width: 160px;
}

.app-lock-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
