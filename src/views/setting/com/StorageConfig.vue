<template>
  <div v-loading="loading" class="storage-config">
    <div class="storage-config__toolbar">
      <div>
        <h3 class="storage-config__title">数据与存储</h3>
        <p class="storage-config__hint">
          查看本机数据目录；自动/手动清理针对应用日志与引擎缓存，不影响服务器业务数据与登录配置
        </p>
      </div>
    </div>

    <div class="storage-config__list">
      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">数据存储位置</div>
          <p class="setting-card__desc">
            Electron 用户数据目录（配置、日志等）。路径由本机决定，不上传服务端。
          </p>
          <div class="setting-card__extra storage-config__path-row">
            <code class="storage-config__path" :title="paths.userData || '—'">
              {{ paths.userData || '暂不可用（非桌面环境）' }}
            </code>
            <el-button size="small" :disabled="!paths.userData" @click="handleCopyPath">
              复制路径
            </el-button>
            <el-button size="small" type="primary" plain :disabled="!paths.userData" @click="handleOpenDir">
              打开目录
            </el-button>
          </div>
          <p v-if="paths.logsDir" class="storage-config__subpath">
            日志目录：{{ paths.logsDir }}
          </p>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__head">
            <div>
              <div class="setting-card__title">启用自动清理</div>
              <p class="setting-card__desc">
                开启后按清理周期自动清理过期日志，并清理引擎缓存
              </p>
            </div>
            <el-checkbox
              v-model="form.auto_cleanup_enabled"
              :true-value="1"
              :false-value="0"
            />
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__main">
          <div class="setting-card__title">清理周期</div>
          <p class="setting-card__desc">
            每隔多少天执行一次自动清理（不是数据只能存几天）
          </p>
          <div class="setting-card__extra">
            <span class="setting-card__extra-label">每隔</span>
            <el-select
              v-model="form.cleanup_interval_days"
              class="storage-config__select"
              :disabled="form.auto_cleanup_enabled !== 1"
            >
              <el-option
                v-for="opt in intervalOptions"
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
          <div class="setting-card__title">日志保留天数</div>
          <p class="setting-card__desc">
            自动/手动清理日志时，删除超过该天数的日志文件；当天日志保留。引擎缓存清理时整清。
          </p>
          <div class="setting-card__extra">
            <span class="setting-card__extra-label">保留</span>
            <el-select
              v-model="form.data_retention_days"
              class="storage-config__select"
              :disabled="form.auto_cleanup_enabled !== 1"
            >
              <el-option
                v-for="opt in retentionOptions"
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
          <div class="setting-card__title">手动清理</div>
          <p class="setting-card__desc">
            立即清理本机过期日志或引擎缓存，不影响服务器数据与登录状态
          </p>
          <div class="setting-card__extra">
            <el-button size="small" :loading="clearing" @click="handleCleanLogs">
              清理过期日志
            </el-button>
            <el-button size="small" :loading="clearing" @click="handleCleanEngine">
              清理引擎缓存
            </el-button>
            <el-button size="small" type="primary" plain :loading="clearing" @click="handleCleanAll">
              一键清理
            </el-button>
          </div>
        </div>
      </section>
    </div>

    <div class="storage-config__footer">
      <el-button :disabled="saving" @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchNotifySetting, updateNotifySetting } from '@/api/setting'
import { copyTextToClipboard } from '@/utils/copyToClipboard'
import {
  cacheStorageCleanupPrefs,
  clearEngineCache,
  cleanupAppLogs,
  runManualStorageCleanup,
  runStorageAutoCleanup,
  type StorageCleanupPrefs,
} from '@/utils/storageCleanup'

type StorageForm = StorageCleanupPrefs

const intervalOptions = [
  { value: 1, label: '1 天' },
  { value: 3, label: '3 天' },
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' },
]

const retentionOptions = [
  { value: 7, label: '7 天' },
  { value: 14, label: '14 天' },
  { value: 30, label: '30 天' },
  { value: 60, label: '60 天' },
  { value: 90, label: '90 天' },
  { value: 180, label: '180 天' },
]

const loading = ref(false)
const saving = ref(false)
const clearing = ref(false)
const paths = reactive({ userData: '', logsDir: '' })
const form = reactive<StorageForm>(createDefaultForm())
const savedSnapshot = ref<StorageForm>(createDefaultForm())

function createDefaultForm(): StorageForm {
  return {
    auto_cleanup_enabled: 0,
    cleanup_interval_days: 7,
    data_retention_days: 30,
  }
}

function toFlag(value: unknown, fallback = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return num ? 1 : 0
}

function toDays(value: unknown, fallback: number) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return fallback
  return Math.round(num)
}

function applyForm(next: StorageForm) {
  Object.assign(form, next)
  savedSnapshot.value = { ...next }
  cacheStorageCleanupPrefs(next)
}

function formatBytes(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadPaths() {
  if (!window.ipcRenderer?.invoke) {
    paths.userData = ''
    paths.logsDir = ''
    return
  }
  try {
    const res = (await window.ipcRenderer.invoke('app/get-paths')) as {
      userData?: string
      logsDir?: string
    }
    paths.userData = String(res?.userData || '')
    paths.logsDir = String(res?.logsDir || '')
  } catch {
    paths.userData = ''
    paths.logsDir = ''
  }
}

async function loadConfig() {
  loading.value = true
  try {
    await loadPaths()
    const res = await fetchNotifySetting()
    if (res?.code !== 0) {
      throw new Error(res?.msg || '读取存储配置失败')
    }
    applyForm({
      auto_cleanup_enabled: toFlag(res.data?.auto_cleanup_enabled, 0),
      cleanup_interval_days: toDays(res.data?.cleanup_interval_days, 7),
      data_retention_days: toDays(res.data?.data_retention_days, 30),
    })
    void runStorageAutoCleanup(form)
  } catch (error) {
    applyForm(createDefaultForm())
    ElMessage.error(error instanceof Error ? error.message : '读取存储配置失败')
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  Object.assign(form, savedSnapshot.value)
}

async function handleCopyPath() {
  if (!paths.userData) return
  try {
    await copyTextToClipboard(paths.userData)
    ElMessage.success('路径已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function handleOpenDir() {
  if (!window.ipcRenderer?.invoke || !paths.userData) return
  try {
    await window.ipcRenderer.invoke('app/open-user-data')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '打开目录失败')
  }
}

async function handleCleanLogs() {
  clearing.value = true
  try {
    const result = await cleanupAppLogs(form.data_retention_days || 30)
    ElMessage.success(
      `已删除 ${result.removed} 个过期日志，释放约 ${formatBytes(result.freedBytes)}`,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清理日志失败')
  } finally {
    clearing.value = false
  }
}

async function handleCleanEngine() {
  clearing.value = true
  try {
    const result = await clearEngineCache()
    if (!result.ok) {
      throw new Error(result.message || '清理引擎缓存失败')
    }
    ElMessage.success('引擎缓存已清理')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清理引擎缓存失败')
  } finally {
    clearing.value = false
  }
}

async function handleCleanAll() {
  clearing.value = true
  try {
    const result = await runManualStorageCleanup({
      retentionDays: form.data_retention_days || 30,
      cleanLogs: true,
      cleanEngine: true,
    })
    ElMessage.success(
      `一键清理完成：删除日志 ${result.logsRemoved} 个（约 ${formatBytes(result.freedBytes)}），引擎缓存${
        result.engineOk ? '已清理' : '清理失败'
      }`,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清理失败')
  } finally {
    clearing.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const payload: StorageForm = {
      auto_cleanup_enabled: form.auto_cleanup_enabled === 1 ? 1 : 0,
      cleanup_interval_days: toDays(form.cleanup_interval_days, 7),
      data_retention_days: toDays(form.data_retention_days, 30),
    }
    const res = await updateNotifySetting(payload)
    if (res?.code !== 0) {
      throw new Error(res?.msg || '保存失败')
    }
    applyForm({
      auto_cleanup_enabled: toFlag(res.data?.auto_cleanup_enabled, payload.auto_cleanup_enabled),
      cleanup_interval_days: toDays(
        res.data?.cleanup_interval_days,
        payload.cleanup_interval_days,
      ),
      data_retention_days: toDays(res.data?.data_retention_days, payload.data_retention_days),
    })
    void runStorageAutoCleanup(form)
    ElMessage.success('数据与存储配置已保存')
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
.storage-config {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.storage-config__toolbar {
  flex-shrink: 0;
}

.storage-config__title {
  margin: 0;
  color: var(--c-text);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
}

.storage-config__hint {
  margin: 6px 0 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.storage-config__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.storage-config__path-row {
  align-items: center;
  flex-wrap: wrap;
}

.storage-config__path {
  display: inline-block;
  max-width: min(100%, 420px);
  padding: 4px 8px;
  overflow: hidden;
  color: var(--c-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: color-mix(in srgb, var(--c-bg) 70%, transparent);
  border: 1px solid var(--c-border-light);
  border-radius: 6px;
}

.storage-config__subpath {
  margin: 8px 0 0;
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}

.storage-config__select {
  width: 140px;
}

.storage-config__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
