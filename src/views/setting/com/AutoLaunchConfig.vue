<template>
  <div v-loading="loading" class="auto-launch-config">
    <div class="auto-launch-config__toolbar">
      <div>
        <h3 class="auto-launch-config__title">开机启动与托盘行为</h3>
        <p class="auto-launch-config__hint">
          配置 Windows 操作系统登录后的哨兵自动化守护服务
        </p>
      </div>
    </div>

    <div class="auto-launch-config__list">
      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">开机自动启动</div>
          <p class="setting-card__desc">Windows 启动时自动建立后台告警拉取守护进程</p>
        </div>
        <el-checkbox v-model="form.auto_launch_enabled" :true-value="1" :false-value="0" />
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">启动后最小化到托盘</div>
          <p class="setting-card__desc">启动完成自动隐藏主窗口，仅保留系统托盘图标与气泡</p>
        </div>
        <el-checkbox v-model="form.start_to_tray_enabled" :true-value="1" :false-value="0" />
      </section>
    </div>

    <div class="auto-launch-config__footer">
      <el-button :disabled="saving" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchNotifySetting, updateNotifySetting } from '@/api/setting'

type AutoLaunchForm = {
  /** 本机开机自启（Electron login item） */
  auto_launch_enabled: number
  /** 服务端配置：启动后最小化到托盘 */
  start_to_tray_enabled: number
}

const loading = ref(false)
const saving = ref(false)
const form = reactive<AutoLaunchForm>(createDefaultForm())
const savedSnapshot = ref<AutoLaunchForm>(createDefaultForm())

function createDefaultForm(): AutoLaunchForm {
  return {
    auto_launch_enabled: 0,
    start_to_tray_enabled: 0,
  }
}

function toFlag(value: unknown, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return num ? 1 : 0
}

function applyForm(next: AutoLaunchForm) {
  Object.assign(form, next)
  savedSnapshot.value = { ...next }
}

async function readAutoLaunchEnabled() {
  if (!window.ipcRenderer?.invoke) return 0
  try {
    const enabled = await window.ipcRenderer.invoke('app/get-auto-launch')
    return enabled ? 1 : 0
  } catch {
    return 0
  }
}

async function writeAutoLaunchEnabled(enabled: number) {
  if (!window.ipcRenderer?.invoke) return false
  return Boolean(await window.ipcRenderer.invoke('app/set-auto-launch', enabled === 1))
}

async function loadConfig() {
  loading.value = true
  try {
    const [autoLaunch, settingRes] = await Promise.all([
      readAutoLaunchEnabled(),
      fetchNotifySetting(),
    ])
    if (settingRes?.code !== 0) {
      throw new Error(settingRes?.msg || '读取开机自启配置失败')
    }
    applyForm({
      auto_launch_enabled: autoLaunch,
      start_to_tray_enabled: toFlag(settingRes.data?.start_to_tray_enabled, 0),
    })
  } catch (error) {
    applyForm(createDefaultForm())
    ElMessage.error(error instanceof Error ? error.message : '读取开机自启配置失败')
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
    const ok = await writeAutoLaunchEnabled(form.auto_launch_enabled)
    if (window.ipcRenderer?.invoke && !ok) {
      throw new Error('本机开机自启设置失败')
    }

    const res = await updateNotifySetting({
      start_to_tray_enabled: form.start_to_tray_enabled,
    })
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }

    applyForm({
      auto_launch_enabled: form.auto_launch_enabled,
      start_to_tray_enabled: toFlag(
        res.data?.start_to_tray_enabled ?? form.start_to_tray_enabled,
        form.start_to_tray_enabled,
      ),
    })
    ElMessage.success('开机自启配置已保存')
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
.auto-launch-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.auto-launch-config__toolbar {
  flex-shrink: 0;
}

.auto-launch-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.auto-launch-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.auto-launch-config__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.auto-launch-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
