<template>
  <div class="page">
    <el-card class="card">
      <template #header>
        <div class="head">
          <div class="title">设置</div>
          <div class="desc">开机自启、通知、服务器地址、数据存储位置等</div>
        </div>
      </template>

      <el-form label-width="120px" class="form">
        <el-form-item label="开机自启">
          <div class="row">
            <el-switch v-model="autoLaunch" :loading="autoLaunchLoading" @change="applyAutoLaunch" />
            <div class="hint">Windows/macOS 支持；Linux 取决于发行版</div>
          </div>
        </el-form-item>

        <el-form-item label="通知开关">
          <div class="row">
            <el-switch v-model="notificationsEnabled" @change="applyNotificationsEnabled" />
            <el-button size="small" type="primary" plain @click="testNotify">测试</el-button>
          </div>
        </el-form-item>

        <el-form-item label="服务器地址">
          <div class="row">
            <el-input v-model="apiBase" placeholder="留空=默认 /api；也可填 https://host:port 或 https://host:port/base" />
            <el-button size="small" type="primary" @click="saveApiBase">保存</el-button>
          </div>
        </el-form-item>

        <el-form-item label="登录 Token">
          <div class="row">
            <el-input :model-value="maskedToken" readonly />
            <el-button size="small" type="danger" plain @click="clearToken">清除</el-button>
          </div>
        </el-form-item>

        <el-form-item label="数据存储位置">
          <div class="row">
            <el-input :model-value="userDataPath" readonly />
            <el-button size="small" @click="openUserData">打开</el-button>
          </div>
          <div class="hint">
            默认存储在系统的用户数据目录（Electron userData）。安装目录与数据目录通常应分离。
          </div>
        </el-form-item>

        <el-form-item label="缓存/离线队列">
          <div class="row">
            <el-button size="small" @click="clearApiCache">清理接口缓存</el-button>
            <el-button size="small" @click="clearOfflineOps">清理离线队列</el-button>
          </div>
          <div class="hint">断网临时查看用的 GET 缓存、以及离线 POST/PUT/DELETE 队列。</div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { clearApiCache as clearApiCacheFn, clearOfflineQueue as clearOfflineQueueFn } from '@/utils/request'

const settings = useSettingsStore()
const auth = useAuthStore()

const apiBase = ref(settings.apiBase)
const notificationsEnabled = ref(settings.notificationsEnabled)

const autoLaunch = ref(false)
const autoLaunchLoading = ref(false)

const userDataPath = ref('')

const maskedToken = computed(() => {
  const token = auth.token || ''
  if (!token) return ''
  if (token.length <= 10) return '********'
  return `${token.slice(0, 4)}****${token.slice(-4)}`
})

async function refreshAutoLaunch() {
  const ipc = (window as any)?.ipcRenderer
  if (!ipc?.invoke) return
  autoLaunchLoading.value = true
  try {
    autoLaunch.value = Boolean(await ipc.invoke('app/get-auto-launch'))
  } finally {
    autoLaunchLoading.value = false
  }
}

async function applyAutoLaunch() {
  const ipc = (window as any)?.ipcRenderer
  if (!ipc?.invoke) return
  autoLaunchLoading.value = true
  try {
    await ipc.invoke('app/set-auto-launch', Boolean(autoLaunch.value))
    ElMessage.success('已更新开机自启设置')
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
    await refreshAutoLaunch()
  } finally {
    autoLaunchLoading.value = false
  }
}

async function loadPaths() {
  const ipc = (window as any)?.ipcRenderer
  if (!ipc?.invoke) return
  try {
    const res = await ipc.invoke('app/get-paths')
    userDataPath.value = String(res?.userData || '')
  } catch {
    // ignore
  }
}

async function openUserData() {
  const ipc = (window as any)?.ipcRenderer
  if (!ipc?.invoke) return
  try {
    await ipc.invoke('app/open-user-data')
  } catch (e: any) {
    ElMessage.error(e?.message || '打开失败')
  }
}

async function applyNotificationsEnabled() {
  settings.setNotificationsEnabled(Boolean(notificationsEnabled.value))
  const ipc = (window as any)?.ipcRenderer
  if (ipc?.invoke) {
    try {
      await ipc.invoke('app/set-notifications-enabled', Boolean(notificationsEnabled.value))
    } catch {
      // ignore
    }
  }
  ElMessage.success(notificationsEnabled.value ? '已开启通知' : '已关闭通知')
}

function saveApiBase() {
  settings.setApiBase(apiBase.value)
  apiBase.value = settings.apiBase
  ElMessage.success('已保存服务器地址')
}

function clearToken() {
  auth.clearAuth()
  ElMessage.success('已清除 Token')
}

async function testNotify() {
  if (!notificationsEnabled.value) {
    ElMessage.warning('通知已关闭')
    return
  }
  const ipc = (window as any)?.ipcRenderer
  if (!ipc?.invoke) return
  await ipc.invoke('app/show-alert', { variant: 'risk', title: '测试通知', message: '这是一条测试消息', sound: true })
}

async function clearApiCache() {
  clearApiCacheFn()
  ElMessage.success('已清理接口缓存')
}

async function clearOfflineOps() {
  clearOfflineQueueFn()
  ElMessage.success('已清理离线队列')
}

onMounted(async () => {
  notificationsEnabled.value = settings.notificationsEnabled
  {
    const ipc = (window as any)?.ipcRenderer
    if (ipc?.invoke) {
      try {
        const enabled = Boolean(await ipc.invoke('app/get-notifications-enabled'))
        notificationsEnabled.value = enabled
        settings.setNotificationsEnabled(enabled)
      } catch {
        // ignore
      }
    }
  }
  await refreshAutoLaunch()
  await loadPaths()
})
</script>

<style scoped>
.page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.card {
  border-radius: 14px;
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow);
}

.head .title {
  font-weight: 800;
  color: var(--app-text);
}

.head .desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-muted);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-muted);
}
</style>
