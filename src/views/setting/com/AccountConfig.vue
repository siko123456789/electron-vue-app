<template>
  <div v-loading="loading" class="account-config">
    <div class="account-config__toolbar">
      <div>
        <h3 class="account-config__title">登录与账号</h3>
        <p class="account-config__hint">
          管理记住登录、服务器地址；退出登录将清除本机 token 与接口临时缓存
        </p>
      </div>
    </div>

    <div class="account-config__list">
      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__head">
            <div>
              <div class="setting-card__title">记住登录状态</div>
              <p class="setting-card__desc">
                开启后本机保存登录凭证，下次打开可直接进入；关闭则关闭应用后需重新登录
              </p>
            </div>
            <el-checkbox
              v-model="form.remember_login"
              :true-value="1"
              :false-value="0"
            />
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">服务器地址</div>
          <p class="setting-card__desc">
            桌面端请求的后端地址；留空则走本地 /api 代理。修改后请保存，必要时重新登录。
          </p>
          <div class="setting-card__extra account-config__server">
            <el-input
              v-model="form.server_address"
              clearable
              placeholder="例如 https://10.10.10.99（留空则走本地 /api 代理）"
              class="account-config__input"
            />
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">退出登录</div>
          <p class="setting-card__desc">
            退出当前账号，清除本机 token、用户信息与接口临时缓存/离线队列，并返回登录页
          </p>
          <div class="setting-card__extra">
            <el-button type="danger" plain :loading="logoutLoading" @click="handleLogout">
              退出登录并清除本地凭证
            </el-button>
          </div>
        </div>
      </section>
    </div>

    <div class="account-config__footer">
      <el-button :disabled="saving" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { logout } from '@/api/login'
import { fetchNotifySetting, updateNotifySetting } from '@/api/setting'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { clearApiCache, clearOfflineQueue } from '@/utils/request'

type AccountForm = {
  remember_login: number
  server_address: string
}

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const loading = ref(false)
const saving = ref(false)
const logoutLoading = ref(false)
const form = reactive<AccountForm>(createDefaultForm())
const savedSnapshot = ref<AccountForm>(createDefaultForm())

function createDefaultForm(): AccountForm {
  return {
    remember_login: 1,
    server_address: settings.apiBase || '',
  }
}

function toFlag(value: unknown, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return num ? 1 : 0
}

/**
 * 记住登录以本机为准（控制 token 是否持久化）。
 * 本机从未设置 / 未由用户主动保存过时：默认开启。
 */
function resolveRememberLogin(_apiValue: unknown): number {
  const localRaw = localStorage.getItem('rememberLogin')
  const userSet = localStorage.getItem('rememberLogin.userSet')
  // 曾被接口默认 0 误写入本地、且用户从未主动保存过 → 仍按默认开启
  if (localRaw !== null && userSet === '1') {
    return localRaw === '1' || localRaw === 'true' ? 1 : 0
  }
  return 1
}

function applyForm(next: AccountForm) {
  Object.assign(form, next)
  savedSnapshot.value = { ...next }
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await fetchNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '读取账号配置失败')
    }
    const remember = resolveRememberLogin(res.data?.remember_login)
    const server =
      String(res.data?.server_address || '').trim() || settings.apiBase || ''
    applyForm({
      remember_login: remember,
      server_address: server,
    })
    // 纠正被接口默认 0 误写成本地关闭的情况
    settings.setRememberLogin(remember === 1)
    if (server) settings.setApiBase(server)
  } catch (error) {
    applyForm({
      remember_login: 1,
      server_address: settings.apiBase || '',
    })
    settings.setRememberLogin(true)
    ElMessage.error(error instanceof Error ? error.message : '读取账号配置失败')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  Object.assign(form, savedSnapshot.value)
}

async function handleSave() {
  saving.value = true
  try {
    const remember = form.remember_login === 1 ? 1 : 0
    const serverAddress = String(form.server_address || '').trim()

    settings.setRememberLogin(remember === 1)
    settings.setApiBase(serverAddress)
    localStorage.setItem('rememberLogin.userSet', '1')
    if (remember === 1) {
      // 打开记住：把当前会话写回本机
      auth.setAuth({ token: auth.token, userInfo: auth.userInfo || undefined })
    } else {
      auth.dropPersistedAuth()
    }

    const res = await updateNotifySetting({
      remember_login: remember,
      server_address: serverAddress,
    })
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }

    const savedRemember = toFlag(res.data?.remember_login, remember)
    const savedServer =
      String(res.data?.server_address ?? serverAddress).trim() || server.apiBase || ''
    applyForm({
      remember_login: savedRemember,
      server_address: savedServer,
    })
    settings.setRememberLogin(savedRemember === 1)
    settings.setApiBase(savedServer)
    ElMessage.success('登录与账号配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm(
      '将退出登录并清除本机 token、用户信息与接口临时缓存，确定继续吗？',
      '退出登录',
      { type: 'warning', confirmButtonText: '确定退出', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  logoutLoading.value = true
  try {
    try {
      await logout()
    } catch {
      // 接口失败仍继续本地清理
    }
    auth.clearAuth()
    settings.unlockApp()
    clearApiCache()
    clearOfflineQueue()
    try {
      localStorage.removeItem('ipc_cookie_v1')
    } catch {
      // ignore
    }
    ElMessage.success('已退出并清除本地凭证')
    await router.replace('/login')
  } finally {
    logoutLoading.value = false
  }
}

onMounted(() => {
  void loadConfig()
})
</script>

<style scoped lang="scss">
.account-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.account-config__toolbar {
  flex-shrink: 0;
}

.account-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.account-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.account-config__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.account-config__server {
  width: 100%;
}

.account-config__input {
  width: min(100%, 420px);
}

.account-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
